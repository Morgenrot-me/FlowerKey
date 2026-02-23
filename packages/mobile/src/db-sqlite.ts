/**
 * 花钥移动端 - SQLite 数据库适配层
 * 替代 @flowerkey/core 的 Dexie/IndexedDB 实现
 * 使用 @capacitor-community/sqlite，数据库文件可被原生层（AutofillService）直接读取
 */

import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { encryptEntry, decryptEntry, ENCRYPTED_FIELDS } from '@flowerkey/core';
import { v4 as uuidv4 } from 'uuid';
import type { Entry, ChangeLog, MasterPasswordData } from '@flowerkey/core';

const DB_NAME = 'flowerkey';
const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: Awaited<ReturnType<SQLiteConnection['createConnection']>> | null = null;

let _dbKey: CryptoKey | null = null;

export function setDbKey(key: CryptoKey) { _dbKey = key; }
export function getDbKey(): CryptoKey { return _dbKey!; }
export function clearDbKey() { _dbKey = null; }

export async function initSQLite() {
  db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, type TEXT, folder TEXT, tags TEXT,
      createdAt INTEGER, updatedAt INTEGER,
      codename TEXT, charsetMode TEXT, passwordLength INTEGER, storedPassword TEXT,
      url TEXT, title TEXT, favicon TEXT, encrypted INTEGER,
      content TEXT, fileName TEXT, sourceUrl TEXT, description TEXT,
      appPackage TEXT
    );
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT, updatedAt INTEGER);
    CREATE TABLE IF NOT EXISTS changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT, entryId TEXT, entryType TEXT,
      operation TEXT, timestamp INTEGER, synced INTEGER, deviceId TEXT
    );
  `);
  // 旧数据库迁移：补充 appPackage 列（已存在时忽略错误）
  try { await db.execute('ALTER TABLE entries ADD COLUMN appPackage TEXT'); } catch {}
  // 迁移：补充 lastUsedAt 列
  try { await db.execute('ALTER TABLE entries ADD COLUMN lastUsedAt INTEGER'); } catch {}
}

// ==================== Entry CRUD ====================

function rowToEntry(row: Record<string, unknown>): Entry {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    encrypted: row.encrypted === 0 ? false : undefined,
    passwordLength: row.passwordLength ? Number(row.passwordLength) : undefined,
  } as unknown as Entry;
}

export async function createEntry(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entry> {
  const now = Date.now();
  const entry: Entry = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
  const stored = await encryptEntry(entry, _dbKey);
  await db!.run(
    `INSERT INTO entries (id,type,folder,tags,createdAt,updatedAt,codename,charsetMode,passwordLength,storedPassword,url,title,favicon,encrypted,content,fileName,sourceUrl,description,appPackage)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [stored.id, stored.type, stored.folder ?? '', JSON.stringify(stored.tags ?? []),
     stored.createdAt, stored.updatedAt, stored.codename ?? null, stored.charsetMode ?? null,
     stored.passwordLength ?? null, stored.storedPassword ?? null, stored.url ?? null,
     stored.title ?? null, stored.favicon ?? null,
     stored.encrypted === false ? 0 : null,
     stored.content ?? null, stored.fileName ?? null, stored.sourceUrl ?? null, stored.description ?? null,
     stored.appPackage ?? null]
  );
  await logChange(entry.id, 'create');
  return entry;
}

export async function updateEntry(id: string, changes: Partial<Entry>): Promise<void> {
  const encChanges = await encryptEntry({ ...changes, id } as Entry, _dbKey);
  const stored: Partial<Entry> = { ...changes, updatedAt: Date.now() };
  for (const field of ENCRYPTED_FIELDS) {
    if (field in changes) (stored as Record<string, unknown>)[field] = (encChanges as Record<string, unknown>)[field];
  }
  const sets = Object.keys(stored).filter(k => k !== 'id').map(k => `${k}=?`).join(',');
  const vals = Object.keys(stored).filter(k => k !== 'id').map(k => {
    const v = (stored as Record<string, unknown>)[k];
    return k === 'tags' ? JSON.stringify(v) : v ?? null;
  });
  await db!.run(`UPDATE entries SET ${sets} WHERE id=?`, [...vals, id]);
  await logChange(id, 'update');
}

export async function deleteEntry(id: string): Promise<void> {
  await db!.run('DELETE FROM entries WHERE id=?', [id]);
  await logChange(id, 'delete');
}

