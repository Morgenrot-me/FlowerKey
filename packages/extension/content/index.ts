/**
 * 花钥 Content Script
 * 注入悬浮球（半圆贴右边缘）+ 页内浮层（快速密码计算）
 * 使用 Shadow DOM 隔离样式，避免与页面冲突
 */

// ==================== 状态 ====================
const isMobile = window.innerWidth <= 600;
let panelOpen = false;
let pinned = false;
let ballX = window.innerWidth - 74; // 初始贴右边，留滚动条空间
let ballY = window.innerHeight / 2;
let snapSide: 'left' | 'right' = 'right';
let isDragging = false;
let dragStartX = 0, dragStartY = 0, dragStartBallX = 0, dragStartBallY = 0;

// ==================== 创建宿主元素 ====================
const host = document.createElement('div');
host.id = 'flowerkey-root';
host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
document.documentElement.appendChild(host);

const shadow = host.attachShadow({ mode: 'closed' });

// ==================== 样式 ====================
const style = document.createElement('style');
style.textContent = `
  .ball {
    position: fixed;
    width: 44px;
    height: 44px;
    background: rgba(59,130,246,0.25);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border-radius: 50%;
    border: 1px solid rgba(147,197,253,0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(37,99,235,0.2), inset 0 1px 0 rgba(255,255,255,0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    user-select: none;
    touch-action: none;
  }
  .ball:hover {
    background: rgba(59,130,246,0.38);
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.5);
  }
  .ball:active { transform: scale(0.93); }
  .ball svg { width: 20px; height: 20px; }

  .panel {
    position: fixed;
    right: 12px;
    width: 280px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    padding: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    display: none;
    flex-direction: column;
    gap: 8px;
  }
  .panel.mobile {
    width: calc(100vw - 32px);
    left: 16px !important;
    right: 16px !important;
    font-size: 15px;
    padding: 16px;
    border-radius: 16px;
  }
  .panel.open { display: flex; }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: #1e3a8a;
    padding: 8px 4px;
  }
  .panel-header { cursor: grab; }
  .panel-header:active { cursor: grabbing; }
  .panel-header button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    line-height: 1;
    border-radius: 4px;
    opacity: 0.45;
    transition: opacity 0.15s, background 0.15s;
  }
  .panel-header button:hover { opacity: 0.8; }
  .panel-header button.active { opacity: 1; background: rgba(37,99,235,0.12); }
  .panel.pinned { border: 1.5px solid rgba(37,99,235,0.35); background: #f0f6ff; }

  input, select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
    color: #111;
  }
  input:focus, select:focus { border-color: #2563eb; }

  .row { display: flex; gap: 6px; }
  .row select { flex: 1; }
  .row select:last-child { flex: 0 0 70px; }
  .cfg-row { display: none; gap: 6px; }
  .cfg-row.open { display: flex; }
  .cfg-row select { flex: 1; min-width: 0; }
  .cfg-row select:last-child { flex: 0 0 70px; }

  .btn-primary {
    padding: 7px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }

  .result {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #eff6ff;
    border-radius: 6px;
    padding: 6px 10px;
  }
  .result code { font-size: 12px; color: #1e3a8a; word-break: break-all; }
  .result button {
    background: none;
    border: none;
    cursor: pointer;
    color: #2563eb;
    font-size: 11px;
    white-space: nowrap;
    margin-left: 6px;
  }

  .footer-link {
    text-align: center;
    color: #9ca3af;
    font-size: 11px;
    cursor: pointer;
  }
  .footer-link:hover { color: #2563eb; }

  .error { color: #ef4444; font-size: 11px; }
  .warn { color: #f59e0b; font-size: 11px; }
  .locked { color: #9ca3af; font-size: 12px; text-align: center; padding: 8px 0; }

  @media (prefers-color-scheme: dark) {
    .panel { background: #1e2433; color: #e2e8f0; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
    .panel.pinned { background: #1a2540; border-color: rgba(96,165,250,0.4); }
    .panel-header { color: #93c5fd; }
    input, select { background: #2d3748; border-color: #4a5568; color: #e2e8f0; }
    input:focus, select:focus { border-color: #3b82f6; }
    .result { background: #1e3a5f; }
    .result code { color: #93c5fd; }
    .result button { color: #60a5fa; }
    .btn-primary { background: #2563eb; }
    .btn-primary:hover { background: #3b82f6; }
    .footer-link { color: #6b7280; }
    .footer-link:hover { color: #60a5fa; }
  }
`;
shadow.appendChild(style);

