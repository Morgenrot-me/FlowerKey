/**
 * 花钥 Content Script
 * 注入页面：检测登录表单、接收书签保存消息
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'saveBookmark') {
    chrome.runtime.sendMessage({
      type: 'createBookmark',
      url: msg.url,
      title: msg.title,
    });
  }

  if (msg.type === 'fillPassword') {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs.forEach(input => { input.value = msg.password; input.dispatchEvent(new Event('input', { bubbles: true })); });
  }

  sendResponse();
});
