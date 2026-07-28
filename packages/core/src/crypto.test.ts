/**
 * 花钥 FlowerKey - 核心加密测试
 * 覆盖盐、密码生成、AES 加密和恢复码的关键回归路径
 */
import { describe, expect, it } from 'vitest';
import {
  createVerifyHash,
  decrypt,
  decryptMasterPwdWithRecovery,
  deriveDatabaseKey,
  encrypt,
  encryptMasterPwdWithRecovery,
  generateDeviceId,
  generatePassword,
  generateRecoveryCode,
  generateSalt,
  normalizeCodename,
  prepareIdentitySecret,
  verifyMasterPassword,
  bytesToBase64,
  base64ToBytes,
} from './crypto.js';

const symbolPattern = /[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]/;
const letterPattern = /[A-Za-z]/;
const digitPattern = /\d/;

describe('身份密语首次设置校验', () => {
  it('保留内部空格与大小写，并只执行 NFC 规范化', () => {
    expect(prepareIdentitySecret('我的 GitHub e\u0301 身份')).toBe('我的 GitHub é 身份');
  });

  it('拒绝首尾空白而不是静默裁剪', () => {
    expect(() => prepareIdentitySecret(' 身份密语')).toThrow('首尾不能包含空白');
    expect(() => prepareIdentitySecret('身份密语\u3000')).toThrow('首尾不能包含空白');
  });
});

const FROZEN_PASSWORD_VECTORS = [
  ['微信', 'alphanumeric', 8, 'nWH46L86'],
  ['微信', 'alphanumeric', 16, 'nWH4ML8643UhgxED'],
  ['微信', 'alphanumeric', 32, 'nWH4M68643UhgxEDONcxrIfACZQYC2Ac'],
  ['支付宝', 'with_symbols', 8, 'Z*M&1{|>'],
  ['支付宝', 'with_symbols', 16, 'Z1M&7{|WtJ8{-PX>'],
  ['支付宝', 'with_symbols', 32, 'Z*M&7{|WtJ8{-PX1HF8m4_#>.4&h-3f>'],
  ['GitHub-工作', 'alphanumeric', 16, 'UXOWCqi8siOSpjR7'],
] as const;

