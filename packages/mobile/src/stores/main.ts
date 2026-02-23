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

export const useMainStore = defineStore('main', () => {
  const isUnlocked = ref(false);
  const isSetup = ref(false);
  const masterPwd = ref('');
  const userSalt = ref('');
  // 通过恢复码解锁后，强制要求用户设置新主密码
  const needsPasswordReset = ref(false);

  async function checkSetup() {
    const data = await sqliteDb.getMasterData();
    isSetup.value = !!data;
    return isSetup.value;
  }

  async function setup(pwd: string, salt?: string) {
    const s = salt?.trim() || 'FlowerKey';
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
    masterPwd.value = ''; isUnlocked.value = false; needsPasswordReset.value = false;
    sqliteDb.clearDbKey();
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
      const ok = await unlock(pwd);
      if (ok) needsPasswordReset.value = true;
      return ok;
    } catch { return false; }
  }

  async function changeMasterPwd(currentPwd: string, newPwd: string): Promise<void> {
    const data = await sqliteDb.getMasterData();
    if (!data) throw new Error('未初始化');
    // 恢复码场景下已解锁，跳过旧密码验证；正常场景需验证
    if (!needsPasswordReset.value) {
      const ok = await verifyMasterPassword(currentPwd, data.verifySalt!, data.verifyHash);
      if (!ok) throw new Error('当前主密码错误');
    }
    const oldKey = await deriveDatabaseKey(masterPwd.value, userSalt.value);
    const newKey = await deriveDatabaseKey(newPwd, userSalt.value);
    await sqliteDb.reEncryptAllEntries(oldKey, newKey);
    sqliteDb.setDbKey(newKey);
    const verifySalt = generateSalt();
    const verifyHash = await createVerifyHash(newPwd, verifySalt);
    let recoveryFields: { encryptedMasterPwd?: string; recoverySalt?: string } = {};
    if (data?.encryptedMasterPwd && data.recoverySalt) {
      try {
        // 恢复码场景下 currentPwd 为空，用内存中的旧主密码解密恢复码
        const pwdForRecovery = needsPasswordReset.value ? masterPwd.value : currentPwd;
        const code = await decryptMasterPwdWithRecovery(data.encryptedMasterPwd, data.recoverySalt, pwdForRecovery);
        recoveryFields = await encryptMasterPwdWithRecovery(newPwd, code);
      } catch {}
    }
    await sqliteDb.setMasterData({ ...data!, verifyHash, verifySalt, ...recoveryFields });
    masterPwd.value = newPwd;
    needsPasswordReset.value = false;
    syncAutofillState(newPwd, userSalt.value);
  }

  async function exportData(): Promise<string> {
    const entries = await sqliteDb.getAllEntries();
    return JSON.stringify({ version: 1, exportedAt: Date.now(), entries }, null, 2);
  }

  async function importData(json: string): Promise<number> {
    let parsed: { entries: Entry[] };
    try { parsed = JSON.parse(json); } catch { throw new Error('导入文件格式错误'); }
    if (!Array.isArray(parsed?.entries)) throw new Error('导入文件缺少 entries 字段');
    let count = 0;
    for (const entry of parsed.entries) {
      if (!entry?.id) continue;
      const exists = await sqliteDb.getEntry(entry.id);
      if (!exists) { await sqliteDb.createEntry(entry); count++; }
    }
    return count;
  }

  function getDbKey() { return sqliteDb.getDbKey(); }

  return { isUnlocked, isSetup, userSalt, needsPasswordReset, checkSetup, setup, unlock, lock, genPassword,
    generateRecovery, recoverWithCode, changeMasterPwd, exportData, importData, getDbKey };
});