// ==================== 悬浮球 ====================
const ball = document.createElement('div');
ball.className = 'ball';
ball.innerHTML = `<svg viewBox="0 0 24 24" fill="white"><path d="M12.65 10A6 6 0 1 0 10 12.65L18.35 21 21 18.35l-1.5-1.5-1.5 1.5-1.5-1.5 1.5-1.5L12.65 10zM7 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>`;
shadow.appendChild(ball);

// ==================== 浮层面板 ====================
const panel = document.createElement('div');
panel.className = 'panel';
panel.innerHTML = `
  <div class="panel-header">
    <span style="display:flex;align-items:center;gap:6px;">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      花钥
    </span>
    <div style="display:flex;gap:6px;align-items:center">
      <button id="fk-pin" title="钉住"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 3h14l-2 7v0l-3 2v3H10v-3l-3-2v0z"/></svg></button>
      <button id="fk-cfg" title="设置"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
    </div>
  </div>
  <input id="fk-master" type="password" placeholder="记忆密码" />
  <input id="fk-codename" placeholder="区分代号" />
  <div class="cfg-row" id="fk-cfg-row">
    <select id="fk-mode">
      <option value="alphanumeric">字母+数字</option>
      <option value="with_symbols">含特殊字符</option>
    </select>
    <select id="fk-length">
      <option value="8">8位</option>
      <option value="16" selected>16位</option>
      <option value="24">24位</option>
      <option value="32">32位</option>
    </select>
  </div>
  <div class="result" id="fk-result" style="display:none">
    <code id="fk-pwd"></code>
    <button id="fk-copy">复制</button>
  </div>
  <div class="warn" id="fk-warn" style="display:none">记忆密码不正确</div>
  <div class="footer-link" id="fk-manage">点击工具栏图标打开管理面板</div>
`;
shadow.appendChild(panel);
if (isMobile) panel.classList.add('mobile');

// ==================== 位置同步 ====================
let panelX = -1, panelY = -1; // -1 表示跟随悬浮球

function updatePositions() {
  const clampedY = Math.max(22, Math.min(window.innerHeight - 66, ballY));
  const clampedX = snapSide === 'right' ? window.innerWidth - 74 : 14;
  ball.classList.toggle('snap-left', snapSide === 'left');
  ball.style.top = `${clampedY}px`;
  ball.style.left = `${clampedX}px`;
  if (isMobile) {
    panel.style.top = `${Math.round((window.innerHeight - 320) / 2)}px`;
    return;
  }
  const ph = panel.offsetHeight || 300;
  if (snapSide === 'right') {
    panel.style.right = '12px';
    panel.style.left = 'auto';
  } else {
    panel.style.left = '12px';
    panel.style.right = 'auto';
  }
  panel.style.top = `${Math.max(12, Math.min(clampedY, window.innerHeight - ph - 8))}px`;
}
updatePositions();

// ==================== 拖拽（自由拖拽，松手吸边） ====================
ball.addEventListener('pointerdown', (e) => {
  isDragging = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartBallX = ballX;
  dragStartBallY = ballY;

  const onMove = (e: PointerEvent) => {
    if (Math.abs(e.clientX - dragStartX) > 4 || Math.abs(e.clientY - dragStartY) > 4) isDragging = true;
    if (isDragging) {
      ballX = dragStartBallX + (e.clientX - dragStartX);
      ballY = dragStartBallY + (e.clientY - dragStartY);
      updatePositions();
    }
  };
  const onUp = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (isDragging) {
      snapSide = ballX + 22 < window.innerWidth / 2 ? 'left' : 'right';
      ball.style.transition = 'left 0.2s ease, top 0.1s ease';
      updatePositions();
      setTimeout(() => { ball.style.transition = ''; }, 220);
      return;
    }
    togglePanel();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  e.preventDefault();
});

window.addEventListener('resize', updatePositions);

// ==================== 面板开关 ====================
function togglePanel() {
  panelOpen = !panelOpen;
  panel.classList.toggle('open', panelOpen);
}

function closePanel() {
  panelOpen = false;
  panel.classList.remove('open');
  panelX = -1; panelY = -1;
}

shadow.getElementById('fk-pin')!.addEventListener('click', () => {
  pinned = !pinned;
  const btn = shadow.getElementById('fk-pin')!;
  btn.classList.toggle('active', pinned);
  panel.classList.toggle('pinned', pinned);
});
shadow.getElementById('fk-cfg')!.addEventListener('click', () => {
  shadow.getElementById('fk-cfg-row')!.classList.toggle('open');
});

