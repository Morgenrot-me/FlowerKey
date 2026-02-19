/**
 * 花钥移动端 - 主状态管理
 * 认证状态、密码生成，复用 @flowerkey/core
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db, createVerifyHash, verifyMasterPassword, generatePassword, type CharsetMode } from '@flowerkey/core';

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
    // 固定盐为有意设计：保证同一记忆密码在不同设备生成相同密码（跨设备一致性）
    const s = 'FlowerKey';
    const hash = await createVerifyHash(pwd, s);
    await db.setMasterData({ verifyHash: hash, userSalt: s, createdAt: Date.now() });
    masterPwd.value = pwd;
    userSalt.value = s;
    isSetup.value = true;
    isUnlocked.value = true;
  }

  async function unlock(pwd: string): Promise<boolean> {
    const data = await db.getMasterData();
    if (!data) return false;
    const ok = await verifyMasterPassword(pwd, data.userSalt, data.verifyHash);
    if (ok) { masterPwd.value = pwd; userSalt.value = data.userSalt; isUnlocked.value = true; }
    return ok;
  }

  function lock() { masterPwd.value = ''; isUnlocked.value = false; }

  async function genPassword(codename: string, mode: CharsetMode = 'alphanumeric', length = 16) {
    return generatePassword(masterPwd.value, userSalt.value, codename, mode, length);
  }

  return { isUnlocked, isSetup, masterPwd, userSalt, checkSetup, setup, unlock, lock, genPassword };
});
