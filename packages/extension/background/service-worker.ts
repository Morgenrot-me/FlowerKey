/**
 * 花钥 Background Service Worker
 * 处理右键菜单、消息通信
 * 维护解锁状态：masterPwd 仅存内存变量，不写入 storage
 * chrome.storage.session 只存 isUnlocked + userSalt（非敏感）
 */

import { generatePassword, verifyMasterPassword, db, deriveDatabaseKey } from '@flowerkey/core';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// ==================== 内存状态（不持久化） ====================
let _masterPwd = '';
let _userSalt = '';
let _isUnlocked = false;

function setUnlocked(masterPwd: string, userSalt: string) {
  _masterPwd = masterPwd;
  _userSalt = userSalt;
  _isUnlocked = true;
  chrome.storage.session.set({ isUnlocked: true, userSalt, unlockedAt: Date.now() });
}

function setLocked() {
  _masterPwd = '';
  _userSalt = '';
  _isUnlocked = false;
  chrome.storage.session.set({ isUnlocked: false, userSalt: '', unlockedAt: 0 });
}

// ==================== 右键菜单 ====================

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

// ==================== 侧边栏连接（关闭时锁定） ====================

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;
  port.onDisconnect.addListener(async () => {
    const lockOnClose = (await db.getConfig<boolean>('lockOnClose')) ?? false;
    if (lockOnClose) setLocked();
  });
});

// ==================== 消息处理 ====================

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'getUnlockState') {
    sendResponse({ isUnlocked: _isUnlocked, userSalt: _userSalt });
    return;
  }

  // sidepanel 解锁后同步内存状态（masterPwd 由 sidepanel 传入，仅此一次）
  if (msg.type === 'setUnlocked') {
    (async () => {
      try {
        db.setDbKey(await deriveDatabaseKey(msg.masterPwd, msg.userSalt));
        setUnlocked(msg.masterPwd, msg.userSalt);
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ ok: false, error: (e as Error).message }); }
    })();
    return true;
  }

  if (msg.type === 'setLocked') {
    db.clearDbKey();
    setLocked();
    sendResponse();
    return;
  }

  if (msg.type === 'generatePassword') {
    if (!_isUnlocked) { sendResponse({ error: '请先解锁' }); return; }
    (async () => {
      try {
        const password = await generatePassword(_masterPwd, _userSalt, msg.codename, msg.mode, msg.length);
        const all = await db.getEntriesByType('password');
        if (!all.find(e => e.codename === msg.codename)) {
          await db.createEntry({ type: 'password', codename: msg.codename, charsetMode: msg.mode, passwordLength: msg.length, tags: [], folder: '', description: '' });
        }
        sendResponse({ password });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    })();
    return true;
  }

  if (msg.type === 'generatePasswordDirect') {
    (async () => {
      try {
        let verified = false;
        let mpData = null;
        try { mpData = await db.getMasterData(); } catch (_) {}
        if (mpData) try { verified = await verifyMasterPassword(msg.masterPwd, mpData.userSalt, mpData.verifyHash); } catch (_) {}
        const userSalt = mpData?.userSalt || _userSalt || '';
        const password = await generatePassword(msg.masterPwd, userSalt, msg.codename, msg.mode, msg.length);
        if (verified) {
          const all = await db.getEntriesByType('password');
          if (!all.find(e => e.codename === msg.codename)) {
            await db.createEntry({ type: 'password', codename: msg.codename, charsetMode: msg.mode, passwordLength: msg.length, tags: [], folder: '', description: '', ...(msg.url && { url: msg.url }) });
          }
        }
        sendResponse({ password, verified });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    })();
    return true;
  }

  // content script 解锁：验证后存入内存，不经过 storage
  if (msg.type === 'unlockFromContent') {
    (async () => {
      try {
        const mpData = await db.getMasterData();
        const ok = mpData ? await verifyMasterPassword(msg.masterPwd, mpData.userSalt, mpData.verifyHash) : false;
        if (ok) {
          db.setDbKey(await deriveDatabaseKey(msg.masterPwd, mpData!.userSalt));
          setUnlocked(msg.masterPwd, mpData!.userSalt);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: '密码错误' });
        }
      } catch (e) { sendResponse({ ok: false, error: (e as Error).message }); }
    })();
    return true;
  }

  if (msg.type === 'getPageMeta') {
    (async () => {
      const tabs = await chrome.tabs.query({ active: true });
      const tab = tabs.find(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about'));
      if (!tab?.id) { sendResponse({}); return; }
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: 'getPageMeta' });
        sendResponse(result ?? {});
      } catch { sendResponse({ title: tab.title || '', url: tab.url || '', favicon: tab.favIconUrl || '', image: '', description: '' }); }
    })();
    return true;
  }

  if (msg.type === 'getMatchingEntries') {
    (async () => {
      try {
        if (!_isUnlocked) { sendResponse({ entries: [], locked: true }); return; }
        const all = await db.getEntriesByType('password');
        const host = msg.host as string;
        const matched = all.filter(e => {
          if (!e.url) return false;
          try { return new URL(e.url).hostname === host; } catch { return false; }
        }).map(e => ({ id: e.id, codename: e.codename || '' }));
        sendResponse({ entries: matched, locked: false });
      } catch { sendResponse({ entries: [], locked: false }); }
    })();
    return true;
  }

  if (msg.type === 'fillFromEntry') {
    (async () => {
      try {
        if (!_isUnlocked) { sendResponse({ error: '未解锁' }); return; }
        const entry = await db.getEntry(msg.id);
        if (!entry) { sendResponse({ error: '条目不存在' }); return; }
        const password = entry.storedPassword
          ? entry.storedPassword
          : await generatePassword(_masterPwd, _userSalt, entry.codename!, entry.charsetMode, entry.passwordLength);
        sendResponse({ password });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    })();
    return true;
  }

  sendResponse();
});
