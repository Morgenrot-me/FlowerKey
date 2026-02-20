/**
 * 花钥 - 同步状态管理
 * 管理 WebDAV 配置和同步操作
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { SyncEngine, db, type WebDAVConfig } from '@flowerkey/core';
import { useMainStore } from './main';

export const useSyncStore = defineStore('sync', () => {
  const config = ref<WebDAVConfig | null>(null);
  const syncing = ref(false);
  const lastResult = ref<{ pushed: number; pulled: number; encryptMismatch?: number } | null>(null);
  const error = ref('');

  async function loadConfig() {
    config.value = await db.getSecretConfig<WebDAVConfig>('webdavConfig') ?? null;
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
      const deviceId = await db.getConfig<string>('deviceId') ?? 'unknown';
      const engine = new SyncEngine(config.value, main.masterPwd, main.userSalt, deviceId);
      lastResult.value = await engine.sync();
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      syncing.value = false;
    }
  }

  return { config, syncing, lastResult, error, loadConfig, saveConfig, sync };
});
