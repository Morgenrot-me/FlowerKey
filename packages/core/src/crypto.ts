/**
 * 花钥 FlowerKey - 核心加密库
 * 基于 Web Crypto API，零外部依赖
 * 提供：密钥派生(PBKDF2)、密码生成(HMAC-SHA256)、数据加密(AES-256-GCM)
 */

import type { CharsetMode } from './models.js';

const ITERATIONS = 600_000;
const KEY_LENGTH = 256;
const SALT_PREFIX_VERIFY = 'flowerkey_verify_';
const SALT_PREFIX_DBENC = 'flowerkey_dbenc_';
const SALT_PREFIX_RECOVERY = 'flowerkey_recovery_';
const ENCRYPT_VERSION = 0x01;

const BASE64_CHUNK_SIZE = 0x8000;
const CHARSET_ALPHANUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARSET_SYMBOLS = CHARSET_ALPHANUM + '!@#$%^&*()-_=+[]{}|;:,.<>?';
const FK_DP1_LENGTHS = [8, 16, 32] as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 将字符串编码为精准长度的 ArrayBuffer（避免 V8 缓冲池溢出问题） */
function encode(str: string): ArrayBuffer {
  const bytes = encoder.encode(str);
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

/** 将 ArrayBuffer 转为十六进制字符串 */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 将十六进制字符串转为 Uint8Array */
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** 常量时间比较十六进制哈希，避免提前退出泄露差异位置 */
function timingSafeHexEqual(a: string, b: string): boolean {
  const aBytes = hexToBuf(a);
  const bBytes = hexToBuf(b);
  let diff = aBytes.length ^ bBytes.length;
  const len = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

/** Uint8Array 转 base64，分块避免大数组展开导致调用栈溢出 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

/** base64 转 Uint8Array */
export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 生成随机盐（16字节，返回十六进制） */
export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer as ArrayBuffer);
}

/** 生成设备ID */
export function generateDeviceId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer as ArrayBuffer);
}

// ==================== 密钥派生 ====================

/** PBKDF2 密钥派生（返回 CryptoKey） */
async function deriveKey(
  password: string,
  salt: string,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw', encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,
    usage
  );
}

/** PBKDF2 派生原始字节（返回 hex） */
async function deriveRawKey(password: string, salt: string): Promise<string> {
  const baseKey = await crypto.subtle.importKey(
    'raw', encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    KEY_LENGTH
  );
  return bufToHex(bits);
}

// ==================== 记忆密码验证 ====================

/** 生成记忆密码的验证哈希（首次设置时调用，存储返回值） */
export async function createVerifyHash(masterPwd: string, verifySalt: string): Promise<string> {
  return deriveRawKey(masterPwd, SALT_PREFIX_VERIFY + verifySalt);
}

/** 验证记忆密码是否正确 */
export async function verifyMasterPassword(
  masterPwd: string, verifySalt: string, storedHash: string
): Promise<boolean> {
  const hash = await deriveRawKey(masterPwd, SALT_PREFIX_VERIFY + verifySalt);
  return timingSafeHexEqual(hash, storedHash);
}

// ==================== 密码生成 ====================

/** 用 HMAC-SHA256 生成密码原始字节 */
async function hmacGenerate(masterKey: ArrayBuffer, codename: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw', masterKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', key, encode(codename));
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';

/**
 * FK-DP1 区分代号规范化。
 * 首尾空白不属于代号；内部仅统一 Unicode NFC 与 ASCII 英文字母大小写。
 */
export function normalizeCodename(codename: string): string {
  return codename
    .trim()
    .normalize('NFC')
    .replace(/[A-Z]/g, char => char.toLowerCase());
}

/** FK-DP1 身份密语仅做 NFC 规范化，保留大小写、空格与标点。 */
function normalizeIdentitySecret(identitySecret: string): string {
  return identitySecret.normalize('NFC');
}

/**
 * 首次设置身份密语时执行的人因安全校验。
 * 首尾空白可能在多年后的空设备上难以复现，因此明确拒绝，绝不静默裁剪。
 */
export function prepareIdentitySecret(identitySecret: string): string {
  if (!identitySecret.trim()) {
    throw new Error('身份密语不能为空');
  }
  if (identitySecret !== identitySecret.trim()) {
    throw new Error('身份密语首尾不能包含空白');
  }
  return normalizeIdentitySecret(identitySecret);
}

/**
 * 将原始字节编码为指定字符集的密码字符串
 * 用 mixBytes 确定性地保证：首字符为字母、至少含一个数字
 * with_symbols 模式额外保证至少含一个特殊字符
 */
