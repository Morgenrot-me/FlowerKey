/**
 * 花钥移动端 - 主状态管理
 * 认证状态、密码生成，复用 @flowerkey/core
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db, generateSalt, createVerifyHash, verifyMasterPassword, generatePassword, deriveDatabaseKey,
  generateRecoveryCode, encryptMasterPwdWithRecovery, decryptMasterPwdWithRecovery,
  type Entry, type CharsetMode } from '@flowerkey/core';

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

  async function setup(pwd: string) {
    const s = 'FlowerKey';
    const verifySalt = generateSalt();
    const hash = await createVerifyHash(pwd, verifySalt);
    await db.setMasterData({ verifyHash: hash, userSalt: s, verifySalt, createdAt: Date.now() });
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

  function lock() { masterPwd.value = ''; isUnlocked.value = false; db.clearDbKey(); }

  async function genPassword(codename: string, mode: CharsetMode = 'alphanumeric', length = 16) {
    return generatePassword(masterPwd.value, userSalt.value, codename, mode, length);
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
    const decrypted = await Promise.all(entries.map(e => db['decryptEntry'](e)));
    return JSON.stringify({ version: 1, exportedAt: Date.now(), entries: decrypted }, null, 2);
  }

  async function importData(json: string): Promise<number> {
    const { entries } = JSON.parse(json) as { entries: Entry[] };
    let count = 0;
    for (const entry of entries) {
      const exists = await db.getEntry(entry.id);
      if (!exists) { await db.entries.put(await db['encryptEntry'](entry)); count++; }
    }
    return count;
  }

  return { isUnlocked, isSetup, masterPwd, userSalt, checkSetup, setup, unlock, lock, genPassword,
    generateRecovery, recoverWithCode, changeMasterPwd, exportData, importData };
});
