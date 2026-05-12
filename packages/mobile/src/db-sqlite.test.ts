/**
 * 花钥移动端 - SQLite 数据库适配层测试
 * 覆盖移动端 SQLite 写入字段，防止同步写入丢失本地排序所需元数据。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '@flowerkey/core';

const dbRunMock = vi.hoisted(() => vi.fn());
const dbQueryMock = vi.hoisted(() => vi.fn());
const dbExecuteMock = vi.hoisted(() => vi.fn());

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    async createConnection() {
      return {
        open: vi.fn(),
        execute: dbExecuteMock,
        run: dbRunMock,
        query: dbQueryMock,
      };
    }
  },
}));

vi.mock('@flowerkey/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@flowerkey/core')>();
  return {
    ...actual,
    encryptEntry: vi.fn(async (entry: Entry) => entry),
    decryptEntry: vi.fn(async (entry: Entry) => entry),
    encrypt: vi.fn(async (text: string) => new TextEncoder().encode(text).buffer),
    decrypt: vi.fn(async (data: ArrayBuffer) => new TextDecoder().decode(data)),
  };
});

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'entry-id'),
}));

describe('mobile db-sqlite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists lastUsedAt when sync writes an entry directly', async () => {
    const sqliteDb = await import('./db-sqlite.js');
    await sqliteDb.initSQLite();

    const entry: Entry = {
      id: 'password-1',
      type: 'password',
      tags: [],
      folder: '',
      description: '',
      codename: 'github',
      createdAt: 1000,
      updatedAt: 2000,
      lastUsedAt: 3000,
    };

    await sqliteDb.putEntry(entry);

    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('lastUsedAt'),
      expect.arrayContaining([3000]),
    );
  });

  it('markAllUnsynced inserts update operations, not create', async () => {
    const sqliteDb = await import('./db-sqlite.js');
    await sqliteDb.initSQLite();

    dbQueryMock.mockResolvedValueOnce({
      values: [{ id: 'entry-1' }, { id: 'entry-2' }],
    });

    await sqliteDb.markAllUnsynced('device-test');

    // 先删除旧 changelog
    expect(dbRunMock).toHaveBeenCalledWith(
      'DELETE FROM changelog WHERE synced=1',
    );

    // 后续两次 INSERT 使用 'update' 操作
    const insertCalls = dbRunMock.mock.calls.filter((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO changelog')
    );
    expect(insertCalls).toHaveLength(2);
    for (const call of insertCalls) {
      expect(call[1][2]).toBe('update');
    }
  });

  it('getSecretConfig decrypts with version-aware decrypt function', async () => {
    const sqliteDb = await import('./db-sqlite.js');
    await sqliteDb.initSQLite();
    sqliteDb.setDbKey({} as CryptoKey);

    const { decrypt } = await import('@flowerkey/core');
    const mockDecrypt = decrypt as ReturnType<typeof vi.fn>;
    mockDecrypt.mockResolvedValueOnce(JSON.stringify({ url: 'https://example.com', username: 'test' }));

    dbQueryMock.mockResolvedValueOnce({
      values: [{ value: JSON.stringify({ __enc: 'AQAAAAAAAAAAAAAAAAAAAAAKFBQ=' }) }],
    });

    const result = await sqliteDb.getSecretConfig('webdavConfig');
    expect(result).toEqual({ url: 'https://example.com', username: 'test' });
  });

  it('getSecretConfig returns undefined when dbKey is null', async () => {
    const sqliteDb = await import('./db-sqlite.js');
    await sqliteDb.initSQLite();
    sqliteDb.clearDbKey();

    dbQueryMock.mockResolvedValueOnce({
      values: [{ value: JSON.stringify({ __enc: 'AAAA' }) }],
    });

    const result = await sqliteDb.getSecretConfig('webdavConfig');
    expect(result).toBeUndefined();
  });

  it('setSecretConfig throws when dbKey is null', async () => {
    const sqliteDb = await import('./db-sqlite.js');
    await sqliteDb.initSQLite();
    sqliteDb.clearDbKey();

    await expect(sqliteDb.setSecretConfig('key', 'value')).rejects.toThrow('未解锁');
  });
});
