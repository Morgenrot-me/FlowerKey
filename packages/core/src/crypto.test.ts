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
  verifyMasterPassword,
} from './crypto.js';

const symbolPattern = /[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]/;

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

  it('generates deterministic passwords with requested charset and length', async () => {
    const first = await generatePassword('master', 'FlowerKey', 'github', 'alphanumeric', 18);
    const second = await generatePassword('master', 'FlowerKey', 'github', 'alphanumeric', 18);
    const different = await generatePassword('master', 'FlowerKey', 'email', 'alphanumeric', 18);
    const withSymbols = await generatePassword('master', 'FlowerKey', 'github', 'with_symbols', 20);

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toHaveLength(18);
    expect(first).toMatch(/^[A-Za-z0-9]+$/);
    expect(withSymbols).toHaveLength(20);
    expect(withSymbols).toMatch(symbolPattern);
    await expect(generatePassword('master', 'FlowerKey', 'github', 'alphanumeric', 7)).rejects.toThrow('密码长度不能小于8');
    await expect(generatePassword('master', 'FlowerKey', 'github', 'alphanumeric', 257)).rejects.toThrow('密码长度不能大于256');
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
});
