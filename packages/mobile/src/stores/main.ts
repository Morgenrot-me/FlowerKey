/**
 * 花钥移动端 - 主状态管理
 * 认证状态、密码生成，使用 SQLite db 适配层
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { generateDeviceId, createMasterPasswordData, openMasterPasswordData, generatePassword, deriveDatabaseKey,
  generateRecoveryCode, encryptMasterPwdWithRecovery, decryptMasterPwdWithRecovery,
  runDirectPasswordFlow,
  type Entry, type CharsetMode, type DirectComputeMode } from '@flowerkey/core';
import * as sqliteDb from '../db-sqlite';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Android 原生 Plugin：同步解锁状态供 AutofillService 使用
const AutofillState = registerPlugin<{
  setUnlocked(opts: { masterPwd: string; userSalt: string }): Promise<void>;
  setLocked(): Promise<void>;
  checkEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
}>('AutofillState');

function syncAutofillState(pwd: string, salt: string) {
  if (Capacitor.getPlatform() === 'android')
    AutofillState.setUnlocked({ masterPwd: pwd, userSalt: salt }).catch(() => {});
}
function clearAutofillState() {
  if (Capacitor.getPlatform() === 'android')
    AutofillState.setLocked().catch(() => {});
}

async function ensureDeviceId() {
  let deviceId = await sqliteDb.getConfig<string>('deviceId');
  if (!deviceId) {
    deviceId = generateDeviceId();
    await sqliteDb.setConfig('deviceId', deviceId);
  }
  sqliteDb.setDeviceId(deviceId);
  return deviceId;
}

export const useMainStore = defineStore('main', () => {
  const isUnlocked = ref(false);
  const isSetup = ref(false);
  const hasUnsupportedMasterData = ref(false);
  const masterPwd = ref('');
  const userSalt = ref('');

  async function checkSetup() {
    const status = await sqliteDb.getMasterDataStatus();
    isSetup.value = status === 'current';
    hasUnsupportedMasterData.value = status === 'unsupported';
    if (isSetup.value) await ensureDeviceId();
    return isSetup.value;
  }

  async function setup(pwd: string, identitySecret: string) {
    if (hasUnsupportedMasterData.value) {
      throw new Error('检测到发布前或损坏的身份密语数据，请先清除本地开发数据');
    }
    const data = await createMasterPasswordData(pwd, identitySecret);
    await sqliteDb.createMasterData(data);
    const s = identitySecret.normalize('NFC');
    await ensureDeviceId();
    masterPwd.value = pwd;
    userSalt.value = s;
    isSetup.value = true;
    isUnlocked.value = true;
    sqliteDb.setDbKey(await deriveDatabaseKey(pwd, s));
    syncAutofillState(pwd, s);
  }

  async function unlock(pwd: string): Promise<boolean> {
    const data = await sqliteDb.getMasterData();
    if (!data) return false;
    const identitySecret = await openMasterPasswordData(pwd, data);
    if (identitySecret) {
      masterPwd.value = pwd;
      userSalt.value = identitySecret;
      isUnlocked.value = true;
      sqliteDb.setDbKey(await deriveDatabaseKey(pwd, identitySecret));
      await ensureDeviceId();
      syncAutofillState(pwd, identitySecret);
    }
    return !!identitySecret;
  }

  function lock() {
    masterPwd.value = ''; userSalt.value = ''; isUnlocked.value = false;
    sqliteDb.clearDbKey();
    clearAutofillState();
  }

  async function genPassword(codename: string, mode: CharsetMode = 'alphanumeric', length = 16) {
    return generatePassword(masterPwd.value, userSalt.value, codename, mode, length);
  }



  async function runDirectPassword(
    computeMode: DirectComputeMode,
    inputPwd: string,
    codename: string,
    mode: CharsetMode = 'alphanumeric',
    length = 16,
    url?: string,
  ) {
    return runDirectPasswordFlow({
      computeMode,
      masterPwd: inputPwd,
      codename,
      mode,
      length,
      url,
      runtime: {
        getMasterData: () => sqliteDb.getMasterData(),
        openMasterPasswordData,
        generatePassword,
        listPasswordEntries: () => sqliteDb.getEntriesByType('password'),
        createPasswordEntry: (data) => sqliteDb.createEntry(data),
        touchLastUsed: (id) => sqliteDb.updateLastUsed(id),
        withWritableDbKey: async (pwd, salt, run) => {
          const shouldRestore = isUnlocked.value && masterPwd.value === pwd && userSalt.value === salt;
          if (!shouldRestore) sqliteDb.setDbKey(await deriveDatabaseKey(pwd, salt));
          try {
            return await run();
          } finally {
            if (!shouldRestore) sqliteDb.clearDbKey();
          }
        },
      },
    });
  }

  async function generateRecovery(): Promise<string> {
    const code = generateRecoveryCode();
    const { encryptedMasterPwd, recoverySalt } = await encryptMasterPwdWithRecovery(masterPwd.value, code);
    const data = await sqliteDb.getMasterData();
    await sqliteDb.setMasterData({ ...data!, encryptedMasterPwd, recoverySalt });
    return code;
  }

  async function recoverWithCode(code: string): Promise<boolean> {
    const data = await sqliteDb.getMasterData();
    if (!data?.encryptedMasterPwd || !data.recoverySalt) return false;
    try {
      const pwd = await decryptMasterPwdWithRecovery(data.encryptedMasterPwd, data.recoverySalt, code);
      return unlock(pwd);
    } catch { return false; }
  }

  async function exportData(): Promise<string> {
    const entries = await sqliteDb.getAllEntries();
    return JSON.stringify({ version: 1, exportedAt: Date.now(), entries }, null, 2);
  }

  async function importData(json: string): Promise<number> {
    const validTypes = new Set<Entry['type']>(['password', 'bookmark', 'file_ref', 'note']);
    let parsed: { entries: Entry[] };
    try { parsed = JSON.parse(json); } catch { throw new Error('导入文件格式错误'); }
    if (!Array.isArray(parsed?.entries)) throw new Error('导入文件缺少 entries 字段');
    let count = 0;
    for (const entry of parsed.entries) {
      if (!entry?.id) continue;
      if (!validTypes.has(entry.type)) throw new Error('导入文件包含不支持的条目类型');
      if (!Number.isFinite(entry.createdAt) || !Number.isFinite(entry.updatedAt)) {
        throw new Error('导入文件包含无效条目时间');
      }
      const exists = await sqliteDb.getEntry(entry.id);
      const duplicateBookmark = entry.type === 'bookmark' && entry.url
        ? await sqliteDb.getBookmarkByUrl(entry.url)
        : undefined;
      if (!exists && !duplicateBookmark) { await sqliteDb.importEntry(entry); count++; }
    }
    return count;
  }

  function getDbKey() { return sqliteDb.getDbKey(); }

  return { isUnlocked, isSetup, hasUnsupportedMasterData, userSalt, masterPwd, checkSetup, setup, unlock, lock, genPassword, runDirectPassword,
    generateRecovery, recoverWithCode, exportData, importData, getDbKey };
});
