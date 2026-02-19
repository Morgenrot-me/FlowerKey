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
ball.innerHTML = `<svg viewBox="0 0 24 24" fill="#1e40af"><path d="M12.65 10A6 6 0 1 0 10 12.65L18.35 21 21 18.35l-1.5-1.5-1.5 1.5-1.5-1.5 1.5-1.5L12.65 10zM7 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>`;
shadow.appendChild(ball);

// ==================== 浮层面板 ====================
const panel = document.createElement('div');
panel.className = 'panel';
panel.innerHTML = `
  <div class="panel-header">
    <span>🔑 花钥</span>
    <div style="display:flex;gap:6px;align-items:center">
      <button id="fk-pin" title="钉住">📌</button>
      <button id="fk-cfg" title="设置">⚙</button>
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
  const clampedX = Math.max(0, Math.min(window.innerWidth - 44, ballX));
  ball.style.top = `${clampedY}px`;
  ball.style.left = `${clampedX}px`;
  if (isMobile) {
    panel.style.top = `${Math.round((window.innerHeight - 320) / 2)}px`;
    return;
  }
  const ph = panel.offsetHeight || 300;
  if (panelX >= 0) {
    panel.style.left = `${Math.max(0, Math.min(window.innerWidth - 280, panelX))}px`;
    panel.style.right = 'auto';
    panel.style.top = `${Math.max(12, Math.min(window.innerHeight - ph - 8, panelY))}px`;
  } else {
    if (snapSide === 'right') {
      panel.style.right = `${window.innerWidth - clampedX - 44 + 8}px`;
      panel.style.left = 'auto';
    } else {
      panel.style.left = `${clampedX + 52}px`;
      panel.style.right = 'auto';
    }
    panel.style.top = `${Math.max(12, Math.min(clampedY, window.innerHeight - ph - 8))}px`;
  }
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
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (isDragging) {
      const midX = window.innerWidth / 2;
      snapSide = ballX + 22 < midX ? 'left' : 'right';
      ballX = snapSide === 'right' ? window.innerWidth - 74 : 14;
      ball.style.transition = 'left 0.2s ease, top 0.1s ease';
      updatePositions();
      setTimeout(() => { ball.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease'; }, 220);
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
  navigator.clipboard.writeText(pwd).then(() => {
    const btn = shadow.getElementById('fk-copy')!;
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = '复制'; }, 1500);
  });
});

// ==================== 接收消息 ====================
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'fillPassword') {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs.forEach(input => {
      input.value = msg.password;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  sendResponse();
});
