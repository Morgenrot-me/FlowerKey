/**
 * 花钥 FlowerKey - 同步引擎
 * 增量同步：本地 ChangeLog → 加密 oplog → WebDAV
 * 冲突解决：Last-Write-Wins（以 updatedAt 时间戳为准）
 */

import { FlowerKeyWebDAV, type WebDAVConfig } from './webdav.js';
import type { StorageBackend } from './backend.js';
import { serializeOpLog, deserializeOpLog, type OpLogEntry } from './changelog.js';
import { encrypt, decrypt, deriveDatabaseKey } from '../crypto.js';
import { db } from '../db.js';
import type { Entry } from '../models.js';

const LOCK_TIMEOUT_MS = 60_000;
const OPLOG_COMPACT_THRESHOLD = 20;

export class SyncEngine {
  private dav: StorageBackend;
  private masterPwd: string;
  private userSalt: string;
  private deviceId: string;
  encryptMismatchCount = 0;

  constructor(backend: StorageBackend | WebDAVConfig, masterPwd: string, userSalt: string, deviceId: string) {
    this.dav = 'url' in backend ? new FlowerKeyWebDAV(backend) : backend;
    this.masterPwd = masterPwd;
    this.userSalt = userSalt;
    this.deviceId = deviceId;
  }

  private async getKey() {
    return deriveDatabaseKey(this.masterPwd, this.userSalt);
  }

  private async encryptText(text: string): Promise<ArrayBuffer> {
    return encrypt(text, await this.getKey());
  }

  private async decryptBuf(buf: ArrayBuffer): Promise<string> {
    return decrypt(buf, await this.getKey());
  }

  /** 尝试获取同步锁（60秒过期） */
  private async acquireLock(): Promise<boolean> {
    const existing = await this.dav.read('sync.lock');
    if (existing) {
      const text = new TextDecoder().decode(existing);
      const lock = JSON.parse(text) as { deviceId: string; expires: number };
      if (lock.expires > Date.now() && lock.deviceId !== this.deviceId) return false;
    }
    const lock = { deviceId: this.deviceId, expires: Date.now() + LOCK_TIMEOUT_MS };
    await this.dav.write('sync.lock', JSON.stringify(lock));
    return true;
  }

  private async releaseLock(): Promise<void> {
    await this.dav.remove('sync.lock');
  }

  /** 执行一次完整同步 */
  async sync(): Promise<{ pushed: number; pulled: number; encryptMismatch?: number }> {
    await this.dav.ensureDir();

    if (!(await this.acquireLock())) {
      throw new Error('同步锁被占用，请稍后重试');
    }

    try {
      this.encryptMismatchCount = 0;
      const pushed = await this.push();
      const pulled = await this.pull();
      await this.maybeCompact();
      const result: { pushed: number; pulled: number; encryptMismatch?: number } = { pushed, pulled };
      if (this.encryptMismatchCount > 0) result.encryptMismatch = this.encryptMismatchCount;
      return result;
    } finally {
      await this.releaseLock();
    }
  }

  /** 推送本地未同步变更 */
  private async push(): Promise<number> {
    const unsyncedLogs = await db.getUnsyncedLogs();
    if (!unsyncedLogs.length) return 0;

    const opEntries: OpLogEntry[] = [];
    for (const log of unsyncedLogs) {
      const entry = log.operation !== 'delete' ? await db.getEntry(log.entryId) : undefined;
      opEntries.push({
        entryId: log.entryId,
        entryType: log.entryType,
        operation: log.operation,
        timestamp: log.timestamp,
        deviceId: log.deviceId,
        payload: entry,
      });
    }

    const filename = `oplog/${this.deviceId}_${Date.now()}.enc`;
    const encrypted = await this.encryptText(serializeOpLog(opEntries));
    await this.dav.write(filename, encrypted);

    const ids = unsyncedLogs.map(l => l.id!).filter(Boolean) as number[];
    await db.markLogsSynced(ids);

    return opEntries.length;
  }

  /** 拉取远端新变更并应用 */
  private async pull(): Promise<number> {
    const state = await db.getConfig<{ lastSyncTime: number }>('syncState');
    const lastSync = state?.lastSyncTime ?? 0;

    const files = await this.dav.listOplog();
    const newFiles = files.filter(f => {
      const ts = parseInt(f.split('_')[1] ?? '0');
      return ts > lastSync && !f.startsWith(this.deviceId + '_');
    });

    let applied = 0;
    for (const file of newFiles) {
      const buf = await this.dav.read(`oplog/${file}`);
      if (!buf) continue;
      const text = await this.decryptBuf(buf);
      const ops = deserializeOpLog(text);
      for (const op of ops) {
        await this.applyOp(op);
        applied++;
      }
    }

    if (newFiles.length > 0) {
      await db.setConfig('syncState', { lastSyncTime: Date.now() });
    }

    return applied;
  }

  /** 应用单条远端操作（LWW冲突解决） */
  private async applyOp(op: OpLogEntry): Promise<void> {
    if (op.entryType !== 'entry') return;

    if (op.operation === 'delete') {
      const local = await db.getEntry(op.entryId);
      if (!local || local.updatedAt <= op.timestamp) {
        await db.entries.delete(op.entryId);
      }
      return;
    }

    const remote = op.payload as Entry;
    if (!remote) return;

    // 检测书签加密状态不一致：远端明文（encrypted===false）而本地加密，或反之
    if (remote.type === 'bookmark') {
      const localEncrypt = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
      const remoteEncrypt = remote.encrypted !== false;
      if (localEncrypt !== remoteEncrypt) {
        // 跳过写入，数据不被篡改
        this.encryptMismatchCount++;
        return;
      }
    }

    const local = await db.getEntry(op.entryId);
    if (!local || local.updatedAt <= remote.updatedAt) {
      // 直接写入，绕过 ChangeLog（避免循环同步）
      await db.entries.put(remote);
    }
  }

  /** oplog 超过阈值时压缩为全量快照 */
  private async maybeCompact(): Promise<void> {
    const files = await this.dav.listOplog();
    if (files.length < OPLOG_COMPACT_THRESHOLD) return;

    const allEntries = await db.entries.toArray();
    const snapshot = JSON.stringify(allEntries);
    const encrypted = await this.encryptText(snapshot);
    await this.dav.write('vault.enc', encrypted);

    // 删除旧 oplog
    for (const f of files) {
      await this.dav.remove(`oplog/${f}`);
    }
    await db.setConfig('syncState', { lastSyncTime: Date.now() });
  }

  /** 首次加入：从远端全量快照恢复 */
  async restoreFromVault(): Promise<boolean> {
    const buf = await this.dav.read('vault.enc');
    if (!buf) return false;
    const text = await this.decryptBuf(buf);
    const entries = JSON.parse(text) as Entry[];
    await db.transaction('rw', db.entries, async () => {
      await db.entries.clear();
      await db.entries.bulkPut(entries);
    });
    return true;
  }
}
