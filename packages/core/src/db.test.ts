/**
 * 花钥 FlowerKey - 数据层测试
 * 覆盖 IndexedDB CRUD、敏感字段加密和配置加密的关键行为
 */
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deriveDatabaseKey } from './crypto.js';
import { decryptEntry, encryptEntry, FlowerKeyDB, ENCRYPTED_FIELDS } from './db.js';
import type { Entry } from './models.js';

const baseEntry: Entry = {
  id: 'entry-1',
  type: 'password',
  tags: ['work'],
  folder: 'accounts',
  description: 'primary account',
  codename: 'github',
  url: 'https://github.com',
  appPackage: 'com.github.android',
  storedPassword: 'stored-secret',
  createdAt: 1000,
  updatedAt: 1000,
};

function createDb() {
  const instance = new FlowerKeyDB();
  instance.setDeviceId('device-a');
  return instance;
}

describe('entry encryption helpers', () => {
  it('encrypts sensitive fields while preserving searchable plaintext fields', async () => {
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const encrypted = await encryptEntry(baseEntry, key);

    expect(encrypted.encrypted).toBe(true);
    expect(encrypted.codename).not.toBe(baseEntry.codename);
    expect(encrypted.description).not.toBe(baseEntry.description);
    expect(encrypted.storedPassword).not.toBe(baseEntry.storedPassword);
    expect(encrypted.url).toBe(baseEntry.url);
    expect(encrypted.appPackage).toBe(baseEntry.appPackage);
    expect(encrypted.tags).toEqual(baseEntry.tags);

    await expect(decryptEntry(encrypted, key)).resolves.toMatchObject(baseEntry);
  });

  it('leaves explicitly plaintext bookmarks unencrypted', async () => {
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const bookmark: Entry = {
      ...baseEntry,
      type: 'bookmark',
      title: 'Example',
      encrypted: false,
    };

    await expect(encryptEntry(bookmark, key)).resolves.toEqual(bookmark);
    await expect(decryptEntry(bookmark, key)).resolves.toEqual(bookmark);
  });

  it('returns entry unchanged when key is null', async () => {
    const entry: Entry = {
      id: 'e1', type: 'password',
      codename: 'test', description: 'desc',
      tags: [], folder: '', createdAt: 1, updatedAt: 1,
    };
    await expect(encryptEntry(entry, null)).resolves.toEqual(entry);
    await expect(decryptEntry(entry, null)).resolves.toEqual(entry);
  });

  it('skips empty string encrypted fields', async () => {
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const entry: Entry = {
      id: 'e1', type: 'password',
      codename: 'test', description: '',
      tags: [], folder: '', createdAt: 1, updatedAt: 1,
    };
    const encrypted = await encryptEntry(entry, key);
    // 空 description 应保持原样（falsy 值跳过加密）
    expect(encrypted.description).toBe('');
    // codename 非空，应被加密
    expect(encrypted.codename).not.toBe('test');
  });

  it('throws a field-specific error when encrypted data is opened with the wrong key', async () => {
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const wrongKey = await deriveDatabaseKey('other-master', 'FlowerKey');
    const encrypted = await encryptEntry(baseEntry, key);

    await expect(decryptEntry(encrypted, wrongKey)).rejects.toThrow('字段 codename 解密失败');
  });

  it('encrypts all declared fields', () => {
    expect(ENCRYPTED_FIELDS).toContain('codename');
    expect(ENCRYPTED_FIELDS).toContain('storedPassword');
    expect(ENCRYPTED_FIELDS).toContain('title');
    expect(ENCRYPTED_FIELDS).toContain('content');
  });
});

