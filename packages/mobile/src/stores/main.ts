/**
 * 花钥移动端 - 主状态管理
 * 认证状态、密码生成，使用 SQLite db 适配层
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { generateSalt, createVerifyHash, verifyMasterPassword, generatePassword, deriveDatabaseKey,
  generateRecoveryCode, encryptMasterPwdWithRecovery, decryptMasterPwdWithRecovery,
  type Entry, type CharsetMode } from '@flowerkey/core';
import * as sqliteDb from '../db-sqlite';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Android 原生 Plugin：同步解锁状态供 AutofillService 使用
const AutofillState = registerPlugin<{
  setUnlocked(opts: { masterPwd: string; userSalt: string }): Promise<void>;
  setLocked(): Promise<void>;
}>('AutofillState');

function syncAutofillState(pwd: string, salt: string) {
  if (Capacitor.getPlatform() === 'android')
    AutofillState.setUnlocked({ masterPwd: pwd, userSalt: salt }).catch(() => {});
}
function clearAutofillState() {
  if (Capacitor.getPlatform() === 'android')
    AutofillState.setLocked().catch(() => {});
}

export const useMainStore = defineStore('main', () => {
  const isUnlocked = ref(false);
  const isSetup = ref(false);
  const masterPwd = ref('');
  const userSalt = ref('');

  async function checkSetup() {
    const data = await sqliteDb.getMasterData();
    isSetup.value = !!data;
    return isSetup.value;
  }

  async function setup(pwd: string) {
    const s = 'FlowerKey';
    const verifySalt = generateSalt();
    const hash = await createVerifyHash(pwd, verifySalt);
    await sqliteDb.setMasterData({ verifyHash: hash, userSalt: s, verifySalt, createdAt: Date.now() });
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
    const ok = await verifyMasterPassword(pwd, data.verifySalt!, data.verifyHash);
    if (ok) {
      masterPwd.value = pwd;
      userSalt.value = data.userSalt;
      isUnlocked.value = true;
      sqliteDb.setDbKey(await deriveDatabaseKey(pwd, data.userSalt));
      syncAutofillState(pwd, data.userSalt);
    }
    return ok;
  }

  function lock() {
    masterPwd.value = ''; isUnlocked.value = false; sqliteDb.clearDbKey();
    clearAutofillState();
  }

  async function genPassword(codename: string, mode: CharsetMode = 'alphanumeric', length = 16) {
    return generatePassword(masterPwd.value, userSalt.value, codename, mode, length);
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

  async function changeMasterPwd(newPwd: string): Promise<void> {
    const oldKey = await deriveDatabaseKey(masterPwd.value, userSalt.value);
    const newKey = await deriveDatabaseKey(newPwd, userSalt.value);
    await sqliteDb.reEncryptAllEntries(oldKey, newKey);
    sqliteDb.setDbKey(newKey);
    const verifySalt = generateSalt();
    const verifyHash = await createVerifyHash(newPwd, verifySalt);
    const data = await sqliteDb.getMasterData();
    let recoveryFields: { encryptedMasterPwd?: string; recoverySalt?: string } = {};
    if (data?.encryptedMasterPwd && data.recoverySalt) {
      try {
        const code = await decryptMasterPwdWithRecovery(data.encryptedMasterPwd, data.recoverySalt, masterPwd.value);
        recoveryFields = await encryptMasterPwdWithRecovery(newPwd, code);
      } catch {}
    }
    await sqliteDb.setMasterData({ ...data!, verifyHash, verifySalt, ...recoveryFields });
    masterPwd.value = newPwd;
  }

  async function exportData(): Promise<string> {
    const entries = await sqliteDb.getEntriesByType('password');
    return JSON.stringify({ version: 1, exportedAt: Date.now(), entries }, null, 2);
  }

  async function importData(json: string): Promise<number> {
    const { entries } = JSON.parse(json) as { entries: Entry[] };
    let count = 0;
    for (const entry of entries) {
      const exists = await sqliteDb.getEntry(entry.id);
      if (!exists) { await sqliteDb.createEntry(entry); count++; }
    }
    return count;
  }

  return { isUnlocked, isSetup, masterPwd, userSalt, checkSetup, setup, unlock, lock, genPassword,
    generateRecovery, recoverWithCode, changeMasterPwd, exportData, importData };
});