// 钉住时 header 可拖动面板
const panelHeader = panel.querySelector('.panel-header') as HTMLElement;
panelHeader.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  const startX = e.clientX, startY = e.clientY;
  const rect = panel.getBoundingClientRect();
  const startPX = rect.left, startPY = rect.top;
  panelHeader.setPointerCapture(e.pointerId);
  const onMove = (e: PointerEvent) => {
    panelX = startPX + (e.clientX - startX);
    panelY = startPY + (e.clientY - startY);
    updatePositions();
  };
  const onUp = () => {
    panelHeader.removeEventListener('pointermove', onMove);
    panelHeader.removeEventListener('pointerup', onUp);
  };
  panelHeader.addEventListener('pointermove', onMove);
  panelHeader.addEventListener('pointerup', onUp);
  e.preventDefault();
});

// 点击面板和悬浮球以外的区域关闭面板（钉住时不关闭）
document.addEventListener('pointerdown', (e) => {
  if (!panelOpen || pinned) return;
  if (!host.contains(e.target as Node)) closePanel();
}, true);

// ==================== 防抖自动生成 ====================
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function tryGenerate() {
  const masterPwd = (shadow.getElementById('fk-master') as HTMLInputElement).value;
  const codename = (shadow.getElementById('fk-codename') as HTMLInputElement).value.trim();
  const mode = (shadow.getElementById('fk-mode') as HTMLSelectElement).value;
  const length = parseInt((shadow.getElementById('fk-length') as HTMLSelectElement).value);
  const result = shadow.getElementById('fk-result')!;
  const warn = shadow.getElementById('fk-warn')!;

  if (!masterPwd || !codename) { result.style.display = 'none'; warn.style.display = 'none'; return; }

  chrome.runtime.sendMessage({ type: 'generatePasswordDirect', masterPwd, codename, mode, length }, (res) => {
    if (res?.password) {
      (shadow.getElementById('fk-pwd') as HTMLElement).textContent = res.password;
      result.style.display = 'flex';
      warn.style.display = res.verified ? 'none' : 'block';
    }
  });
}

function scheduleGenerate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(tryGenerate, 500);
}

['fk-master', 'fk-codename'].forEach(id => {
  shadow.getElementById(id)!.addEventListener('input', scheduleGenerate);
});
['fk-mode', 'fk-length'].forEach(id => {
  shadow.getElementById(id)!.addEventListener('change', scheduleGenerate);
});

// ==================== 复制 ====================
shadow.getElementById('fk-copy')!.addEventListener('click', () => {
  const pwd = (shadow.getElementById('fk-pwd') as HTMLElement).textContent || '';
  const codename = (shadow.getElementById('fk-codename') as HTMLInputElement).value.trim();
  const masterPwd = (shadow.getElementById('fk-master') as HTMLInputElement).value;
  const mode = (shadow.getElementById('fk-mode') as HTMLSelectElement).value;
  const length = parseInt((shadow.getElementById('fk-length') as HTMLSelectElement).value);
  navigator.clipboard.writeText(pwd).then(() => {
    const btn = shadow.getElementById('fk-copy')!;
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = '复制'; }, 1500);
    chrome.runtime.sendMessage({ type: 'generatePasswordDirect', masterPwd, codename, mode, length, url: location.href });
  });
});

// ==================== 内联自动填充浮层 ====================
const fillStyle = document.createElement('style');
fillStyle.textContent = `
  .fk-fill-popup {
    position: fixed;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    z-index: 2147483646;
    min-width: 180px;
    max-width: 280px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    overflow: hidden;
  }
  .fk-fill-header {
    padding: 6px 10px;
    background: #eff6ff;
    color: #1e3a8a;
    font-weight: 600;
    font-size: 11px;
    border-bottom: 1px solid #dbeafe;
  }
  .fk-fill-item {
    padding: 7px 10px;
    cursor: pointer;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fk-fill-item:hover { background: #eff6ff; color: #1d4ed8; }
  .fk-fill-body { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .fk-fill-body input {
    width: 100%; padding: 5px 8px; border: 1px solid #e5e7eb; border-radius: 5px;
    font-size: 12px; outline: none; box-sizing: border-box; color: #111;
  }
  .fk-fill-body input:focus { border-color: #2563eb; }
  .fk-fill-body button {
    padding: 5px; background: #2563eb; color: white; border: none;
    border-radius: 5px; cursor: pointer; font-size: 12px;
  }
  .fk-fill-body button:hover { background: #1d4ed8; }
  .fk-fill-err { color: #ef4444; font-size: 11px; }
  @media (prefers-color-scheme: dark) {
    .fk-fill-popup { background: #1e2433; border-color: #374151; }
    .fk-fill-header { background: #1a2540; color: #93c5fd; border-color: #2d3748; }
    .fk-fill-item { color: #e2e8f0; }
    .fk-fill-item:hover { background: #1e3a5f; color: #60a5fa; }
    .fk-fill-body input { background: #2d3748; border-color: #4a5568; color: #e2e8f0; }
    .fk-fill-body input:focus { border-color: #3b82f6; }
  }
`;
document.documentElement.appendChild(fillStyle);

