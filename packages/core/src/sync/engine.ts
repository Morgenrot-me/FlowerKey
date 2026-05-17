/**
 * 花钥 FlowerKey - 同步引擎
 * 增量同步：本地 ChangeLog → 加密 oplog → WebDAV
 * 冲突解决：Last-Write-Wins（以 updatedAt 时间戳为准）
 */

import { FlowerKeyWebDAV, type WebDAVConfig } from './webdav.js';
import type { StorageBackend } from './backend.js';
import { serializeOpLog, deserializeOpLog, type OpLogEntry } from './changelog.js';
import { encrypt, decrypt, generateDeviceId } from '../crypto.js';
import { db, encryptEntry, decryptEntry } from '../db.js';
import type { Entry, ChangeLog } from '../models.js';

const LOCK_TIMEOUT_MS = 60_000;
const OPLOG_COMPACT_THRESHOLD = 20;

interface SyncLock {
  deviceId: string;
  token: string;
  expires: number;
}

interface SyncCursor {
  lastSyncTime?: number;
  lastOplogTime?: number;
  lastVaultOplogTime?: number;
}

interface VaultSnapshot {
  version?: number;
  snapshotTime?: number;
  oplogTime?: number;
  entries?: Entry[];
}

/** 本地数据库适配接口，允许移动端注入 SQLite 实现 */
export interface LocalDbAdapter {
  getUnsyncedLogs(): Promise<ChangeLog[]>;
  markLogsSynced(ids: number[]): Promise<void>;
  getEntry(id: string): Promise<Entry | undefined>;
  putEntry(entry: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  getAllEntries(): Promise<Entry[]>;
  getConfig<T>(key: string): Promise<T | undefined>;
  setConfig(key: string, value: unknown): Promise<void>;
}

const defaultAdapter: LocalDbAdapter = {
  getUnsyncedLogs: () => db.getUnsyncedLogs(),
  markLogsSynced: (ids) => db.markLogsSynced(ids),
  getEntry: (id) => db.getEntry(id),
  putEntry: async (entry) => { await db.entries.put(await encryptEntry(entry, db.getDbKey())); },
  deleteEntry: (id) => db.entries.delete(id),
  getAllEntries: async () => {
    const all = await db.entries.toArray();
    return Promise.all(all.map(e => decryptEntry(e, db.getDbKey())));
  },
  getConfig: (key) => db.getConfig(key),
  setConfig: (key, value) => db.setConfig(key, value),
};

export class SyncEngine {
  private dav: StorageBackend;
  private dbKey: CryptoKey;
  private deviceId: string;
  private local: LocalDbAdapter;
  private lockToken = '';
  encryptMismatchCount = 0;
  mismatchedBookmarkIds: string[] = [];

  constructor(backend: StorageBackend | WebDAVConfig, dbKey: CryptoKey, deviceId: string, localAdapter?: LocalDbAdapter) {
    this.dav = 'url' in backend ? new FlowerKeyWebDAV(backend) : backend;
    this.dbKey = dbKey;
    this.deviceId = deviceId;
    this.local = localAdapter ?? defaultAdapter;
  }

  private async encryptText(text: string): Promise<ArrayBuffer> {
    return encrypt(text, this.dbKey);
  }

  private async decryptBuf(buf: ArrayBuffer): Promise<string> {
    return decrypt(buf, this.dbKey);
  }

