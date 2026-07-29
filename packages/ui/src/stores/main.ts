/**
 * 花钥 FlowerKey - 主状态管理
 * 管理认证状态、当前视图、全局搜索等
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db, generateDeviceId,
  createMasterPasswordData, openMasterPasswordData, generatePassword, deriveDatabaseKey,
  generateRecoveryCode, encryptMasterPwdWithRecovery, decryptMasterPwdWithRecovery,
  decryptEntry, encryptBackup, openBackup, runDirectPasswordFlow, savePasswordEntry,
  type Entry, type CharsetMode, type DirectComputeMode,
} from '@flowerkey/core';

async function ensureDeviceId() {
  let deviceId = await db.getConfig<string>('deviceId');
  if (!deviceId) {
    deviceId = generateDeviceId();
    await db.setConfig('deviceId', deviceId);
  }
  db.setDeviceId(deviceId);
  return deviceId;
}

export const useMainStore = defineStore('main', () => {
  const isUnlocked = ref(false);
  const isSetup = ref(false);
  const hasUnsupportedMasterData = ref(false);
  const masterPwd = ref('');
  const userSalt = ref('');

  /** 检查是否已初始化（有主密码数据） */
  async function checkSetup() {
    const status = await db.getMasterDataStatus();
    isSetup.value = status === 'current';
    hasUnsupportedMasterData.value = status === 'unsupported';
    if (isSetup.value) await ensureDeviceId();
    return isSetup.value;
  }

  /** 首次设置记忆密码和身份密语 */
  async function setup(pwd: string, identitySecret: string) {
    if (hasUnsupportedMasterData.value) {
      throw new Error('检测到发布前或损坏的身份密语数据，请先清除本地开发数据');
    }
    const data = await createMasterPasswordData(pwd, identitySecret);
    await db.createMasterData(data);
    const s = identitySecret.normalize('NFC');

    await ensureDeviceId();

    masterPwd.value = pwd;
    userSalt.value = s;
    isSetup.value = true;
    isUnlocked.value = true;
    db.setDbKey(await deriveDatabaseKey(pwd, s));
  }

  /** 解锁（验证主密码） */
  async function unlock(pwd: string): Promise<boolean> {
    const data = await db.getMasterData();
    if (!data) return false;
    const identitySecret = await openMasterPasswordData(pwd, data);
    if (identitySecret) {
      masterPwd.value = pwd;
      userSalt.value = identitySecret;
      isUnlocked.value = true;
      db.setDbKey(await deriveDatabaseKey(pwd, identitySecret));
      await ensureDeviceId();
    }
    return !!identitySecret;
  }

  /** 锁定 */
  function lock() {
    masterPwd.value = '';
    userSalt.value = '';
    isUnlocked.value = false;
    db.clearDbKey();
  }

  /** 生成密码 */
  async function genPassword(
    codename: string, mode: CharsetMode = 'alphanumeric', length = 16
  ): Promise<string> {
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
        getMasterData: () => db.getMasterData(),
        openMasterPasswordData,
        generatePassword,
        listPasswordEntries: () => db.getEntriesByType('password'),
        createPasswordEntry: (data) => db.createEntry(data),
        touchLastUsed: (id) => db.touchLastUsed(id),
        withWritableDbKey: async (pwd, salt, run) => {
          const shouldRestore = isUnlocked.value && masterPwd.value === pwd && userSalt.value === salt;
          if (!shouldRestore) db.setDbKey(await deriveDatabaseKey(pwd, salt));
          try {
            return await run();
          } finally {
            if (!shouldRestore) db.clearDbKey();
          }
        },
      },
    });
  }

  /** 用户复制密码时落库 */
  async function savePassword(
    inputPwd: string,
    codename: string,
    mode: CharsetMode = 'alphanumeric',
    length = 16,
    url?: string,
  ) {
    return savePasswordEntry({
      masterPwd: inputPwd,
      codename,
      mode,
      length,
      url,
      runtime: {
        getMasterData: () => db.getMasterData(),
        openMasterPasswordData,
        generatePassword,
        listPasswordEntries: () => db.getEntriesByType('password'),
        createPasswordEntry: (data) => db.createEntry(data),
        touchLastUsed: (id) => db.touchLastUsed(id),
        withWritableDbKey: async (pwd, salt, run) => {
          const reuseCurrentKey = isUnlocked.value && masterPwd.value === pwd && userSalt.value === salt;
          if (!reuseCurrentKey) db.setDbKey(await deriveDatabaseKey(pwd, salt));
          try {
            return await run();
          } finally {
            if (!reuseCurrentKey) {
              if (isUnlocked.value) db.setDbKey(await deriveDatabaseKey(masterPwd.value, userSalt.value));
              else db.clearDbKey();
            }
          }
        },
      },
    });
  }

  async function generateRecovery(): Promise<string> {
    const code = generateRecoveryCode();
    const { encryptedMasterPwd, recoverySalt } = await encryptMasterPwdWithRecovery(masterPwd.value, code);
    const data = await db.getMasterData();
    await db.setMasterData({ ...data!, encryptedMasterPwd, recoverySalt });
    return code;
  }

  /** 方案一：用恢复码恢复主密码并解锁 */
  async function recoverWithCode(code: string): Promise<boolean> {
    const data = await db.getMasterData();
    if (!data?.encryptedMasterPwd || !data.recoverySalt) return false;
    try {
      const pwd = await decryptMasterPwdWithRecovery(data.encryptedMasterPwd, data.recoverySalt, code);
      return unlock(pwd);
    } catch { return false; }
  }

  /** 导出使用当前数据库密钥整体加密的备份。 */
  async function exportData(): Promise<string> {
    const entries = await db.entries.toArray();
    const decrypted = await Promise.all(entries.map(e => decryptEntry(e, db.getDbKey())));
    return encryptBackup(JSON.stringify({ version: 2, exportedAt: Date.now(), entries: decrypted }), db.getDbKey());
  }

  /** 导入加密备份；旧明文 JSON 仅保留兼容。 */
  async function importData(json: string): Promise<number> {
    const validTypes = new Set<Entry['type']>(['password', 'file_ref', 'note', 'secret']);
    let parsed: { entries: Entry[] };
    try {
      const envelope = JSON.parse(json) as { format?: string };
      const source = envelope.format === 'FK-BACKUP-1' ? await openBackup(json, db.getDbKey()) : json;
      parsed = JSON.parse(source);
    } catch { throw new Error('导入文件格式错误或密钥不匹配'); }
    if (!Array.isArray(parsed?.entries)) throw new Error('导入文件缺少 entries 字段');
    let count = 0;
    for (const entry of parsed.entries) {
      if (!entry?.id) continue;
      if (entry.type === 'bookmark') continue;
      if (!validTypes.has(entry.type)) throw new Error('导入文件包含不支持的条目类型');
      if (!Number.isFinite(entry.createdAt) || !Number.isFinite(entry.updatedAt)) {
        throw new Error('导入文件包含无效条目时间');
      }
      const exists = await db.getEntry(entry.id);
      if (!exists) {
        await db.importEntry(entry);
        count++;
      }
    }
    return count;
  }

  function getDbKey() { return db.getDbKey(); }

  return {
    isUnlocked, isSetup, hasUnsupportedMasterData, userSalt, masterPwd,
    checkSetup, setup, unlock, lock, genPassword, runDirectPassword, savePassword,
    generateRecovery, recoverWithCode, exportData, importData, getDbKey,
  };
});
