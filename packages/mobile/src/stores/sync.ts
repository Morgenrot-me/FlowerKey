/**
 * 花钥 - 同步状态管理
 * 支持 WebDAV 和 iCloud 两种同步后端
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { SyncEngine, generateDeviceId, type WebDAVConfig, type LocalDbAdapter } from '@flowerkey/core';
import * as sqliteDb from '../db-sqlite';
import { ICloudBackend } from './icloud';
import { NativeWebDAVBackend } from './webdav-native';
import { useMainStore } from './main';

async function ensureDeviceId() {
  let deviceId = await sqliteDb.getConfig<string>('deviceId');
  if (!deviceId) {
    deviceId = generateDeviceId();
    await sqliteDb.setConfig('deviceId', deviceId);
  }
  sqliteDb.setDeviceId(deviceId);
  return deviceId;
}

const sqliteAdapter: LocalDbAdapter = {
  getUnsyncedLogs: () => sqliteDb.getUnsyncedLogs(),
  markLogsSynced: (ids) => sqliteDb.markLogsSynced(ids),
  getEntry: (id) => sqliteDb.getEntry(id),
  putEntry: (entry) => sqliteDb.putEntry(entry),
  deleteEntry: (id) => sqliteDb.deleteEntry(id),
  getAllEntries: () => sqliteDb.getAllEntries(),
  getConfig: (key) => sqliteDb.getConfig(key),
  setConfig: (key, value) => sqliteDb.setConfig(key, value),
};

export type SyncMode = 'webdav' | 'icloud';

export const useSyncStore = defineStore('sync', () => {
  const config = ref<WebDAVConfig | null>(null);
  const syncMode = ref<SyncMode>('webdav');
  const syncing = ref(false);
  const lastResult = ref<{ pushed: number; pulled: number; encryptMismatch?: number; mismatchedBookmarkIds?: string[] } | null>(null);
  const lastSyncTime = ref<number | null>(null);
  const error = ref('');

  async function loadSyncState() {
    const state = await sqliteDb.getConfig<{ lastSyncTime?: number }>('syncState');
    lastSyncTime.value = typeof state?.lastSyncTime === 'number' ? state.lastSyncTime : null;
  }

  async function loadConfig() {
    syncMode.value = (await sqliteDb.getConfig<SyncMode>('syncMode')) ?? 'webdav';
    config.value = await sqliteDb.getSecretConfig<WebDAVConfig>('webdavConfig') ?? null;
    await loadSyncState();
  }

  async function saveConfig(cfg: WebDAVConfig) {
    await sqliteDb.setSecretConfig('webdavConfig', cfg);
    config.value = cfg;
  }

  async function setSyncMode(mode: SyncMode) {
    syncMode.value = mode;
    await sqliteDb.setConfig('syncMode', mode);
  }

  async function sync() {
    const main = useMainStore();
    if (!main.isUnlocked) { error.value = '请先解锁'; return; }
    if (syncMode.value === 'webdav' && !config.value) { error.value = '请先配置 WebDAV'; return; }

    syncing.value = true;
    error.value = '';
    try {
      const deviceId = await ensureDeviceId();
      const backend = syncMode.value === 'icloud'
        ? new ICloudBackend()
        : new NativeWebDAVBackend(config.value!);
      const engine = new SyncEngine(backend, main.getDbKey(), deviceId, sqliteAdapter);
      lastResult.value = await engine.sync();
      await loadSyncState();
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      syncing.value = false;
    }
  }

  async function fullSync() {
    const main = useMainStore();
    if (!main.isUnlocked) { error.value = '请先解锁'; return; }
    if (syncMode.value === 'webdav' && !config.value) { error.value = '请先配置 WebDAV'; return; }
    if (syncing.value) return;
    syncing.value = true;
    error.value = '';
    try {
      const deviceId = await ensureDeviceId();
      await sqliteDb.markAllUnsynced(deviceId);
      const backend = syncMode.value === 'icloud' ? new ICloudBackend() : new NativeWebDAVBackend(config.value!);
      const engine = new SyncEngine(backend, main.getDbKey(), deviceId, sqliteAdapter);
      lastResult.value = await engine.sync();
      await loadSyncState();
    } catch (e) {
      error.value = (e as Error).message || '未知错误';
    } finally {
      syncing.value = false;
    }
  }

  // iCloud 模式下视为"已配置"
  const hasBackend = () => syncMode.value === 'icloud' || !!config.value;

  return { config, syncMode, syncing, lastResult, lastSyncTime, error, loadConfig, saveConfig, setSyncMode, sync, fullSync, hasBackend };
});