  /** 尝试获取同步锁（60秒过期，二次读回防TOCTOU竞态） */
  private async acquireLock(): Promise<boolean> {
    const existing = await this.dav.read('sync.lock');
    if (existing) {
      try {
        const text = new TextDecoder().decode(existing);
        const lock = JSON.parse(text) as Partial<SyncLock>;
        if (lock.expires && lock.expires > Date.now() && (lock.deviceId !== this.deviceId || lock.token)) return false;
      } catch {
        return false;
      }
    }

    this.lockToken = generateDeviceId();
    const lock: SyncLock = { deviceId: this.deviceId, token: this.lockToken, expires: Date.now() + LOCK_TIMEOUT_MS };
    await this.dav.write('sync.lock', JSON.stringify(lock));

    // 第一次读回确认
    const current = await this.dav.read('sync.lock');
    if (!current) return false;
    try {
      const saved = JSON.parse(new TextDecoder().decode(current)) as Partial<SyncLock>;
      if (saved.deviceId !== this.deviceId || saved.token !== this.lockToken) return false;
    } catch {
      return false;
    }

    // 二次读回验证：随机延迟后再次确认，防止并发写入覆盖
    await new Promise(r => setTimeout(r, 100 + Math.floor(Math.random() * 200)));
    const recheck = await this.dav.read('sync.lock');
    if (!recheck) return false;
    try {
      const recheckLock = JSON.parse(new TextDecoder().decode(recheck)) as Partial<SyncLock>;
      if (recheckLock.deviceId !== this.deviceId || recheckLock.token !== this.lockToken) {
        // 锁已被其他设备覆盖，当前设备只放弃本次获取，不能删除对方的有效锁。
        this.lockToken = '';
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this.lockToken) return;
    try {
      const existing = await this.dav.read('sync.lock');
      if (!existing) return;
      try {
        const lock = JSON.parse(new TextDecoder().decode(existing)) as Partial<SyncLock>;
        if (lock.deviceId === this.deviceId && lock.token === this.lockToken) {
          await this.dav.remove('sync.lock');
        }
      } catch {
        return;
      }
    } finally {
      this.lockToken = '';
    }
  }

  private getOplogTimestamp(file: string): number {
    const m = /^[^_]+_(\d+)\.enc$/.exec(file);
    return m ? parseInt(m[1]) : 0;
  }

  /** 执行一次完整同步 */
  async sync(): Promise<{ pushed: number; pulled: number; encryptMismatch?: number; mismatchedBookmarkIds?: string[] }> {
    await this.dav.ensureDir();

    if (!(await this.acquireLock())) {
      throw new Error('同步锁被占用，请稍后重试');
    }

    try {
      this.encryptMismatchCount = 0;
      this.mismatchedBookmarkIds = [];
      const pushed = await this.push();
      await this.restoreFromVaultIfNeeded();
      const pulled = await this.pull();
      await this.maybeCompact();
      const state = (await this.local.getConfig<SyncCursor>('syncState')) ?? {};
      await this.local.setConfig('syncState', { ...state, lastSyncTime: Date.now() });
      const result: { pushed: number; pulled: number; encryptMismatch?: number; mismatchedBookmarkIds?: string[] } = { pushed, pulled };
      if (this.encryptMismatchCount > 0) result.encryptMismatch = this.encryptMismatchCount;
      if (this.mismatchedBookmarkIds.length > 0) result.mismatchedBookmarkIds = [...this.mismatchedBookmarkIds];
      return result;
    } finally {
      await this.releaseLock();
    }
  }

  /** 推送本地未同步变更 */
  private async push(): Promise<number> {
    const unsyncedLogs = await this.local.getUnsyncedLogs();
    if (!unsyncedLogs.length) return 0;

    const opEntries: OpLogEntry[] = [];
    const pushedIds: number[] = [];
    for (const log of unsyncedLogs) {
      const entry = log.operation !== 'delete' ? await this.local.getEntry(log.entryId) : undefined;
      if (log.operation !== 'delete' && !entry) continue;
      opEntries.push({
        entryId: log.entryId,
        entryType: log.entryType,
        operation: log.operation,
        timestamp: log.timestamp,
        deviceId: log.deviceId,
        payload: entry,
      });
      if (log.id) pushedIds.push(log.id);
    }

    if (!opEntries.length) return 0;

    const filename = `oplog/${this.deviceId}_${Date.now()}.enc`;
    const encrypted = await this.encryptText(serializeOpLog(opEntries));
    await this.dav.write(filename, encrypted);

    await this.local.markLogsSynced(pushedIds);

    return opEntries.length;
  }

  /** 拉取远端新变更并应用 */
  private async pull(): Promise<number> {
    const state = (await this.local.getConfig<SyncCursor>('syncState')) ?? {};
    const lastOplogTime = state.lastOplogTime ?? state.lastSyncTime ?? 0;

    const files = await this.dav.listOplog();
    const newFiles = files
      .map(file => ({ file, timestamp: this.getOplogTimestamp(file) }))
      .filter(item => item.timestamp > lastOplogTime && !item.file.startsWith(this.deviceId + '_'))
      .sort((a, b) => a.timestamp - b.timestamp || a.file.localeCompare(b.file));

    let applied = 0;
    let maxAppliedOplogTime = lastOplogTime;
    for (const item of newFiles) {
      const buf = await this.dav.read(`oplog/${item.file}`);
      if (!buf) continue;
      const text = await this.decryptBuf(buf);
      const ops = deserializeOpLog(text);
      for (const op of ops) {
        await this.applyOp(op);
        applied++;
      }
      maxAppliedOplogTime = Math.max(maxAppliedOplogTime, item.timestamp);
    }

    if (maxAppliedOplogTime > lastOplogTime) {
      await this.local.setConfig('syncState', { ...state, lastOplogTime: maxAppliedOplogTime, lastSyncTime: Date.now() });
    }

    return applied;
  }

  /** 应用单条远端操作（LWW冲突解决） */
  private async applyOp(op: OpLogEntry): Promise<void> {
    if (op.entryType !== 'entry') return;

    if (op.operation === 'delete') {
      const local = await this.local.getEntry(op.entryId);
      if (!local || local.updatedAt <= op.timestamp) {
        await this.local.deleteEntry(op.entryId);
      }
      return;
    }

    const remote = op.payload as Entry;
    if (!remote) return;

    // 检测书签加密状态不一致：远端明文（encrypted===false）而本地加密，或反之
    if (remote.type === 'bookmark') {
      const localEncrypt = (await this.local.getConfig<boolean>('bookmarkEncrypt')) ?? true;
      const remoteEncrypt = remote.encrypted !== false;
      if (localEncrypt !== remoteEncrypt) {
        this.encryptMismatchCount++;
        this.mismatchedBookmarkIds.push(op.entryId);
        return;
      }
    }

    const local = await this.local.getEntry(op.entryId);
    if (!local || local.updatedAt < remote.updatedAt) {
      await this.local.putEntry(remote);
    }
  }

  /** oplog 超过阈值时压缩为全量快照 */
  private async maybeCompact(): Promise<void> {
    const files = await this.dav.listOplog();
    if (files.length < OPLOG_COMPACT_THRESHOLD) return;

    const allEntries = await this.local.getAllEntries();
    const snapshotTime = Date.now();
    const state = (await this.local.getConfig<SyncCursor>('syncState')) ?? {};
    const maxOplogTime = files.reduce((max, file) => Math.max(max, this.getOplogTimestamp(file)), state.lastOplogTime ?? 0);
    const snapshot = JSON.stringify({ version: 1, snapshotTime, oplogTime: maxOplogTime, entries: allEntries });
    const encrypted = await this.encryptText(snapshot);
    await this.dav.write('vault.enc', encrypted);

    for (const f of files) {
      await this.dav.remove(`oplog/${f}`);
    }
    await this.local.setConfig('syncState', { ...state, lastOplogTime: maxOplogTime, lastVaultOplogTime: maxOplogTime, lastSyncTime: snapshotTime });
  }

  private async readVaultSnapshot(): Promise<VaultSnapshot | null> {
    const buf = await this.dav.read('vault.enc');
    if (!buf) return null;
    const text = await this.decryptBuf(buf);
    const parsed = JSON.parse(text) as Entry[] | VaultSnapshot;
    if (Array.isArray(parsed)) return { entries: parsed };
    return parsed;
  }

  private async applyVaultSnapshot(snapshot: VaultSnapshot): Promise<boolean> {
    if (!snapshot.entries) return false;
    for (const entry of snapshot.entries) {
      await this.local.putEntry(entry);
    }
    const now = Date.now();
    const state = (await this.local.getConfig<SyncCursor>('syncState')) ?? {};
    const oplogTime = snapshot.oplogTime ?? snapshot.snapshotTime ?? now;
    await this.local.setConfig('syncState', { ...state, lastOplogTime: oplogTime, lastVaultOplogTime: oplogTime, lastSyncTime: now });
    return true;
  }

  private async restoreFromVaultIfNeeded(): Promise<void> {
    const state = (await this.local.getConfig<SyncCursor>('syncState')) ?? {};
    const snapshot = await this.readVaultSnapshot();
    if (!snapshot?.entries) return;
    const oplogTime = snapshot.oplogTime ?? snapshot.snapshotTime;
    if (oplogTime && (state.lastVaultOplogTime ?? 0) >= oplogTime) return;
    if (state.lastOplogTime && oplogTime && state.lastOplogTime >= oplogTime) {
      await this.local.setConfig('syncState', { ...state, lastVaultOplogTime: oplogTime });
      return;
    }
    await this.applyVaultSnapshot(snapshot);
  }

  /** 首次加入：从远端全量快照恢复 */
  async restoreFromVault(): Promise<boolean> {
    const snapshot = await this.readVaultSnapshot();
    return snapshot ? this.applyVaultSnapshot(snapshot) : false;
  }
}