let fillPopup: HTMLElement | null = null;

function removeFillPopup() {
  fillPopup?.remove();
  fillPopup = null;
}

function mountPopup(input: HTMLInputElement, content: HTMLElement) {
  removeFillPopup();
  const rect = input.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'fk-fill-popup';
  const header = document.createElement('div');
  header.className = 'fk-fill-header';
  header.innerHTML = `<span style="display:flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>花钥</span>`;
  popup.appendChild(header);
  popup.appendChild(content);
  popup.style.cssText = `position:absolute;top:${rect.bottom + window.scrollY + 2}px;left:${rect.left + window.scrollX}px;`;
  document.documentElement.appendChild(popup);
  fillPopup = popup;
}

function showEntries(input: HTMLInputElement, entries: { id: string; codename: string; description?: string }[]) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'max-height:200px;overflow-y:auto';
  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'fk-fill-item';
    const name = document.createElement('div');
    name.textContent = entry.codename || '（无代号）';
    item.appendChild(name);
    if (entry.description) {
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:11px;opacity:0.6;margin-top:1px';
      desc.textContent = entry.description;
      item.appendChild(desc);
    }
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'fillFromEntry', id: entry.id }, (res) => {
        if (res?.password) {
          input.value = res.password;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        removeFillPopup();
      });
    });
    wrap.appendChild(item);
  }
  mountPopup(input, wrap);
}

function showUnlockForm(input: HTMLInputElement) {
  const body = document.createElement('div');
  body.className = 'fk-fill-body';
  const pwdInput = document.createElement('input');
  pwdInput.type = 'password';
  pwdInput.placeholder = '记忆密码';
  const err = document.createElement('div');
  err.className = 'fk-fill-err';
  err.style.display = 'none';
  const btn = document.createElement('button');
  btn.textContent = '解锁';
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const pwd = pwdInput.value;
    if (!pwd) return;
    chrome.runtime.sendMessage({ type: 'unlockFromContent', masterPwd: pwd }, (res) => {
      if (res?.ok) {
        chrome.runtime.sendMessage({ type: 'getMatchingEntries', host: location.hostname }, (r) => {
          if (r?.entries?.length) showEntries(input, r.entries);
          else removeFillPopup();
        });
      } else {
        err.textContent = res?.error || '密码错误';
        err.style.display = 'block';
      }
    });
  });
  body.appendChild(pwdInput);
  body.appendChild(err);
  body.appendChild(btn);
  mountPopup(input, body);
  // 延迟聚焦，避免触发 focusout 关闭浮层
  setTimeout(() => pwdInput.focus(), 50);
}

function onPasswordFocus(e: FocusEvent) {
  const input = e.target as HTMLInputElement;
  chrome.runtime.sendMessage({ type: 'getMatchingEntries', host: location.hostname }, (res) => {
    if (res?.locked) { showUnlockForm(input); return; }
    if (res?.entries?.length) showEntries(input, res.entries);
  });
}

document.addEventListener('focusin', (e) => {
  const t = e.target as HTMLElement;
  if (fillPopup?.contains(t)) return;
  if (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'password') onPasswordFocus(e as FocusEvent);
  else removeFillPopup();
}, true);

document.addEventListener('focusout', (e) => {
  setTimeout(() => {
    if (!fillPopup?.contains(document.activeElement)) removeFillPopup();
  }, 150);
}, true);

// ==================== 上报系统主题 ====================
function reportTheme() {
  chrome.runtime.sendMessage({ type: 'themeChanged', dark: window.matchMedia('(prefers-color-scheme: dark)').matches }).catch(() => {});
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reportTheme);
reportTheme();

// ==================== 接收消息 ====================
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'fillPassword') {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs.forEach(input => {
      input.value = msg.password;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  if (msg.type === 'getPageMeta') {
    sendResponse({
      title: document.title,
      url: location.href,
      favicon: (document.querySelector('link[rel~="icon"]') as HTMLLinkElement)?.href || `${location.origin}/favicon.ico`,
      image: (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || (document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement)?.content || '',
      description: (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content || '',
    });
    return;
  }
  sendResponse();
});
