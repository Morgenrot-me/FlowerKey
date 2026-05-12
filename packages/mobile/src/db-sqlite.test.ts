/**
 * 花钥移动端 - SQLite 数据库适配层测试
 * 覆盖移动端 SQLite 写入字段，防止同步写入丢失本地排序所需元数据。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '@flowerkey/core';

const dbRunMock = vi.hoisted(() => vi.fn());
const dbExecuteMock = vi.hoisted(() => vi.fn());

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    async createConnection() {
      return {
        open: vi.fn(),
        execute: dbExecuteMock,
        run: dbRunMock,
        query: vi.fn(),
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
    encrypt: vi.fn(),
    decrypt: vi.fn(),
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
});
