/**
 * 花钥 FlowerKey - 同步引擎测试
 * 使用内存后端和本地适配器覆盖增量同步、锁和压缩行为
 */
import { describe, expect, it } from 'vitest';
import { deriveDatabaseKey, encrypt } from '../crypto.js';
import type { ChangeLog, Entry } from '../models.js';
import type { StorageBackend } from './backend.js';
import { serializeOpLog, type OpLogEntry } from './changelog.js';
import { type LocalDbAdapter, SyncEngine } from './engine.js';

class MemoryBackend implements StorageBackend {
  files = new Map<string, ArrayBuffer>();
  ensured = false;

  async ensureDir(): Promise<void> {
    this.ensured = true;
  }

  async read(name: string): Promise<ArrayBuffer | null> {
    return this.files.get(name) ?? null;
  }

  async write(name: string, data: ArrayBuffer | string): Promise<void> {
    this.files.set(name, typeof data === 'string' ? new TextEncoder().encode(data).buffer : data);
  }

  async listOplog(): Promise<string[]> {
    return Array.from(this.files.keys())
      .filter(name => name.startsWith('oplog/'))
      .map(name => name.slice('oplog/'.length));
  }

  async remove(name: string): Promise<void> {
    this.files.delete(name);
  }
}

class LockStealBackend extends MemoryBackend {
  syncLockReads = 0;

  async read(name: string): Promise<ArrayBuffer | null> {
    if (name === 'sync.lock') {
      this.syncLockReads++;
      if (this.syncLockReads === 3) {
        await this.write('sync.lock', JSON.stringify({
          deviceId: 'device-b',
          token: 'token-b',
          expires: Date.now() + 30_000,
        }));
      }
    }
    return super.read(name);
  }
}

class MemoryLocal implements LocalDbAdapter {
  logs: ChangeLog[] = [];
  entries = new Map<string, Entry>();
  config = new Map<string, unknown>();
  syncedIds: number[] = [];
  deletedIds: string[] = [];

  async getUnsyncedLogs(): Promise<ChangeLog[]> {
    return this.logs.filter(log => !log.synced);
  }

  async markLogsSynced(ids: number[]): Promise<void> {
    this.syncedIds.push(...ids);
    this.logs = this.logs.map(log => log.id && ids.includes(log.id) ? { ...log, synced: true } : log);
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    return this.entries.get(id);
  }

