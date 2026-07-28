/**
 * 花钥 FlowerKey - 数据层
 * 基于 Dexie.js 封装 IndexedDB，提供 Entry CRUD + ChangeLog 自动记录
 */

import Dexie, { type Table } from 'dexie';
import type { Entry, ChangeLog, UserConfig, SyncState, MasterPasswordData } from './models.js';
import {
  encrypt,
  decrypt,
  bytesToBase64,
  base64ToBytes,
  canonicalizeMasterPasswordData,
  isCurrentMasterPasswordData,
} from './crypto.js';
import { v4 as uuidv4 } from 'uuid';

function sortEntriesByRecent(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt));
}

/** 需要加密存储的敏感字段 */
export const ENCRYPTED_FIELDS = ['codename', 'title', 'description', 'fileName', 'sourceUrl', 'storedPassword', 'content'] as const;
export type EncryptedField = typeof ENCRYPTED_FIELDS[number];

/** 加密条目敏感字段，返回存储用对象 */
export async function encryptEntry(entry: Entry, key: CryptoKey | null): Promise<Entry> {
  if (!key || entry.encrypted === false) return entry;
  const result: Entry = { ...entry, encrypted: true };
  for (const field of ENCRYPTED_FIELDS) {
    const val = entry[field as EncryptedField];
    if (val) {
      const buf = await encrypt(val, key);
      (result as unknown as Record<string, unknown>)[field] = bytesToBase64(new Uint8Array(buf));
    }
  }
  return result;
}