/** 同步专用：直接写入条目，不记录 changelog（避免循环同步） */
export async function putEntry(entry: Entry): Promise<void> {
  const stored = await encryptEntry(entry, _dbKey);
  await db!.run(
    `INSERT OR REPLACE INTO entries (id,type,folder,tags,createdAt,updatedAt,codename,charsetMode,passwordLength,storedPassword,url,title,favicon,encrypted,content,fileName,sourceUrl,description,appPackage)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [stored.id, stored.type, stored.folder ?? '', JSON.stringify(stored.tags ?? []),
     stored.createdAt, stored.updatedAt, stored.codename ?? null, stored.charsetMode ?? null,
     stored.passwordLength ?? null, stored.storedPassword ?? null, stored.url ?? null,
     stored.title ?? null, stored.favicon ?? null,
     stored.encrypted === false ? 0 : null,
     stored.content ?? null, stored.fileName ?? null, stored.sourceUrl ?? null, stored.description ?? null,
     stored.appPackage ?? null]
  );
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  const res = await db!.query('SELECT * FROM entries WHERE id=?', [id]);
  if (!res.values?.length) return undefined;
  return decryptEntry(rowToEntry(res.values[0] as Record<string, unknown>), _dbKey);
}

export async function getEntriesByType(type: Entry['type']): Promise<Entry[]> {
  const res = await db!.query('SELECT * FROM entries WHERE type=? ORDER BY updatedAt DESC', [type]);
  return Promise.all((res.values ?? []).map(r => decryptEntry(rowToEntry(r as Record<string, unknown>), _dbKey)));
}

export async function getAllEntries(): Promise<Entry[]> {
  const res = await db!.query('SELECT * FROM entries ORDER BY updatedAt DESC');
  return Promise.all((res.values ?? []).map(r => decryptEntry(rowToEntry(r as Record<string, unknown>), _dbKey)));
}

export async function getAllFolders(): Promise<string[]> {
  const res = await db!.query('SELECT DISTINCT folder FROM entries WHERE folder IS NOT NULL AND folder != ""');
  return (res.values ?? []).map(r => (r as Record<string, unknown>).folder as string);
}

export async function getAllTags(): Promise<string[]> {
  const res = await db!.query('SELECT tags FROM entries');
  const set = new Set<string>();
  (res.values ?? []).forEach(r => {
    try { (JSON.parse((r as Record<string, unknown>).tags as string) as string[]).forEach(t => set.add(t)); } catch {}
  });
  return Array.from(set).sort();
}

export async function reEncryptAllEntries(oldKey: CryptoKey, newKey: CryptoKey): Promise<void> {
  await db!.run('BEGIN TRANSACTION');
  try {
    const res = await db!.query('SELECT * FROM entries');
    const decrypted = await Promise.all((res.values ?? []).map(r => decryptEntry(rowToEntry(r as Record<string, unknown>), oldKey)));
    for (const entry of decrypted) {
      const stored = await encryptEntry(entry, newKey);
      await db!.run(
        `UPDATE entries SET codename=?,title=?,description=?,fileName=?,sourceUrl=?,storedPassword=?,content=? WHERE id=?`,
        [stored.codename ?? null, stored.title ?? null, stored.description ?? null,
         stored.fileName ?? null, stored.sourceUrl ?? null, stored.storedPassword ?? null, stored.content ?? null, stored.id]
      );
    }
    await db!.run('COMMIT');
  } catch (e) {
    await db!.run('ROLLBACK');
    throw e;
  }
}

// ==================== 配置 ====================

export async function getConfig<T>(key: string): Promise<T | undefined> {
  const res = await db!.query('SELECT value FROM config WHERE key=?', [key]);
  if (!res.values?.length) return undefined;
  try { return JSON.parse((res.values[0] as Record<string, unknown>).value as string) as T; } catch { return undefined; }
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  await db!.run('INSERT OR REPLACE INTO config (key,value,updatedAt) VALUES (?,?,?)',
    [key, JSON.stringify(value), Date.now()]);
}

export async function setSecretConfig(key: string, value: unknown): Promise<void> {
  if (!_dbKey) throw new Error('未解锁');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _dbKey, new TextEncoder().encode(JSON.stringify(value)));
  const combined = new Uint8Array(12 + enc.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(enc), 12);
  await setConfig(key, { __enc: btoa(String.fromCharCode(...combined)) });
}

export async function getSecretConfig<T>(key: string): Promise<T | undefined> {
  const item = await getConfig<{ __enc?: string } | T>(key);
  if (!item) return undefined;
  const v = item as { __enc?: string };
  if (!v?.__enc) return item as T;
  if (!_dbKey) return undefined;
  try {
    const bytes = Uint8Array.from(atob(v.__enc), c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _dbKey, data);
    return JSON.parse(new TextDecoder().decode(dec)) as T;
  } catch { return undefined; }
}

export async function getMasterData(): Promise<MasterPasswordData | undefined> {
  return getConfig<MasterPasswordData>('masterPasswordData');
}

export async function setMasterData(data: MasterPasswordData): Promise<void> {
  await setConfig('masterPasswordData', data);
}

// ==================== 变更日志 ====================

let _deviceId = '';
export function setDeviceId(id: string) { _deviceId = id; }

async function logChange(entryId: string, operation: ChangeLog['operation']) {
  await db!.run(
    'INSERT INTO changelog (entryId,entryType,operation,timestamp,synced,deviceId) VALUES (?,?,?,?,?,?)',
    [entryId, 'entry', operation, Date.now(), 0, _deviceId]
  );
}

export async function getUnsyncedLogs(): Promise<ChangeLog[]> {
  const res = await db!.query('SELECT * FROM changelog WHERE synced=0 ORDER BY timestamp');
  return (res.values ?? []) as unknown as ChangeLog[];
}

export async function markLogsSynced(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db!.run(`UPDATE changelog SET synced=1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

/** 全量同步：为所有条目重新插入 changelog（标记为未同步） */
export async function markAllUnsynced(deviceId: string): Promise<void> {
  const res = await db!.query('SELECT id FROM entries');
  const entries = (res.values ?? []) as { id: string }[];
  await db!.run('DELETE FROM changelog WHERE synced=1');
  for (const e of entries) {
    await db!.run(
      'INSERT INTO changelog (entryId,entryType,operation,timestamp,synced,deviceId) VALUES (?,?,?,?,?,?)',
      [e.id, 'entry', 'upsert', Date.now(), 0, deviceId]
    );
  }
}

export async function updateLastUsed(id: string): Promise<void> {
  await db!.run('UPDATE entries SET lastUsedAt=? WHERE id=?', [Date.now(), id]);
}