describe('crypto', () => {
  it('generates hex salts and device ids with fresh random values', () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    const deviceId = generateDeviceId();

    expect(saltA).toMatch(/^[0-9a-f]{32}$/);
    expect(saltB).toMatch(/^[0-9a-f]{32}$/);
    expect(saltA).not.toBe(saltB);
    expect(deviceId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('verifies master password hashes with the original password only', async () => {
    const verifySalt = 'verify-salt';
    const hash = await createVerifyHash('correct horse battery staple', verifySalt);

    await expect(verifyMasterPassword('correct horse battery staple', verifySalt, hash)).resolves.toBe(true);
    await expect(verifyMasterPassword('wrong password', verifySalt, hash)).resolves.toBe(false);
  });

  it('rejects empty string password from brute force timing-safe comparison', async () => {
    const verifySalt = 'verify-salt';
    const hash = await createVerifyHash('real', verifySalt);
    // 空密码验证，确保 timingSafeHexEqual 不会崩溃
    await expect(verifyMasterPassword('', verifySalt, hash)).resolves.toBe(false);
  });

  it('generates deterministic passwords with requested charset and length', async () => {
    const first = await generatePassword('master', 'FlowerKey', 'github', 'alphanumeric', 16);
    const second = await generatePassword('master', 'FlowerKey', 'github', 'alphanumeric', 16);
    const different = await generatePassword('master', 'FlowerKey', 'email', 'alphanumeric', 16);
    const withSymbols = await generatePassword('master', 'FlowerKey', 'github', 'with_symbols', 32);

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toHaveLength(16);
    expect(first).toMatch(/^[A-Za-z0-9]+$/);
    expect(first).toMatch(letterPattern);
    expect(first).toMatch(digitPattern);
    expect(withSymbols).toHaveLength(32);
    expect(withSymbols).toMatch(letterPattern);
    expect(withSymbols).toMatch(digitPattern);
    expect(withSymbols).toMatch(symbolPattern);
  });

  it('treats ASCII codename letters as case-insensitive after NFC normalization', async () => {
    const expected = await generatePassword('master', 'identity', 'github-é-工作', 'alphanumeric', 16);

    await expect(
      generatePassword('master', 'identity', 'GitHub-e\u0301-工作', 'alphanumeric', 16),
    ).resolves.toBe(expected);
    await expect(
      generatePassword('master', 'identity', ' GITHUB-é-工作 ', 'alphanumeric', 16),
    ).resolves.toBe(expected);
  });

  it('uses the frozen ECMAScript whitespace set for codename trimming', () => {
    expect(normalizeCodename('\u3000GitHub\u00a0')).toBe('github');
    expect(normalizeCodename('\u001cGitHub\u001c')).toBe('\u001cgithub\u001c');
  });

  it('normalizes the identity secret with NFC while preserving case', async () => {
    const composed = await generatePassword('master', '身份-é-A', '微信', 'alphanumeric', 16);
    const decomposed = await generatePassword('master', '身份-e\u0301-A', '微信', 'alphanumeric', 16);
    const differentCase = await generatePassword('master', '身份-é-a', '微信', 'alphanumeric', 16);

    expect(decomposed).toBe(composed);
    expect(differentCase).not.toBe(composed);
  });

  it('accepts only the six frozen FK-DP1 profiles', async () => {
    for (const mode of ['alphanumeric', 'with_symbols'] as const) {
      for (const length of [8, 16, 32]) {
        await expect(generatePassword('master', 'identity', '微信', mode, length)).resolves.toHaveLength(length);
      }
    }

    await expect(generatePassword('master', 'identity', '微信', 'alphanumeric', 24))
      .rejects.toThrow('FK-DP1仅支持8、16或32位密码');
    await expect(generatePassword('master', 'identity', '微信', 'invalid' as never, 16))
      .rejects.toThrow('FK-DP1不支持该密码类型');
  });

  it('rejects missing root inputs and empty codenames', async () => {
    await expect(generatePassword('', '身份密语', '微信', 'alphanumeric', 16))
      .rejects.toThrow('记忆密码不能为空');
    await expect(generatePassword('master', '', '微信', 'alphanumeric', 16))
      .rejects.toThrow('身份密语不能为空');
    await expect(generatePassword('master', '   ', '微信', 'alphanumeric', 16))
      .rejects.toThrow('身份密语不能为空');
    await expect(generatePassword('master', '身份密语', '   ', 'alphanumeric', 16))
      .rejects.toThrow('区分代号不能为空');
  });

  it('matches the frozen FK-DP1 password vectors', async () => {
    for (const [codename, mode, length, expected] of FROZEN_PASSWORD_VECTORS) {
      await expect(
        generatePassword(
          'correct horse battery staple',
          '只属于我的身份句',
          codename,
          mode,
          length,
        ),
      ).resolves.toBe(expected);
    }
  });

  it('derives different passwords for different codenames with same params', async () => {
    const p1 = await generatePassword('master', 'FlowerKey', 'codename-a', 'alphanumeric', 16);
    const p2 = await generatePassword('master', 'FlowerKey', 'codename-b', 'alphanumeric', 16);
    expect(p1).not.toBe(p2);
    // 不同 master password 生成不同密码
    const p3 = await generatePassword('other', 'FlowerKey', 'codename-a', 'alphanumeric', 16);
    expect(p1).not.toBe(p3);
  });

  it('encrypts and decrypts database values with versioned AES-GCM payloads', async () => {
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const wrongKey = await deriveDatabaseKey('other-master', 'FlowerKey');
    const encrypted = await encrypt('secret text', key);
    const bytes = new Uint8Array(encrypted);

    expect(bytes[0]).toBe(0x01);
    await expect(decrypt(encrypted, key)).resolves.toBe('secret text');
    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
    await expect(decrypt(new Uint8Array([0x01, 1, 2]).buffer, key)).rejects.toThrow('加密数据格式错误');

    const unsupported = encrypted.slice(0);
    new Uint8Array(unsupported)[0] = 0xff;
    await expect(decrypt(unsupported, key)).rejects.toThrow('不支持的加密版本');
  });

  it('produces unique IVs for repeated encryptions', async () => {
    const key = await deriveDatabaseKey('master', 'FlowerKey');
    const e1 = new Uint8Array(await encrypt('same text', key));
    const e2 = new Uint8Array(await encrypt('same text', key));
    // IV 在 bytes 1-12 位置，应该不同
    const iv1 = e1.slice(1, 13);
    const iv2 = e2.slice(1, 13);
    expect(iv1).not.toEqual(iv2);
    // 密文不同
    const ct1 = e1.slice(13);
    const ct2 = e2.slice(13);
    expect(ct1).not.toEqual(ct2);
  });

  it('derives different db keys for different salts', async () => {
    const k1 = await deriveDatabaseKey('master', 'FlowerKey');
    const k2 = await deriveDatabaseKey('master', 'OtherSalt');
    // 不同盐导出不同密钥：加密后另一把密钥无法解密
    const encrypted = await encrypt('data', k1);
    await expect(decrypt(encrypted, k2)).rejects.toThrow();
  });

  it('restores master password with the recovery code only', async () => {
    const recoveryCode = generateRecoveryCode();
    expect(recoveryCode).toMatch(/^[0-9a-f]{64}$/);

    const encrypted = await encryptMasterPwdWithRecovery('master-password', recoveryCode);

    await expect(
      decryptMasterPwdWithRecovery(encrypted.encryptedMasterPwd, encrypted.recoverySalt, recoveryCode)
    ).resolves.toBe('master-password');
    await expect(
      decryptMasterPwdWithRecovery(encrypted.encryptedMasterPwd, encrypted.recoverySalt, generateRecoveryCode())
    ).rejects.toThrow();
  });

  it('round-trips base64 encoding', () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
    const encoded = bytesToBase64(original);
    expect(typeof encoded).toBe('string');
    const decoded = base64ToBytes(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips empty array through base64', () => {
    const encoded = bytesToBase64(new Uint8Array(0));
    const decoded = base64ToBytes(encoded);
    expect(decoded.length).toBe(0);
  });
});