/** 解密条目敏感字段 */
export async function decryptEntry(entry: Entry, key: CryptoKey | null): Promise<Entry> {
  if (!key || entry.encrypted === false) return entry;
  const result = { ...entry };
  for (const field of ENCRYPTED_FIELDS) {
    const val = entry[field as EncryptedField];
    if (val) {
      try {
        const bytes = base64ToBytes(val);
        try {
          (result as unknown as Record<string, unknown>)[field] = await decrypt(bytes.buffer as ArrayBuffer, key);
        } catch {
          throw new Error(`字段 ${field} 解密失败，可能密钥错误或数据损坏`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('解密失败')) throw e;
        // atob 失败：非 base64 = 旧明文数据，保持原样
      }
    }
  }
  return result;
}

export class FlowerKeyDB extends Dexie {
  entries!: Table<Entry, string>;
  changelog!: Table<ChangeLog, number>;
  config!: Table<UserConfig, string>;
  syncState!: Table<SyncState, string>;

  private _deviceId = '';
  private _dbKey: CryptoKey | null = null;

  /** 解锁后设置数据库加密密钥 */
  setDbKey(key: CryptoKey) {
    this._dbKey = key;
  }

  /** 获取当前数据库加密密钥 */
  getDbKey(): CryptoKey { return this._dbKey!; }

  /** 清除密钥（锁定时调用） */
  clearDbKey() {
    this._dbKey = null;
  }

  private encryptEntry(entry: Entry) { return encryptEntry(entry, this._dbKey); }
  private decryptEntry(entry: Entry) { return decryptEntry(entry, this._dbKey); }

  constructor() {
    super('FlowerKeyDB');
    this.version(1).stores({
      entries: 'id, type, folder, updatedAt, *tags',
      changelog: '++id, entryId, synced, timestamp',
      config: 'key',
      syncState: 'key',
    });
  }

  /** 设置当前设备ID（应用启动时调用） */
  setDeviceId(id: string) {
    this._deviceId = id;
  }

  /** 记录变更日志 */
  private async log(entryId: string, operation: ChangeLog['operation']) {
    await this.changelog.add({
      entryId,
      entryType: 'entry',
      operation,
      timestamp: Date.now(),
      synced: false,
      deviceId: this._deviceId,
    });
  }

  // ==================== Entry CRUD ====================

  /** 内部数据迁移能力：用新数据库密钥批量重加密条目；不得暴露为普通主密码修改入口。 */
  async reEncryptAllEntries(oldKey: CryptoKey, newKey: CryptoKey): Promise<void> {
    const all = await this.entries.toArray();
    const decrypted = await Promise.all(all.map(e => decryptEntry(e, oldKey)));
    const reEncrypted = await Promise.all(decrypted.map(e => encryptEntry(e, newKey)));
    await this.entries.bulkPut(reEncrypted);
  }

  /** 批量设置书签加密状态（encrypt=true 加密所有书签，false 解密所有书签） */
  async setBookmarkEncryption(encrypt: boolean): Promise<void> {
    const bookmarks = await this.entries.where('type').equals('bookmark').toArray();
    const processed = await Promise.all(bookmarks.map(async (e) => {
      const plain = await this.decryptEntry(e);
      if (encrypt) {
        const { encrypted: _, ...rest } = plain;
        return this.encryptEntry(rest as Entry);
      } else {
        return { ...plain, encrypted: false as const };
      }
    }));
    await this.transaction('rw', [this.entries, this.changelog], async () => {
      await this.entries.bulkPut(processed);
      for (const entry of processed) await this.log(entry.id, 'update');
    });
  }

  async importEntry(entry: Entry): Promise<void> {
    await this.transaction('rw', [this.entries, this.changelog], async () => {
      await this.entries.put(await this.encryptEntry(entry));
      await this.log(entry.id, 'create');
    });
  }

  async createEntry(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entry> {
    const now = Date.now();
    const entry: Entry = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
    const stored = await this.encryptEntry(entry);
    await this.transaction('rw', [this.entries, this.changelog], async () => {
      await this.entries.add(stored);
      await this.log(entry.id, 'create');
    });
    return entry; // 返回明文条目给调用方
  }

  async updateEntry(id: string, changes: Partial<Entry>): Promise<void> {
    const encChanges = await this.encryptEntry({ ...changes, id } as Entry);
    // 只取加密后的敏感字段，保留其他变更
    const stored: Partial<Entry> = { ...changes, updatedAt: Date.now() };
    for (const field of ENCRYPTED_FIELDS) {
      if (field in changes) (stored as unknown as Record<string, unknown>)[field] = (encChanges as unknown as Record<string, unknown>)[field];
    }
    await this.transaction('rw', [this.entries, this.changelog], async () => {
      await this.entries.update(id, stored);
      await this.log(id, 'update');
    });
  }

  async deleteEntry(id: string): Promise<void> {
    await this.transaction('rw', [this.entries, this.changelog], async () => {
      await this.entries.delete(id);
      await this.log(id, 'delete');
    });
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    const entry = await this.entries.get(id);
    return entry ? this.decryptEntry(entry) : undefined;
  }

  async getEntriesByType(type: Entry['type']): Promise<Entry[]> {
    const rows = await this.entries.where('type').equals(type).toArray();
    const decrypted = await Promise.all(rows.map(e => this.decryptEntry(e)));
    return sortEntriesByRecent(decrypted);
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.entries.update(id, { lastUsedAt: Date.now() });
  }

  async getEntriesByFolder(folder: string): Promise<Entry[]> {
    const rows = await this.entries.where('folder').equals(folder).toArray();
    const decrypted = await Promise.all(rows.map(e => this.decryptEntry(e)));
    return sortEntriesByRecent(decrypted);
  }

  async searchEntries(query: string): Promise<Entry[]> {
    // 先全量读取并解密，再在内存中过滤
    const all = await this.entries.toArray();
    const decrypted = await Promise.all(all.map(e => this.decryptEntry(e)));
    const q = query.toLowerCase();
    return sortEntriesByRecent(decrypted.filter(e =>
      (e.codename?.toLowerCase().includes(q)) ||
      (e.title?.toLowerCase().includes(q)) ||
      (e.description?.toLowerCase().includes(q)) ||
      (e.url?.toLowerCase().includes(q)) ||
      (e.fileName?.toLowerCase().includes(q)) ||
      (e.tags?.some(t => t.toLowerCase().includes(q))) || false
    ));
  }

  // ==================== 配置管理 ====================

  async getConfig<T>(key: string): Promise<T | undefined> {
    const item = await this.config.get(key);
    return item?.value as T | undefined;
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    await this.config.put({ key, value, updatedAt: Date.now() });
  }

  /** 获取/保存主密码验证数据 */
  async getMasterData(): Promise<MasterPasswordData | undefined> {
    const value = await this.getConfig<unknown>('masterPasswordData');
    return isCurrentMasterPasswordData(value) ? value : undefined;
  }

  async getMasterDataStatus(): Promise<'missing' | 'current' | 'unsupported'> {
    const value = await this.getConfig<unknown>('masterPasswordData');
    if (value === undefined) return 'missing';
    return isCurrentMasterPasswordData(value) ? 'current' : 'unsupported';
  }

  /** 首次初始化：事务内仅在配置完全不存在时创建，拒绝陈旧页面覆盖。 */
  async createMasterData(data: MasterPasswordData): Promise<void> {
    const canonical = canonicalizeMasterPasswordData(data);
    await this.transaction('rw', this.config, async () => {
      const existing = await this.config.get('masterPasswordData');
      if (existing) {
        if (!isCurrentMasterPasswordData(existing.value)) {
          throw new Error('检测到发布前或损坏的身份密语数据，请先清除本地开发数据');
        }
        throw new Error('花钥已经完成初始化，不能覆盖主密码和身份密语');
      }
      await this.config.put({
        key: 'masterPasswordData',
        value: canonical,
        updatedAt: Date.now(),
      });
    });
  }

  /** 更新恢复码等附属字段：只允许更新已经存在的正式对象。 */
  async setMasterData(data: MasterPasswordData): Promise<void> {
    const canonical = canonicalizeMasterPasswordData(data);
    await this.transaction('rw', this.config, async () => {
      const existing = await this.config.get('masterPasswordData');
      if (!existing) throw new Error('花钥尚未初始化');
      if (!isCurrentMasterPasswordData(existing.value)) {
        throw new Error('检测到发布前或损坏的身份密语数据，请先清除本地开发数据');
      }
      await this.config.put({
        key: 'masterPasswordData',
        value: canonical,
        updatedAt: Date.now(),
      });
    });
  }

  /** 加密存储敏感配置（如 WebDAV 密码），需解锁后调用 */
  async setSecretConfig(key: string, value: unknown): Promise<void> {
    if (!this._dbKey) throw new Error('未解锁');
    const buf = await encrypt(JSON.stringify(value), this._dbKey);
    const b64 = bytesToBase64(new Uint8Array(buf));
    await this.config.put({ key, value: { __enc: b64 }, updatedAt: Date.now() });
  }

  /** 读取加密配置 */
  async getSecretConfig<T>(key: string): Promise<T | undefined> {
    const item = await this.config.get(key);
    if (!item) return undefined;
    const v = item.value as { __enc?: string };
    if (!v?.__enc) return item.value as T; // 兼容旧明文数据
    if (!this._dbKey) return undefined;
    try {
      const bytes = base64ToBytes(v.__enc);
      return JSON.parse(await decrypt(bytes.buffer as ArrayBuffer, this._dbKey)) as T;
    } catch { return undefined; }
  }

  // ==================== 同步相关 ====================

  async getUnsyncedLogs(): Promise<ChangeLog[]> {
    return this.changelog.where('synced').equals(0).sortBy('timestamp');
  }

  async markLogsSynced(ids: number[]): Promise<void> {
    await this.changelog.where('id').anyOf(ids).modify({ synced: true });
  }

  /** 获取所有文件夹路径（去重） */
  async getAllFolders(): Promise<string[]> {
    const entries = await this.entries.orderBy('folder').uniqueKeys();
    return (entries as string[]).filter(Boolean);
  }

  /** 获取所有标签（去重） */
  async getAllTags(): Promise<string[]> {
    const set = new Set<string>();
    await this.entries.each(e => e.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }

  /** 按 URL 查找书签（用于重复检测） */
  async getBookmarkByUrl(url: string): Promise<Entry | undefined> {
    const row = await this.entries.where('type').equals('bookmark').filter(e => e.url === url).first();
    return row ? this.decryptEntry(row) : undefined;
  }

  /** 批量导入书签（跳过已存在 URL） */
  async importBookmarks(items: { title: string; url: string; favicon?: string }[], encrypt: boolean): Promise<number> {
    let count = 0;
    for (const item of items) {
      const exists = await this.entries.where('type').equals('bookmark').filter(e => e.url === item.url).count();
      if (exists) continue;
      const entry: Entry = {
        id: crypto.randomUUID(), type: 'bookmark',
        title: item.title, url: item.url, favicon: item.favicon,
        tags: [], folder: '', description: '',
        createdAt: Date.now(), updatedAt: Date.now(),
        ...(encrypt ? {} : { encrypted: false }),
      };
      await this.transaction('rw', [this.entries, this.changelog], async () => {
        await this.entries.put(encrypt ? await this.encryptEntry(entry) : entry);
        await this.log(entry.id, 'create');
      });
      count++;
    }
    return count;
  }
}

/** 全局数据库单例 */
export const db = new FlowerKeyDB();
