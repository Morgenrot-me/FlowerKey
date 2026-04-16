/**
 * 花钥桌面端 - 主状态管理
 * 管理认证状态、当前视图、全局搜索等
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db, generateSalt, generateDeviceId,
  createVerifyHash, verifyMasterPassword, generatePassword, deriveDatabaseKey,
  generateRecoveryCode, encryptMasterPwdWithRecovery, decryptMasterPwdWithRecovery,
  encryptEntry, decryptEntry, runDirectPasswordFlow,
  type Entry, type CharsetMode, type DirectComputeMode,
} from '@flowerkey/core';

export const useMainStore = defineStore('main', () => {
  const isUnlocked = ref(false);
  const isSetup = ref(false);
  const masterPwd = ref('');
  const userSalt = ref('');

  async function checkSetup() {
    const data = await db.getMasterData();
    isSetup.value = !!data;
    return isSetup.value;
  }

  async function setup(pwd: string, salt?: string) {
    const s = salt || 'FlowerKey';
    const verifySalt = generateSalt();
    const hash = await createVerifyHash(pwd, verifySalt);
    await db.setMasterData({ verifyHash: hash, userSalt: s, verifySalt, createdAt: Date.now() });

    const deviceId = await db.getConfig<string>('deviceId');
    if (!deviceId) {
      await db.setConfig('deviceId', generateDeviceId());
    }

    masterPwd.value = pwd;
    userSalt.value = s;
    isSetup.value = true;
    isUnlocked.value = true;
    db.setDbKey(await deriveDatabaseKey(pwd, s));
  }

  async function unlock(pwd: string): Promise<boolean> {
    const data = await db.getMasterData();
    if (!data) return false;
    const ok = await verifyMasterPassword(pwd, data.verifySalt!, data.verifyHash);
    if (ok) {
      masterPwd.value = pwd;
      userSalt.value = data.userSalt;
      isUnlocked.value = true;
      db.setDbKey(await deriveDatabaseKey(pwd, data.userSalt));
    }
    return ok;
  }

  function lock() {
    masterPwd.value = '';
    isUnlocked.value = false;
    db.clearDbKey();
  }

  async function genPassword(codename: string, mode: CharsetMode = 'alphanumeric', length = 16): Promise<string> {
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

  async function generateRecovery(): Promise<string> {
    const code = generateRecoveryCode();
    const { encryptedMasterPwd, recoverySalt } = await encryptMasterPwdWithRecovery(masterPwd.value, code);
    const data = await db.getMasterData();
    await db.setMasterData({ ...data!, encryptedMasterPwd, recoverySalt });
    return code;
  }

  async function recoverWithCode(code: string): Promise<boolean> {
    const data = await db.getMasterData();
    if (!data?.encryptedMasterPwd || !data.recoverySalt) return false;
    try {
      const pwd = await decryptMasterPwdWithRecovery(data.encryptedMasterPwd, data.recoverySalt, code);
      return unlock(pwd);
    } catch { return false; }
  }

  async function changeMasterPwd(newPwd: string): Promise<void> {
    const oldKey = await deriveDatabaseKey(masterPwd.value, userSalt.value);
    const newKey = await deriveDatabaseKey(newPwd, userSalt.value);
    await db.reEncryptAllEntries(oldKey, newKey);
    db.setDbKey(newKey);
    const verifySalt = generateSalt();
    const verifyHash = await createVerifyHash(newPwd, verifySalt);
    const data = await db.getMasterData();
    let recoveryFields: { encryptedMasterPwd?: string; recoverySalt?: string } = {};
    if (data?.encryptedMasterPwd && data.recoverySalt) {
      try {
        const code = await decryptMasterPwdWithRecovery(data.encryptedMasterPwd, data.recoverySalt, masterPwd.value);
        recoveryFields = await encryptMasterPwdWithRecovery(newPwd, code);
      } catch { /* 恢复码无法解密则丢弃 */ }
    }
    await db.setMasterData({ ...data!, verifyHash, verifySalt, ...recoveryFields });
    masterPwd.value = newPwd;
  }

  async function exportData(): Promise<string> {
    const entries = await db.entries.toArray();
    const decrypted = await Promise.all(entries.map(e => decryptEntry(e, db.getDbKey())));
    return JSON.stringify({ version: 1, exportedAt: Date.now(), entries: decrypted }, null, 2);
  }

  async function importData(json: string): Promise<number> {
    const { entries } = JSON.parse(json) as { entries: Entry[] };
    let count = 0;
    for (const entry of entries) {
      const exists = await db.getEntry(entry.id);
      if (!exists) {
        await db.entries.put(await encryptEntry(entry, db.getDbKey()));
        count++;
      }
    }
    return count;
  }

  function getDbKey() { return db.getDbKey(); }

  return {
    isUnlocked, isSetup, userSalt, masterPwd,
    checkSetup, setup, unlock, lock, genPassword, runDirectPassword,
    generateRecovery, recoverWithCode, changeMasterPwd, exportData, importData, getDbKey,
  };
});
