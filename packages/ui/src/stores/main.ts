/**
 * 花钥 FlowerKey - 主状态管理
 * 管理认证状态、当前视图、全局搜索等
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db, generateSalt, generateDeviceId,
  createVerifyHash, verifyMasterPassword, generatePassword, deriveDatabaseKey,
  generateRecoveryCode, encryptMasterPwdWithRecovery, decryptMasterPwdWithRecovery,
  decryptEntry, runDirectPasswordFlow, savePasswordEntry,
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
  const masterPwd = ref('');
  const userSalt = ref('');

  /** 检查是否已初始化（有主密码数据） */
  async function checkSetup() {
    const data = await db.getMasterData();
    isSetup.value = !!data;
    if (isSetup.value) await ensureDeviceId();
    return isSetup.value;
  }

  /** 首次设置主密码和盐 */
  async function setup(pwd: string, salt?: string) {
    // userSalt 固定为有意设计：保证同一记忆密码在不同设备生成相同密码（跨设备一致性）
    const s = salt || 'FlowerKey';
    // verifySalt 随机生成：防止 verifyHash 被彩虹表攻击，仅用于本地验证
    const verifySalt = generateSalt();
    const hash = await createVerifyHash(pwd, verifySalt);
    await db.setMasterData({ verifyHash: hash, userSalt: s, verifySalt, createdAt: Date.now() });

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
    const ok = await verifyMasterPassword(pwd, data.verifySalt!, data.verifyHash);
    if (ok) {
      masterPwd.value = pwd;
      userSalt.value = data.userSalt;
      isUnlocked.value = true;
      db.setDbKey(await deriveDatabaseKey(pwd, data.userSalt));
      await ensureDeviceId();
    }
    return ok;
  }

  /** 锁定 */
  function lock() {
    masterPwd.value = '';
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
        verifyMasterPassword,
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
        verifyMasterPassword,
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

  /** 方案二：修改主密码（需已解锁，重新加密所有条目） */
  async function changeMasterPwd(currentPwd: string, newPwd: string): Promise<void> {
    const masterData = await db.getMasterData();
    if (!masterData) throw new Error('未初始化');
    const ok = await verifyMasterPassword(currentPwd, masterData.verifySalt!, masterData.verifyHash);
    if (!ok) throw new Error('当前主密码错误');
    const oldKey = await deriveDatabaseKey(masterPwd.value, userSalt.value);
    const newKey = await deriveDatabaseKey(newPwd, userSalt.value);
    await db.reEncryptAllEntries(oldKey, newKey);
    db.setDbKey(newKey);

    const verifySalt = generateSalt();
    const verifyHash = await createVerifyHash(newPwd, verifySalt);
    // 恢复码存在时同步更新（用新密码重新加密）
    await db.setMasterData({ ...masterData, verifyHash, verifySalt, encryptedMasterPwd: undefined, recoverySalt: undefined });
    masterPwd.value = newPwd;
  }

  /** 方案三：导出所有条目为明文 JSON */
  async function exportData(): Promise<string> {
    const entries = await db.entries.toArray();
    const decrypted = await Promise.all(entries.map(e => decryptEntry(e, db.getDbKey())));
    return JSON.stringify({ version: 1, exportedAt: Date.now(), entries: decrypted }, null, 2);
  }

  /** 方案三：从明文 JSON 导入（合并，不覆盖已有条目） */
  async function importData(json: string): Promise<number> {
    const { entries } = JSON.parse(json) as { entries: Entry[] };
    let count = 0;
    for (const entry of entries) {
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
    isUnlocked, isSetup, userSalt, masterPwd,
    checkSetup, setup, unlock, lock, genPassword, runDirectPassword, savePassword,
    generateRecovery, recoverWithCode, changeMasterPwd, exportData, importData, getDbKey,
  };
});
