/**
 * 花钥 Background Service Worker
 * 处理右键菜单、消息通信
 * 维护解锁状态（chrome.storage.session），代理密码生成请求
 */

import { generatePassword, verifyMasterPassword, db } from '@flowerkey/core';

// 点击工具栏图标自动打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

async function getSession() {
  const data = await chrome.storage.session.get(['isUnlocked', 'masterPwd', 'userSalt']);
  return {
    isUnlocked: data.isUnlocked ?? false,
    masterPwd: data.masterPwd ?? '',
    userSalt: data.userSalt ?? '',
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'flowerkey-save-bookmark',
    title: '收藏到花钥',
    contexts: ['page', 'link'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'flowerkey-save-bookmark' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'saveBookmark',
      url: info.linkUrl || info.pageUrl,
      title: tab.title || '',
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getUnlockState') {
    getSession().then(s => sendResponse({ isUnlocked: s.isUnlocked }));
    return true;
  }

  if (msg.type === 'generatePassword') {
    getSession().then(async s => {
      if (!s.isUnlocked) { sendResponse({ error: '请先解锁' }); return; }
      try {
        const password = await generatePassword(s.masterPwd, s.userSalt, msg.codename, msg.mode, msg.length);
        const existing = await db.entries.where('type').equals('password').filter(e => e.codename === msg.codename).first();
        if (!existing) await db.createEntry({ type: 'password', codename: msg.codename, charsetMode: msg.mode, passwordLength: msg.length, tags: [], folder: '', description: '' });
        sendResponse({ password });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    });
    return true;
  }

  if (msg.type === 'generatePasswordDirect') {
    getSession().then(async s => {
      try {
        let verified = false;
        let mpData = null;
        try { mpData = await db.getMasterData(); } catch (_) {}
        if (mpData) try { verified = await verifyMasterPassword(msg.masterPwd, mpData.userSalt, mpData.verifyHash); } catch (_) {}
        const userSalt = mpData?.userSalt || s.userSalt || '';
        const password = await generatePassword(msg.masterPwd, userSalt, msg.codename, msg.mode, msg.length);
        if (verified) {
          const existing = await db.entries.where('type').equals('password').filter(e => e.codename === msg.codename).first();
          if (!existing) await db.createEntry({ type: 'password', codename: msg.codename, charsetMode: msg.mode, passwordLength: msg.length, tags: [], folder: '', description: '' });
        }
        sendResponse({ password, verified });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    });
    return true;
  }

  if (msg.type === 'unlockFromContent') {
    (async () => {
      try {
        const mpData = await db.getMasterData();
        const ok = mpData ? await verifyMasterPassword(msg.masterPwd, mpData.userSalt, mpData.verifyHash) : false;
        if (ok) {
          await chrome.storage.session.set({ isUnlocked: true, masterPwd: msg.masterPwd, userSalt: mpData!.userSalt });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: '密码错误' });
        }
      } catch (e) { sendResponse({ ok: false, error: (e as Error).message }); }
    })();
    return true;
  }

  if (msg.type === 'setSession') {
    chrome.storage.session.set({ isUnlocked: msg.isUnlocked, masterPwd: msg.masterPwd ?? '', userSalt: msg.userSalt ?? '' });
    sendResponse();
    return;
  }

  sendResponse();
});
