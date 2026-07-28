/**
 * 花钥首屏直算与条目保存测试。
 * 验证区分代号显示文本可保留原样，但匹配遵循 FK-DP1 规范化规则。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  runDirectPasswordFlow,
  savePasswordEntry,
  type DirectPasswordRuntime,
} from './direct-password.js';

function createUninitializedRuntime(): DirectPasswordRuntime {
  return {
    getMasterData: vi.fn().mockResolvedValue(undefined),
    verifyMasterPassword: vi.fn(),
    generatePassword: vi.fn(async (masterPwd, identitySecret, codename, mode, length) =>
      `${masterPwd}|${identitySecret}|${codename}|${mode}|${length}`),
    listPasswordEntries: vi.fn().mockResolvedValue([]),
    createPasswordEntry: vi.fn(),
    touchLastUsed: vi.fn(),
    withWritableDbKey: async <T>(_masterPwd: string, _identitySecret: string, run: () => Promise<T>) => run(),
  };
}

describe('savePasswordEntry', () => {
  it('reuses an existing entry when only ASCII case and NFC form differ', async () => {
    const touchLastUsed = vi.fn().mockResolvedValue(undefined);
    const createPasswordEntry = vi.fn();
    const runtime = {
      getMasterData: vi.fn().mockResolvedValue({
        verifyHash: 'hash',
        verifySalt: 'verify-salt',
        userSalt: '身份密语',
        createdAt: 1,
      }),
      verifyMasterPassword: vi.fn(),
      generatePassword: vi.fn(),
      listPasswordEntries: vi.fn().mockResolvedValue([{
        id: 'existing',
        type: 'password',
        codename: 'GitHub-é-工作',
        tags: [],
        folder: '',
        description: '',
        createdAt: 1,
        updatedAt: 1,
      }]),
      createPasswordEntry,
      touchLastUsed,
      withWritableDbKey: async <T>(_masterPwd: string, _identitySecret: string, run: () => Promise<T>) => run(),
    } satisfies DirectPasswordRuntime;

    const result = await savePasswordEntry({
      masterPwd: 'master',
      codename: 'github-e\u0301-工作',
      mode: 'alphanumeric',
      length: 16,
      runtime,
    });

    expect(result).toEqual({ entryId: 'existing', created: false });
    expect(createPasswordEntry).not.toHaveBeenCalled();
    expect(touchLastUsed).toHaveBeenCalledWith('existing');
  });
});

describe('runDirectPasswordFlow', () => {
  it('requires an identity secret on an uninitialized device', async () => {
    const result = await runDirectPasswordFlow({
      computeMode: 'independent',
      masterPwd: 'master',
      codename: '微信',
      mode: 'alphanumeric',
      length: 16,
      runtime: createUninitializedRuntime(),
    });

    expect(result).toEqual({ ok: false, reason: 'missing_identity_secret' });
  });

  it('uses the explicitly entered identity secret on an uninitialized device', async () => {
    const runtime = createUninitializedRuntime();
    const result = await runDirectPasswordFlow({
      computeMode: 'independent',
      masterPwd: 'master',
      identitySecret: '只属于我的身份句',
      codename: '微信',
      mode: 'alphanumeric',
      length: 16,
      runtime,
    });

    expect(result).toEqual({
      ok: true,
      password: 'master|只属于我的身份句|微信|alphanumeric|16',
    });
    expect(runtime.generatePassword).toHaveBeenCalledWith(
      'master',
      '只属于我的身份句',
      '微信',
      'alphanumeric',
      16,
    );
  });

  it('does not generate or persist when the master password is invalid', async () => {
    const runtime = createUninitializedRuntime();
    runtime.getMasterData = vi.fn().mockResolvedValue({
      verifyHash: 'hash',
      verifySalt: 'verify-salt',
      userSalt: '身份密语',
      createdAt: 1,
    });
    runtime.verifyMasterPassword = vi.fn().mockResolvedValue(false);

    const result = await runDirectPasswordFlow({
      computeMode: 'formal',
      masterPwd: 'wrong',
      codename: 'GitHub-工作',
      mode: 'alphanumeric',
      length: 16,
      runtime,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_master_password' });
    expect(runtime.generatePassword).not.toHaveBeenCalled();
    expect(runtime.listPasswordEntries).not.toHaveBeenCalled();
    expect(runtime.createPasswordEntry).not.toHaveBeenCalled();
    expect(runtime.touchLastUsed).not.toHaveBeenCalled();
  });

  it('generates a new codename without saving it before the user copies', async () => {
    const runtime = createUninitializedRuntime();
    runtime.getMasterData = vi.fn().mockResolvedValue({
      verifyHash: 'hash',
      verifySalt: 'verify-salt',
      userSalt: '身份密语',
      createdAt: 1,
    });
    runtime.verifyMasterPassword = vi.fn().mockResolvedValue(true);

    const result = await runDirectPasswordFlow({
      computeMode: 'formal',
      masterPwd: 'master',
      codename: '微信',
      mode: 'with_symbols',
      length: 32,
      runtime,
    });

    expect(result).toEqual({
      ok: true,
      password: 'master|身份密语|微信|with_symbols|32',
    });
    expect(runtime.createPasswordEntry).not.toHaveBeenCalled();
    expect(runtime.touchLastUsed).not.toHaveBeenCalled();
  });

  it('uses an existing entry profile instead of the quick form defaults', async () => {
    const runtime = createUninitializedRuntime();
    runtime.getMasterData = vi.fn().mockResolvedValue({
      verifyHash: 'hash',
      verifySalt: 'verify-salt',
      userSalt: '身份密语',
      createdAt: 1,
    });
    runtime.verifyMasterPassword = vi.fn().mockResolvedValue(true);
    runtime.listPasswordEntries = vi.fn().mockResolvedValue([{
      id: 'alipay',
      type: 'password',
      codename: '支付宝',
      charsetMode: 'with_symbols',
      passwordLength: 32,
      tags: [],
      folder: '',
      description: '',
      createdAt: 1,
      updatedAt: 1,
    }]);

    const result = await runDirectPasswordFlow({
      computeMode: 'formal',
      masterPwd: 'master',
      codename: '支付宝',
      mode: 'alphanumeric',
      length: 16,
      runtime,
    });

    expect(runtime.generatePassword).toHaveBeenCalledWith(
      'master',
      '身份密语',
      '支付宝',
      'with_symbols',
      32,
    );
    expect(result).toEqual({
      ok: true,
      password: 'master|身份密语|支付宝|with_symbols|32',
      entryId: 'alipay',
      persisted: 'touched',
    });
  });
});
