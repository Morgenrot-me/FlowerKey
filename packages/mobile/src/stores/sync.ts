/**
 * 花钥 - 同步状态管理
 * 支持 WebDAV 和 iCloud 两种同步后端
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { SyncEngine, db, type WebDAVConfig } from '@flowerkey/core';
import { ICloudBackend } from './icloud';
import { useMainStore } from './main';

export type SyncMode = 'webdav' | 'icloud';

export const useSyncStore = defineStore('sync', () => {
  const config = ref<WebDAVConfig | null>(null);
  const syncMode = ref<SyncMode>('webdav');
  const syncing = ref(false);
  const lastResult = ref<{ pushed: number; pulled: number; encryptMismatch?: number } | null>(null);
  const error = ref('');

  async function loadConfig() {
    syncMode.value = (await db.getConfig<SyncMode>('syncMode')) ?? 'webdav';
    config.value = await db.getSecretConfig<WebDAVConfig>('webdavConfig') ?? null;
  }

  async function saveConfig(cfg: WebDAVConfig) {
    await db.setSecretConfig('webdavConfig', cfg);
    config.value = cfg;
  }

  async function setSyncMode(mode: SyncMode) {
    syncMode.value = mode;
    await db.setConfig('syncMode', mode);
  }

  async function sync() {
    const main = useMainStore();
    if (!main.isUnlocked) { error.value = '请先解锁'; return; }
    if (syncMode.value === 'webdav' && !config.value) { error.value = '请先配置 WebDAV'; return; }

    syncing.value = true;
    error.value = '';
    try {
      const deviceId = await db.getConfig<string>('deviceId') ?? 'unknown';
      const backend = syncMode.value === 'icloud'
        ? new ICloudBackend()
        : config.value!;
      const engine = new SyncEngine(backend, main.masterPwd, main.userSalt, deviceId);
      lastResult.value = await engine.sync();
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      syncing.value = false;
    }
  }

  // iCloud 模式下视为"已配置"
  const hasBackend = () => syncMode.value === 'icloud' || !!config.value;

  return { config, syncMode, syncing, lastResult, error, loadConfig, saveConfig, setSyncMode, sync, hasBackend };
});
