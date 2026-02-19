/**
 * 花钥 FlowerKey - 主状态管理
 * 管理认证状态、当前视图、全局搜索等
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db, generateSalt, generateDeviceId,
  createVerifyHash, verifyMasterPassword, generatePassword,
  type Entry, type EntryType, type CharsetMode, type MasterPasswordData,
} from '@flowerkey/core';

export const useMainStore = defineStore('main', () => {
  const isUnlocked = ref(false);
  const isSetup = ref(false);
  const masterPwd = ref('');
  const userSalt = ref('');
  const searchQuery = ref('');
  const currentView = ref<'passwords' | 'bookmarks' | 'files' | 'settings'>('passwords');

  /** 检查是否已初始化（有主密码数据） */
  async function checkSetup() {
    const data = await db.getMasterData();
    isSetup.value = !!data;
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

    const deviceId = await db.getConfig<string>('deviceId');
    if (!deviceId) {
      await db.setConfig('deviceId', generateDeviceId());
    }

    masterPwd.value = pwd;
    userSalt.value = s;
    isSetup.value = true;
    isUnlocked.value = true;
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
    }
    return ok;
  }

  /** 锁定 */
  function lock() {
    masterPwd.value = '';
    isUnlocked.value = false;
  }

  /** 生成密码 */
  async function genPassword(
    codename: string, mode: CharsetMode = 'alphanumeric', length = 16
  ): Promise<string> {
    return generatePassword(masterPwd.value, userSalt.value, codename, mode, length);
  }

  return {
    isUnlocked, isSetup, masterPwd, userSalt, searchQuery, currentView,
    checkSetup, setup, unlock, lock, genPassword,
  };
});
