/**
 * 花钥 FlowerKey - 数据层
 * 基于 Dexie.js 封装 IndexedDB，提供 Entry CRUD + ChangeLog 自动记录
 */

import Dexie, { type Table } from 'dexie';
import type { Entry, ChangeLog, UserConfig, SyncState, MasterPasswordData } from './models.js';
import { encrypt, decrypt } from './crypto.js';
import { v4 as uuidv4 } from 'uuid';

/** 需要加密存储的敏感字段 */
const ENCRYPTED_FIELDS = ['codename', 'url', 'title', 'description', 'fileName', 'sourceUrl'] as const;
type EncryptedField = typeof ENCRYPTED_FIELDS[number];

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

  /** 清除密钥（锁定时调用） */
  clearDbKey() {
    this._dbKey = null;
  }

  /** 加密条目敏感字段，返回存储用对象 */
  private async encryptEntry(entry: Entry): Promise<Entry> {
    if (!this._dbKey || entry.encrypted === false) return entry;
    const result = { ...entry };
    for (const field of ENCRYPTED_FIELDS) {
      const val = entry[field as EncryptedField];
      if (val) {
        const buf = await encrypt(val, this._dbKey);
        // 存为 base64 字符串
        (result as unknown as Record<string, unknown>)[field] = btoa(String.fromCharCode(...new Uint8Array(buf)));
      }
    }
    return result;
  }

  /** 解密条目敏感字段 */
  private async decryptEntry(entry: Entry): Promise<Entry> {
    if (!this._dbKey || entry.encrypted === false) return entry;
    const result = { ...entry };
    for (const field of ENCRYPTED_FIELDS) {
      const val = entry[field as EncryptedField];
      if (val) {
        try {
          const bytes = Uint8Array.from(atob(val), c => c.charCodeAt(0));
          (result as unknown as Record<string, unknown>)[field] = await decrypt(bytes.buffer as ArrayBuffer, this._dbKey);
        } catch {
          // 非加密数据（旧数据）保持原样
        }
      }
    }
    return result;
  }

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

  /** 修改主密码时批量重加密所有条目（旧 key → 新 key） */
  async reEncryptAllEntries(oldKey: CryptoKey, newKey: CryptoKey): Promise<void> {
    const all = await this.entries.toArray();
    this._dbKey = oldKey;
    const decrypted = await Promise.all(all.map(e => this.decryptEntry(e)));
    this._dbKey = newKey;
    const reEncrypted = await Promise.all(decrypted.map(e => this.encryptEntry(e)));
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
    await this.entries.bulkPut(processed);
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
    const rows = (await this.entries.where('type').equals(type).sortBy('updatedAt')).reverse();
    return Promise.all(rows.map(e => this.decryptEntry(e)));
  }

  async getEntriesByFolder(folder: string): Promise<Entry[]> {
    const rows = (await this.entries.where('folder').equals(folder).sortBy('updatedAt')).reverse();
    return Promise.all(rows.map(e => this.decryptEntry(e)));
  }

  async searchEntries(query: string): Promise<Entry[]> {
    // 先全量读取并解密，再在内存中过滤
    const all = await this.entries.toArray();
    const decrypted = await Promise.all(all.map(e => this.decryptEntry(e)));
    const q = query.toLowerCase();
    return decrypted.filter(e =>
      (e.codename?.toLowerCase().includes(q)) ||
      (e.title?.toLowerCase().includes(q)) ||
      (e.description?.toLowerCase().includes(q)) ||
      (e.url?.toLowerCase().includes(q)) ||
      (e.fileName?.toLowerCase().includes(q)) ||
      (e.tags?.some(t => t.toLowerCase().includes(q))) || false
    );
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
    return this.getConfig<MasterPasswordData>('masterPasswordData');
  }

  async setMasterData(data: MasterPasswordData): Promise<void> {
    await this.setConfig('masterPasswordData', data);
  }

  /** 加密存储敏感配置（如 WebDAV 密码），需解锁后调用 */
  async setSecretConfig(key: string, value: unknown): Promise<void> {
    if (!this._dbKey) throw new Error('未解锁');
    const buf = await encrypt(JSON.stringify(value), this._dbKey);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
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
      const bytes = Uint8Array.from(atob(v.__enc), c => c.charCodeAt(0));
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
    return entries as string[];
  }

  /** 获取所有标签（去重） */
  async getAllTags(): Promise<string[]> {
    const set = new Set<string>();
    await this.entries.each(e => e.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }
}

/** 全局数据库单例 */
export const db = new FlowerKeyDB();
