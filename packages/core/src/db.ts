/**
 * 花钥 FlowerKey - 数据层
 * 基于 Dexie.js 封装 IndexedDB，提供 Entry CRUD + ChangeLog 自动记录
 */

import Dexie, { type Table } from 'dexie';
import type { Entry, ChangeLog, UserConfig, SyncState, MasterPasswordData } from './models.js';
import { v4 as uuidv4 } from 'uuid';

export class FlowerKeyDB extends Dexie {
  entries!: Table<Entry, string>;
  changelog!: Table<ChangeLog, number>;
  config!: Table<UserConfig, string>;
  syncState!: Table<SyncState, string>;

  private _deviceId = '';

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

  async createEntry(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entry> {
    const now = Date.now();
    const entry: Entry = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
    await this.transaction('rw', [this.entries, this.changelog], async () => {
      await this.entries.add(entry);
      await this.log(entry.id, 'create');
    });
    return entry;
  }

  async updateEntry(id: string, changes: Partial<Entry>): Promise<void> {
    await this.transaction('rw', [this.entries, this.changelog], async () => {
      await this.entries.update(id, { ...changes, updatedAt: Date.now() });
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
    return this.entries.get(id);
  }

  async getEntriesByType(type: Entry['type']): Promise<Entry[]> {
    return (await this.entries.where('type').equals(type).sortBy('updatedAt')).reverse();
  }

  async getEntriesByFolder(folder: string): Promise<Entry[]> {
    return (await this.entries.where('folder').equals(folder).sortBy('updatedAt')).reverse();
  }

  async searchEntries(query: string): Promise<Entry[]> {
    const q = query.toLowerCase();
    return this.entries.filter(e =>
      (e.codename?.toLowerCase().includes(q)) ||
      (e.title?.toLowerCase().includes(q)) ||
      (e.description?.toLowerCase().includes(q)) ||
      (e.url?.toLowerCase().includes(q)) ||
      (e.fileName?.toLowerCase().includes(q)) ||
      (e.tags?.some(t => t.toLowerCase().includes(q))) || false
    ).toArray();
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
