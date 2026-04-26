/**
 * 花钥 Background Service Worker
 * 处理右键菜单、消息通信
 * 维护解锁状态：masterPwd 仅存内存变量，不写入 storage
 * chrome.storage.session 只存 isUnlocked + userSalt（非敏感），Service Worker 重启时强制清空
 */

import { generatePassword, verifyMasterPassword, db, deriveDatabaseKey, runDirectPasswordFlow } from '@flowerkey/core';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// ==================== 图标深浅色适配 ====================

function updateIcon(isDark: boolean) {
  const suffix = isDark ? 'dark' : 'light';
  chrome.action.setIcon({
    path: {
      16: `icons/icon16_${suffix}.png`,
      48: `icons/icon48_${suffix}.png`,
      128: `icons/icon128_${suffix}.png`,
    },
  });
}

async function detectTheme() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs.find(t => t.id && t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about'));
    if (!tab?.id) return;
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    });
    updateIcon(res?.result ?? false);
  } catch { /* 无可用 tab，忽略 */ }
}

chrome.runtime.onInstalled.addListener(detectTheme);
chrome.runtime.onStartup.addListener(detectTheme);

// ==================== 内存状态（不持久化） ====================
let _masterPwd = '';
let _userSalt = '';
let _isUnlocked = false;
chrome.storage.session.set({ isUnlocked: false, userSalt: '', unlockedAt: 0 });

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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'themeChanged') {
    updateIcon(msg.dark);
    sendResponse();
    return;
  }

  if (msg.type === 'getUnlockState') {
    sendResponse({ isUnlocked: _isUnlocked, userSalt: _userSalt });
    return;
  }

  // sidepanel 重开时恢复 dbKey，masterPwd 不离开 background 内存
  if (msg.type === 'restoreDbKey') {
    if (!_isUnlocked) { sendResponse({ ok: false }); return; }
    (async () => {
      try {
        db.setDbKey(await deriveDatabaseKey(_masterPwd, _userSalt));
        sendResponse({ ok: true, userSalt: _userSalt });
      } catch (e) { sendResponse({ ok: false, error: (e as Error).message }); }
    })();
    return true;
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
        let entryId = all.find(e => e.codename === msg.codename)?.id;
        if (!entryId) {
          const created = await db.createEntry({ type: 'password', codename: msg.codename, charsetMode: msg.mode, passwordLength: msg.length, tags: [], folder: '', description: '' });
          entryId = created.id;
        }
        sendResponse({ password, entryId });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    })();
    return true;
  }

  if (msg.type === 'generatePasswordDirect') {
    (async () => {
      try {
        const result = await runDirectPasswordFlow({
          computeMode: msg.computeMode ?? 'formal',
          masterPwd: msg.masterPwd,
          codename: msg.codename,
          mode: msg.mode,
          length: msg.length,
          url: msg.url,
          runtime: {
            getMasterData: () => db.getMasterData(),
            verifyMasterPassword,
            generatePassword,
            listPasswordEntries: () => db.getEntriesByType('password'),
            createPasswordEntry: (data) => db.createEntry(data),
            touchLastUsed: (id) => db.touchLastUsed(id),
            withWritableDbKey: async (pwd, salt, run) => {
              const reuseCurrentKey = _isUnlocked && _masterPwd === pwd && _userSalt === salt;
              if (!reuseCurrentKey) db.setDbKey(await deriveDatabaseKey(pwd, salt));
              try {
                return await run();
              } finally {
                if (reuseCurrentKey) return;
                if (_isUnlocked) db.setDbKey(await deriveDatabaseKey(_masterPwd, _userSalt));
                else db.clearDbKey();
              }
            },
          },
        });
        sendResponse(result);
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    })();
    return true;
  }

  // content script 解锁：验证后存入内存，不经过 storage
  if (msg.type === 'unlockFromContent') {
    (async () => {
      try {
        const mpData = await db.getMasterData();
        const ok = mpData ? await verifyMasterPassword(msg.masterPwd, mpData.verifySalt!, mpData.verifyHash) : false;
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
        }).map(e => ({ id: e.id, codename: e.codename || '', description: e.description || '' }));
        sendResponse({ entries: matched, locked: false });
      } catch { sendResponse({ entries: [], locked: false }); }
    })();
    return true;
  }

  if (msg.type === 'touchLastUsed') {
    (async () => {
      try {
        await db.touchLastUsed(msg.id);
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ ok: false, error: (e as Error).message }); }
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
        await db.touchLastUsed(msg.id);
        sendResponse({ password });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    })();
    return true;
  }

  sendResponse();
});
