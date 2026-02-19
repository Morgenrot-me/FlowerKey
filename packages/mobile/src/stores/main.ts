/**
 * 花钥移动端 - 主状态管理
 * 认证状态、密码生成，复用 @flowerkey/core
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db, generateSalt, createVerifyHash, verifyMasterPassword, generatePassword, deriveDatabaseKey, type CharsetMode } from '@flowerkey/core';

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

  return { isUnlocked, isSetup, masterPwd, userSalt, checkSetup, setup, unlock, lock, genPassword };
});
