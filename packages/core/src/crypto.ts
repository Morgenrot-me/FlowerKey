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
const ENCRYPT_VERSION = 0x01;

const CHARSET_ALPHANUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARSET_SYMBOLS = CHARSET_ALPHANUM + '!@#$%^&*()-_=+[]{}|;:,.<>?';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 将字符串编码为 ArrayBuffer（兼容 Web Crypto BufferSource） */
function encode(str: string): ArrayBuffer {
  return encoder.encode(str).buffer as ArrayBuffer;
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
export async function createVerifyHash(masterPwd: string, userSalt: string): Promise<string> {
  return deriveRawKey(masterPwd, SALT_PREFIX_VERIFY + userSalt);
}

/** 验证记忆密码是否正确 */
export async function verifyMasterPassword(
  masterPwd: string, userSalt: string, storedHash: string
): Promise<boolean> {
  const hash = await deriveRawKey(masterPwd, SALT_PREFIX_VERIFY + userSalt);
  return hash === storedHash;
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
    const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    // 找一个不是首位也不是 digitPos 的位置
    const symPos = digitPos === length - 1 ? length - 2 : length - 1;
    arr[symPos] = SYMBOLS[mixBytes[3] % SYMBOLS.length];
  }

  return arr.join('');
}

/**
 * 生成最终密码
 * @param masterPwd 记忆密码
 * @param userSalt 用户自定义盐
 * @param codename 区分代号
 * @param mode 字符集模式
 * @param length 密码长度（默认16）
 */
export async function generatePassword(
  masterPwd: string,
  userSalt: string,
  codename: string,
  mode: CharsetMode = 'alphanumeric',
  length = 16
): Promise<string> {
  const masterKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encode(userSalt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    await crypto.subtle.importKey('raw', encode(masterPwd), 'PBKDF2', false, ['deriveBits']),
    KEY_LENGTH
  );
  const rawBytes = await hmacGenerate(masterKeyBits, codename);
  const mixBytes = await hmacGenerate(masterKeyBits, codename + '_mix');
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
  if (bytes[0] !== ENCRYPT_VERSION) throw new Error('不支持的加密版本');
  const iv = bytes.slice(1, 13);
  const ciphertext = bytes.slice(13);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource
  );
  return decoder.decode(plaintext);
}