  async putEntry(entry: Entry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async deleteEntry(id: string): Promise<void> {
    this.deletedIds.push(id);
    this.entries.delete(id);
  }

  async getAllEntries(): Promise<Entry[]> {
    return Array.from(this.entries.values());
  }

  async getConfig<T>(key: string): Promise<T | undefined> {
    return this.config.get(key) as T | undefined;
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    this.config.set(key, value);
  }
}

const passwordEntry = (id: string, updatedAt: number): Entry => ({
  id,
  type: 'password',
  tags: [],
  folder: '',
  description: '',
  codename: id,
  createdAt: updatedAt,
  updatedAt,
});

async function createEngine(deviceId = 'device-a') {
  const backend = new MemoryBackend();
  const local = new MemoryLocal();
  const key = await deriveDatabaseKey('master', 'FlowerKey');
  const engine = new SyncEngine(backend, key, deviceId, local);
  return { backend, local, key, engine };
}

async function encryptedOps(key: CryptoKey, ops: OpLogEntry[]) {
  return encrypt(serializeOpLog(ops), key);
}

describe('SyncEngine', () => {
  it('does not push oplog files when there are no unsynced logs', async () => {
    const { backend, engine } = await createEngine();

    await expect(engine.sync()).resolves.toMatchObject({ pushed: 0, pulled: 0 });

    expect(backend.ensured).toBe(true);
    expect(await backend.listOplog()).toEqual([]);
    await expect(backend.read('sync.lock')).resolves.toBeNull();
  });

  it('pushes local changelog payloads and marks pushed logs synced', async () => {
    const { backend, local, engine } = await createEngine();
    local.entries.set('entry-1', passwordEntry('entry-1', 1000));
    local.logs = [{
      id: 1,
      entryId: 'entry-1',
      entryType: 'entry',
      operation: 'create',
      timestamp: 1000,
      synced: false,
      deviceId: 'device-a',
    }];

    await expect(engine.sync()).resolves.toMatchObject({ pushed: 1, pulled: 0 });

    const oplogs = await backend.listOplog();
    expect(oplogs).toHaveLength(1);
    expect(oplogs[0]).toMatch(/^device-a_\d+\.enc$/);
    expect(local.syncedIds).toEqual([1]);
    expect(local.logs[0].synced).toBe(true);
    await expect(backend.read('sync.lock')).resolves.toBeNull();
  });

  it('pulls remote oplogs, ignores own and old files, and applies LWW operations', async () => {
    const { backend, local, key, engine } = await createEngine('device-a');
    local.config.set('syncState', { lastOplogTime: 1500 });
    local.entries.set('older-local', passwordEntry('older-local', 1000));
    local.entries.set('deleted-local', passwordEntry('deleted-local', 1600));

    await backend.write('oplog/device-a_3000.enc', await encryptedOps(key, [
      { entryId: 'ignored-own', entryType: 'entry', operation: 'create', timestamp: 3000, deviceId: 'device-a', payload: passwordEntry('ignored-own', 3000) },
    ]));
    await backend.write('oplog/device-b_1000.enc', await encryptedOps(key, [
      { entryId: 'ignored-old', entryType: 'entry', operation: 'create', timestamp: 1000, deviceId: 'device-b', payload: passwordEntry('ignored-old', 1000) },
    ]));
    await backend.write('oplog/device-b_3000.enc', await encryptedOps(key, [
      { entryId: 'new-remote', entryType: 'entry', operation: 'create', timestamp: 2100, deviceId: 'device-b', payload: passwordEntry('new-remote', 2100) },
      { entryId: 'older-local', entryType: 'entry', operation: 'update', timestamp: 2200, deviceId: 'device-b', payload: passwordEntry('older-local', 2200) },
      { entryId: 'deleted-local', entryType: 'entry', operation: 'delete', timestamp: 2300, deviceId: 'device-b' },
    ]));

    await expect(engine.sync()).resolves.toMatchObject({ pushed: 0, pulled: 3 });

    expect(local.entries.get('new-remote')?.updatedAt).toBe(2100);
    expect(local.entries.get('older-local')?.updatedAt).toBe(2200);
    expect(local.entries.has('deleted-local')).toBe(false);
    expect(local.entries.has('ignored-own')).toBe(false);
    expect(local.entries.has('ignored-old')).toBe(false);
    expect(local.config.get('syncState')).toMatchObject({ lastOplogTime: 3000 });
  });

  it('ignores legacy remote bookmarks without applying them', async () => {
    const { backend, local, key, engine } = await createEngine();
    const remoteBookmark: Entry = {
      id: 'bookmark-1',
      type: 'bookmark',
      title: 'Plain remote',
      url: 'https://example.com',
      encrypted: false,
      tags: [],
      folder: '',
      description: '',
      createdAt: 1000,
      updatedAt: 1000,
    };
    await backend.write('oplog/device-b_2000.enc', await encryptedOps(key, [
      { entryId: 'bookmark-1', entryType: 'entry', operation: 'create', timestamp: 2000, deviceId: 'device-b', payload: remoteBookmark },
    ]));

    await expect(engine.sync()).resolves.toMatchObject({ pushed: 0, pulled: 1 });

    expect(local.entries.has('bookmark-1')).toBe(false);
  });

  it('prevents two engines from simultaneously acquiring the lock (TOCTOU)', async () => {
    const { backend } = await createEngine('device-a');
    await backend.write('sync.lock', JSON.stringify({ deviceId: 'device-b', token: 'token-b', expires: Date.now() + 30_000 }));

    // 复用同一后端，engine-a 尝试获取锁时应被拒绝
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const local = new MemoryLocal();
    const engineA = new SyncEngine(backend, key, 'device-a', local);
    await expect(engineA.sync()).rejects.toThrow('同步锁被占用');

    const lockRaw = await backend.read('sync.lock');
    const lock = JSON.parse(new TextDecoder().decode(lockRaw!));
    expect(lock.deviceId).toBe('device-b');
  });

  it('does not delete a lock that another device wrote during the TOCTOU recheck', async () => {
    const backend = new LockStealBackend();
    const local = new MemoryLocal();
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const engine = new SyncEngine(backend, key, 'device-a', local);

    await expect(engine.sync()).rejects.toThrow('同步锁被占用');

    const lockRaw = await backend.read('sync.lock');
    expect(lockRaw).not.toBeNull();
    const lock = JSON.parse(new TextDecoder().decode(lockRaw!));
    expect(lock).toMatchObject({ deviceId: 'device-b', token: 'token-b' });
  });

  it('refuses to sync while another device holds a live lock', async () => {
    const { backend, engine } = await createEngine('device-a');
    await backend.write('sync.lock', JSON.stringify({ deviceId: 'device-b', token: 'token', expires: Date.now() + 30_000 }));

    await expect(engine.sync()).rejects.toThrow('同步锁被占用，请稍后重试');

    const lock = await backend.read('sync.lock');
    expect(lock).not.toBeNull();
  });

  it('compacts oplogs into a vault snapshot when the threshold is reached', async () => {
    const { backend, local, engine } = await createEngine();
    local.entries.set('entry-1', passwordEntry('entry-1', 1000));
    local.config.set('syncState', { lastOplogTime: 10_000 });
    for (let i = 0; i < 20; i++) {
      await backend.write(`oplog/device-b_${1000 + i}.enc`, new ArrayBuffer(1));
    }

    await expect(engine.sync()).resolves.toMatchObject({ pushed: 0, pulled: 0 });

    await expect(backend.read('vault.enc')).resolves.not.toBeNull();
    expect(await backend.listOplog()).toEqual([]);
    expect(local.config.get('syncState')).toMatchObject({ lastOplogTime: 10_000, lastVaultOplogTime: 10_000 });
  });
});
