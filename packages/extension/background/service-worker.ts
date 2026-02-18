/**
 * 花钥 Background Service Worker
 * 处理右键菜单、消息通信、快捷键
 */

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
  if (msg.type === 'openSidePanel') {
    chrome.sidePanel.open({ windowId: _sender.tab?.windowId });
  }
  sendResponse();
});
