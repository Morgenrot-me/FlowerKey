/**
 * 花钥 - 同步状态管理
 * 管理 WebDAV 配置和同步操作
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { SyncEngine, db, generateDeviceId, type WebDAVConfig } from '@flowerkey/core';
import { useMainStore } from './main';

async function ensureDeviceId() {
  let deviceId = await db.getConfig<string>('deviceId');
  if (!deviceId) {
    deviceId = generateDeviceId();
    await db.setConfig('deviceId', deviceId);
  }
  db.setDeviceId(deviceId);
  return deviceId;
}

export const useSyncStore = defineStore('sync', () => {
  const config = ref<WebDAVConfig | null>(null);
  const syncing = ref(false);
  const lastResult = ref<{ pushed: number; pulled: number; encryptMismatch?: number; mismatchedBookmarkIds?: string[] } | null>(null);
  const lastSyncTime = ref<number | null>(null);
  const error = ref('');

  async function loadSyncState() {
    const state = await db.getConfig<{ lastSyncTime?: number }>('syncState');
    lastSyncTime.value = typeof state?.lastSyncTime === 'number' ? state.lastSyncTime : null;
  }

  async function loadConfig() {
    config.value = await db.getSecretConfig<WebDAVConfig>('webdavConfig') ?? null;
    await loadSyncState();
  }

  async function saveConfig(cfg: WebDAVConfig) {
    await db.setSecretConfig('webdavConfig', cfg);
    config.value = cfg;
  }

  async function sync() {
    if (!config.value) { error.value = '请先配置 WebDAV'; return; }
    const main = useMainStore();
    if (!main.isUnlocked) { error.value = '请先解锁'; return; }

    syncing.value = true;
    error.value = '';
    try {
      const deviceId = await ensureDeviceId();
      const engine = new SyncEngine(config.value, main.getDbKey(), deviceId);
      lastResult.value = await engine.sync();
      await loadSyncState();
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      syncing.value = false;
    }
  }

  return { config, syncing, lastResult, lastSyncTime, error, loadConfig, saveConfig, sync };
});