function encodePassword(
  bytes: Uint8Array,
  mixBytes: Uint8Array,
  charset: string,
  length: number,
  withSymbols: boolean
): string {
  const arr = Array.from({ length }, (_, i) => charset[bytes[i % bytes.length] % charset.length]);

  // 用 mixBytes[0] 决定字母插入位置（首位），mixBytes[1] 决定数字位置（非首位）
  arr[0] = LETTERS[mixBytes[0] % LETTERS.length];
  const digitPos = 1 + (mixBytes[1] % (length - 1));
  arr[digitPos] = DIGITS[mixBytes[2] % DIGITS.length];

  if (withSymbols) {
    // 从末尾找第一个不与 0（字母位）和 digitPos 冲突的位置
    let symPos = length - 1;
    if (symPos === digitPos) symPos--;
    if (symPos === 0) symPos = digitPos === 1 ? 2 : 1;
    arr[symPos] = SYMBOLS[mixBytes[3] % SYMBOLS.length];
  }

  return arr.join('');
}

/**
 * 生成最终密码
 * @param masterPwd 记忆密码
 * @param identitySecret 身份密语（生成根输入，不是公开协议盐）
 * @param codename 区分代号
 * @param mode 字符集模式
 * @param length 密码长度（默认16）
 */
export async function generatePassword(
  masterPwd: string,
  identitySecret: string,
  codename: string,
  mode: CharsetMode = 'alphanumeric',
  length = 16
): Promise<string> {
  if (!masterPwd.trim()) {
    throw new Error('记忆密码不能为空');
  }
  if (!identitySecret.trim()) {
    throw new Error('身份密语不能为空');
  }
  if (mode !== 'alphanumeric' && mode !== 'with_symbols') {
    throw new Error('FK-DP1不支持该密码类型');
  }
  if (!(FK_DP1_LENGTHS as readonly number[]).includes(length)) {
    throw new Error('FK-DP1仅支持8、16或32位密码');
  }
  const normalizedIdentitySecret = normalizeIdentitySecret(identitySecret);
  const normalizedCodename = normalizeCodename(codename);
  if (!normalizedCodename) {
    throw new Error('区分代号不能为空');
  }
  const masterKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encode(normalizedIdentitySecret),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    await crypto.subtle.importKey('raw', encode(masterPwd), 'PBKDF2', false, ['deriveBits']),
    KEY_LENGTH
  );
  const rawBytes = await hmacGenerate(masterKeyBits, normalizedCodename);
  const mixBytes = await hmacGenerate(masterKeyBits, normalizedCodename + '_mix');
  const withSymbols = mode === 'with_symbols';
  const charset = withSymbols ? CHARSET_SYMBOLS : CHARSET_ALPHANUM;
  return encodePassword(new Uint8Array(rawBytes), new Uint8Array(mixBytes), charset, length, withSymbols);
}

// ==================== 数据加密 (AES-256-GCM) ====================

/** 派生数据库加密密钥 */
export async function deriveDatabaseKey(masterPwd: string, userSalt: string): Promise<CryptoKey> {
  return deriveKey(masterPwd, SALT_PREFIX_DBENC + userSalt, ['encrypt', 'decrypt']);
}

/** AES-256-GCM 加密，返回 [version(1B) + IV(12B) + ciphertext+tag] */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key, encode(plaintext)
  );
  const result = new Uint8Array(1 + 12 + ciphertext.byteLength);
  result[0] = ENCRYPT_VERSION;
  result.set(iv, 1);
  result.set(new Uint8Array(ciphertext), 13);
  return result.buffer as ArrayBuffer;
}

/** AES-256-GCM 解密 */
export async function decrypt(data: ArrayBuffer, key: CryptoKey): Promise<string> {
  const bytes = new Uint8Array(data);
  if (bytes.byteLength < 13) throw new Error('加密数据格式错误');
  if (bytes[0] !== ENCRYPT_VERSION) throw new Error('不支持的加密版本');
  const iv = bytes.slice(1, 13);
  const ciphertext = bytes.slice(13);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource
  );
  return decoder.decode(plaintext);
}

// ==================== 恢复码 ====================

/** 生成随机恢复码（32字节 = 64位十六进制，分组显示用） */
export function generateRecoveryCode(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer as ArrayBuffer);
}

/** 用恢复码加密主密码，返回 { encryptedMasterPwd, recoverySalt } */
export async function encryptMasterPwdWithRecovery(
  masterPwd: string, recoveryCode: string
): Promise<{ encryptedMasterPwd: string; recoverySalt: string }> {
  const recoverySalt = generateSalt();
  const key = await deriveKey(recoveryCode, SALT_PREFIX_RECOVERY + recoverySalt, ['encrypt', 'decrypt']);
  const buf = await encrypt(masterPwd, key);
  const encryptedMasterPwd = bytesToBase64(new Uint8Array(buf));
  return { encryptedMasterPwd, recoverySalt };
}

/** 用恢复码解密主密码 */
export async function decryptMasterPwdWithRecovery(
  encryptedMasterPwd: string, recoverySalt: string, recoveryCode: string
): Promise<string> {
  const key = await deriveKey(recoveryCode, SALT_PREFIX_RECOVERY + recoverySalt, ['encrypt', 'decrypt']);
  const bytes = base64ToBytes(encryptedMasterPwd);
  return decrypt(bytes.buffer as ArrayBuffer, key);
}