describe('FlowerKeyDB', () => {
  let database: FlowerKeyDB;

  beforeEach(async () => {
    await Dexie.delete('FlowerKeyDB');
    database = createDb();
    database.setDbKey(await deriveDatabaseKey('master', 'FlowerKey'));
  });

  afterEach(async () => {
    database.close();
    await Dexie.delete(database.name);
  });

  it('creates, updates, searches, sorts and deletes entries with changelog records', async () => {
    const older = await database.createEntry({
      type: 'password',
      tags: ['old'],
      folder: '',
      description: 'old account',
      codename: 'old-account',
    });
    const newer = await database.createEntry({
      type: 'password',
      tags: ['new'],
      folder: '',
      description: 'new account',
      codename: 'new-account',
    });

    await database.entries.update(older.id, { updatedAt: 1000 });
    await database.entries.update(newer.id, { updatedAt: 2000 });
    await database.updateEntry(older.id, { description: 'updated searchable text', tags: ['updated'] });
    await database.touchLastUsed(older.id);

    const byType = await database.getEntriesByType('password');
    expect(byType[0].id).toBe(older.id);
    expect(byType[0].description).toBe('updated searchable text');

    const search = await database.searchEntries('searchable');
    expect(search).toHaveLength(1);
    expect(search[0].id).toBe(older.id);

    await database.deleteEntry(newer.id);
    await expect(database.getEntry(newer.id)).resolves.toBeUndefined();

    const logs = await database.changelog.toArray();
    expect(logs.map(log => log.operation)).toEqual(['create', 'create', 'update', 'delete']);
    expect(logs.every(log => log.deviceId === 'device-a')).toBe(true);
  });

  it('returns encrypted fields until the current context has a database key', async () => {
    const created = await database.createEntry({
      type: 'password',
      tags: [],
      folder: '',
      description: 'account note',
      codename: 'github',
    });

    database.clearDbKey();
    const encryptedRows = await database.getEntriesByType('password');
    expect(encryptedRows[0].id).toBe(created.id);
    expect(encryptedRows[0].codename).not.toBe('github');
    expect(encryptedRows[0].description).not.toBe('account note');

    database.setDbKey(await deriveDatabaseKey('master', 'FlowerKey'));
    const decryptedRows = await database.getEntriesByType('password');
    expect(decryptedRows[0]).toMatchObject({
      id: created.id,
      codename: 'github',
      description: 'account note',
    });
  });

  it('returns empty array for unknown entry type', async () => {
    const result = await database.getEntriesByType('note');
    expect(result).toEqual([]);
  });

  it('returns undefined for non-existent entry', async () => {
    await expect(database.getEntry('non-existent')).resolves.toBeUndefined();
  });

  it('getEntriesByFolder returns sorted by recent', async () => {
    const e1 = await database.createEntry({
      type: 'password', codename: 'a', tags: [], folder: 'work', description: '',
    });
    const e2 = await database.createEntry({
      type: 'password', codename: 'b', tags: [], folder: 'work', description: '',
    });
    await database.entries.update(e1.id, { updatedAt: 1000 });
    await database.entries.update(e2.id, { updatedAt: 2000 });

    const folder = await database.getEntriesByFolder('work');
    expect(folder).toHaveLength(2);
    expect(folder[0].id).toBe(e2.id);
  });

  it('searchEntries finds by tag', async () => {
    await database.createEntry({
      type: 'password', codename: 'tagged', tags: ['finance', 'bank'], folder: '', description: '',
    });
    const results = await database.searchEntries('finance');
    expect(results).toHaveLength(1);
    expect(results[0].codename).toBe('tagged');
  });

  it('searchEntries returns empty for no match', async () => {
    const results = await database.searchEntries('nothing-matches-this');
    expect(results).toEqual([]);
  });

  it('stores normal config plainly and secret config encrypted after unlock', async () => {
    await database.setConfig('theme', 'dark');
    await expect(database.getConfig('theme')).resolves.toBe('dark');

    await database.setSecretConfig('webdav', { username: 'alice', password: 'secret' });
    const stored = await database.config.get('webdav');

    expect(stored?.value).toHaveProperty('__enc');
    expect(JSON.stringify(stored?.value)).not.toContain('secret');
    await expect(database.getSecretConfig('webdav')).resolves.toEqual({ username: 'alice', password: 'secret' });

    database.clearDbKey();
    await expect(database.setSecretConfig('blocked', 'value')).rejects.toThrow('未解锁');
    await expect(database.getSecretConfig('webdav')).resolves.toBeUndefined();
  });

  it('clears encrypted fields when updateEntry receives undefined', async () => {
    const created = await database.createEntry({
      type: 'password',
      tags: [],
      folder: '',
      description: '',
      codename: 'github',
      storedPassword: 'old-secret',
    });

    await database.updateEntry(created.id, {
      charsetMode: 'alphanumeric',
      passwordLength: 16,
      storedPassword: undefined,
    });

    const updated = await database.getEntry(created.id);
    expect(updated?.storedPassword).toBeUndefined();
    expect(updated?.charsetMode).toBe('alphanumeric');
    expect(updated?.passwordLength).toBe(16);
  });

  it('getSecretConfig returns plain value for non-encrypted legacy config', async () => {
    await database.setConfig('legacy-key', { plain: 'value' });
    const result = await database.getSecretConfig('legacy-key');
    expect(result).toEqual({ plain: 'value' });
  });

  it('imports bookmarks once per url and records changelog entries', async () => {
    const imported = await database.importBookmarks([
      { title: 'Example', url: 'https://example.com' },
      { title: 'Example duplicate', url: 'https://example.com' },
      { title: 'Docs', url: 'https://docs.example.com', favicon: 'icon.png' },
    ], false);

    expect(imported).toBe(2);
    await expect(database.getBookmarkByUrl('https://example.com')).resolves.toMatchObject({
      title: 'Example',
      encrypted: false,
    });
    await expect(database.changelog.count()).resolves.toBe(2);
  });

  it('reEncryptAllEntries re-encrypts with new key', async () => {
    const oldKey = await deriveDatabaseKey('master', 'FlowerKey');
    const newKey = await deriveDatabaseKey('new-master', 'FlowerKey');

    await database.createEntry({
      type: 'password', codename: 're-enc', description: 'before',
      tags: [], folder: '',
    });

    await database.reEncryptAllEntries(oldKey, newKey);
    database.setDbKey(newKey);

    const entries = await database.getEntriesByType('password');
    expect(entries).toHaveLength(1);
    expect(entries[0].codename).toBe('re-enc');
    expect(entries[0].description).toBe('before');
  });

  it('getAllFolders returns distinct non-empty folders', async () => {
    await database.createEntry({
      type: 'password', codename: 'a', tags: [], folder: 'work', description: '',
    });
    await database.createEntry({
      type: 'password', codename: 'b', tags: [], folder: 'work', description: '',
    });
    await database.createEntry({
      type: 'password', codename: 'c', tags: [], folder: 'personal', description: '',
    });
    await database.createEntry({
      type: 'password', codename: 'd', tags: [], folder: '', description: '',
    });

    const folders = await database.getAllFolders();
    expect(folders).toEqual(expect.arrayContaining(['work', 'personal']));
    expect(folders).not.toContain('');
  });

  it('getAllTags returns distinct sorted tags across all entries', async () => {
    await database.createEntry({
      type: 'password', codename: 'a', tags: ['github', 'work'], folder: '', description: '',
    });
    await database.createEntry({
      type: 'password', codename: 'b', tags: ['github', 'personal'], folder: '', description: '',
    });

    const allTags = await database.getAllTags();
    expect(allTags).toEqual(['github', 'personal', 'work']);
  });

  it('setBookmarkEncryption toggles encryption for all bookmarks', async () => {
    await database.importBookmarks([
      { title: 'Plain', url: 'https://plain.example.com' },
    ], false);

    // 从明文切换到加密
    await database.setBookmarkEncryption(true);
    const encrypted = await database.entries.where('type').equals('bookmark').first();
    expect(encrypted?.title).not.toBe('Plain');

    // 从加密切换回明文
    await database.setBookmarkEncryption(false);
    const plain = await database.entries.where('type').equals('bookmark').first();
    expect(plain?.encrypted).toBe(false);
    expect(plain?.title).toBe('Plain');
  });
});
