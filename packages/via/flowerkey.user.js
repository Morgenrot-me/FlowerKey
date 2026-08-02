// ==UserScript==
// @name         花钥 FlowerKey
// @namespace    https://github.com/flowerkey
// @version      0.4.1
// @description  密码生成工具 - 悬浮球快速生成并填充密码
// @author       FlowerKey
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ==================== 加密核心（内联自 crypto.ts）====================
  const ITERATIONS = 600000;
  const KEY_LENGTH = 256;
  const CHARSET_ALPHANUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const CHARSET_SYMBOLS = CHARSET_ALPHANUM + '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const DIGITS = '0123456789';
  const enc = new TextEncoder();

  function encode(str) { return enc.encode(str).buffer; }

  async function generatePassword(masterPwd, identitySecret, codename, mode = 'alphanumeric', length = 16) {
    if (mode !== 'alphanumeric' && mode !== 'with_symbols') {
      throw new Error('FK-DP1不支持该密码类型');
    }
    if (![8, 16, 32].includes(length)) {
      throw new Error('FK-DP1仅支持8、16或32位密码');
    }
    if (!masterPwd.trim()) throw new Error('记忆密码不能为空');
    if (!identitySecret.trim()) throw new Error('身份密语不能为空');
    const normalizedIdentity = identitySecret.normalize('NFC');
    const normalizedCodename = codename.trim().normalize('NFC')
      .replace(/[A-Z]/g, char => char.toLowerCase());
    if (!normalizedCodename) throw new Error('区分代号不能为空');
    const baseKey = await crypto.subtle.importKey('raw', encode(masterPwd), 'PBKDF2', false, ['deriveBits']);
    const masterKeyBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: encode(normalizedIdentity), iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey, KEY_LENGTH
    );
    const hmacKey = await crypto.subtle.importKey('raw', masterKeyBits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const rawBytes = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, encode(normalizedCodename)));
    const mixBytes = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, encode(normalizedCodename + '_mix')));
    const withSymbols = mode === 'with_symbols';
    const charset = withSymbols ? CHARSET_SYMBOLS : CHARSET_ALPHANUM;
    const arr = Array.from({ length }, (_, i) => charset[rawBytes[i % rawBytes.length] % charset.length]);
    arr[0] = LETTERS[mixBytes[0] % LETTERS.length];
    const digitPos = 1 + (mixBytes[1] % (length - 1));
    arr[digitPos] = DIGITS[mixBytes[2] % DIGITS.length];
    if (withSymbols) {
      const SYMS = '!@#$%^&*()-_=+[]{}|;:,.<>?';
      let symPos = length - 1;
      if (symPos === digitPos) symPos--;
      if (symPos === 0) symPos = digitPos === 1 ? 2 : 1;
      arr[symPos] = SYMS[mixBytes[3] % SYMS.length];
    }
    return arr.join('');
  }

  // ==================== UI ====================
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }
    .ball {
      position: fixed;
      right: 16px;
      bottom: 120px;
      width: 46px;
      height: 46px;
      background: rgba(37,99,235,0.85);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 4px 16px rgba(37,99,235,0.4);
      font-size: 22px;
      user-select: none;
      touch-action: none;
      transition: transform 0.15s;
    }
    .ball:active { transform: scale(0.9); }
    .panel {
      position: fixed;
      bottom: 80px;
      right: 12px;
      width: 300px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      padding: 16px;
      display: none;
      flex-direction: column;
      gap: 10px;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
    }
    .panel.open { display: flex; }
    .panel-title {
      font-weight: 600;
      color: #1e3a8a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #9ca3af;
      padding: 0 4px;
      line-height: 1;
    }
    input, select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      color: #111;
    }
    input:focus, select:focus { border-color: #2563eb; }
    .row { display: flex; gap: 8px; }
    .row select { flex: 1; }
    .row select:last-child { flex: 0 0 72px; }
    .btn {
      width: 100%;
      padding: 10px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn:disabled { opacity: 0.5; }
    .result {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #eff6ff;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .result code { font-size: 13px; color: #1e3a8a; word-break: break-all; flex: 1; }
    .result-btns { display: flex; gap: 6px; margin-left: 8px; }
    .result-btns button {
      background: none;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 12px;
      color: #2563eb;
      cursor: pointer;
      white-space: nowrap;
    }
    .err { color: #ef4444; font-size: 12px; text-align: center; }
    *:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  `;
  shadow.appendChild(style);

  // 悬浮球
  const ball = document.createElement('div');
  ball.className = 'ball';
  ball.textContent = '🔑';
  shadow.appendChild(ball);

  // 面板
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-title">
      <span>🔑 花钥</span>
      <button class="close-btn">✕</button>
    </div>
    <input id="fk-master" type="password" placeholder="主密码" autocomplete="current-password" />
    <input id="fk-identity" type="password" placeholder="身份密语" autocomplete="off" />
    <input id="fk-codename" type="text" placeholder="区分代号（如 微信、支付宝、GitHub）" />
    <div style="font-size:11px;color:#6b7280">区分代号中的英文字母不区分大小写。</div>
    <div class="row">
      <select id="fk-mode">
        <option value="alphanumeric">字母+数字</option>
        <option value="with_symbols">含特殊字符</option>
      </select>
      <select id="fk-len">
        <option value="8">8位（旧系统）</option>
        <option value="16" selected>16位（默认）</option>
        <option value="32">32位</option>
      </select>
    </div>
    <button class="btn" id="fk-gen">生成密码</button>
    <div class="result" id="fk-result" style="display:none">
      <code id="fk-pwd"></code>
      <div class="result-btns">
        <button id="fk-copy">复制</button>
        <button id="fk-fill">填充</button>
      </div>
    </div>
    <div class="err" id="fk-err"></div>
  `;
  shadow.appendChild(panel);

  // ==================== 逻辑 ====================
  let generatedPwd = '';

  ball.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      panel.querySelector('#fk-codename').focus();
    }
  });

  panel.querySelector('.close-btn').addEventListener('click', () => {
    panel.classList.remove('open');
  });

  panel.querySelector('#fk-gen').addEventListener('click', async () => {
    const master = panel.querySelector('#fk-master').value;
    const identity = panel.querySelector('#fk-identity').value;
    const codename = panel.querySelector('#fk-codename').value;
    const mode = panel.querySelector('#fk-mode').value;
    const length = parseInt(panel.querySelector('#fk-len').value);
    const errEl = panel.querySelector('#fk-err');
    const resultEl = panel.querySelector('#fk-result');

    errEl.textContent = '';
    if (!master) { errEl.textContent = '请输入主密码'; return; }
    if (!identity) { errEl.textContent = '请输入身份密语'; return; }
    if (!codename.trim()) { errEl.textContent = '请输入区分代号'; return; }

    const btn = panel.querySelector('#fk-gen');
    btn.disabled = true;
    btn.textContent = '生成中...';
    try {
      generatedPwd = await generatePassword(master, identity, codename, mode, length);
      const masked = generatedPwd.length <= 10 ? generatedPwd : generatedPwd.slice(0, 5) + '•••••' + generatedPwd.slice(-5);
      panel.querySelector('#fk-pwd').textContent = masked;
      resultEl.style.display = 'flex';

    } catch (e) {
      errEl.textContent = '生成失败：' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '生成密码';
    }
  });

  panel.querySelector('#fk-copy').addEventListener('click', async () => {
    if (!generatedPwd) return;
    await navigator.clipboard.writeText(generatedPwd);
    const btn = panel.querySelector('#fk-copy');
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = '复制'; }, 1500);
  });

  panel.querySelector('#fk-fill').addEventListener('click', () => {
    if (!generatedPwd) return;
    // 找当前页面所有密码框，填入
    const inputs = document.querySelectorAll('input[type=password]');
    if (!inputs.length) {
      panel.querySelector('#fk-err').textContent = '未找到密码框';
      return;
    }
    inputs.forEach(input => {
      input.value = generatedPwd;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    panel.classList.remove('open');
  });

  // 回车触发生成
  panel.querySelector('#fk-codename').addEventListener('keyup', e => {
    if (e.key === 'Enter') panel.querySelector('#fk-gen').click();
  });
})();
