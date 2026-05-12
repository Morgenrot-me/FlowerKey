/**
 * 花钥桌面端 - 主状态 Store 测试
 * 覆盖恢复码存在时的改密保护与正常改密路径。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const dbMock = vi.hoisted(() => ({
  getMasterData: vi.fn(),
  setDbKey: vi.fn(),
  clearDbKey: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  setMasterData: vi.fn(),
  setDeviceId: vi.fn(),
  getEntriesByType: vi.fn(),
  createEntry: vi.fn(),
  touchLastUsed: vi.fn(),
  reEncryptAllEntries: vi.fn(),
  getEntry: vi.fn(),
  importEntry: vi.fn(),
  getBookmarkByUrl: vi.fn(),
}));

const coreMock = vi.hoisted(() => ({
  db: dbMock,
  generateSalt: vi.fn(() => 'verify-salt'),
  generateDeviceId: vi.fn(() => 'device-1'),
  createVerifyHash: vi.fn(),
  verifyMasterPassword: vi.fn(),
  generatePassword: vi.fn(),
  deriveDatabaseKey: vi.fn(),
  generateRecoveryCode: vi.fn(),
  encryptMasterPwdWithRecovery: vi.fn(),
  decryptMasterPwdWithRecovery: vi.fn(),
  decryptEntry: vi.fn(),
  runDirectPasswordFlow: vi.fn(),
}));

vi.mock('@flowerkey/core', () => coreMock);

describe('desktop useMainStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    dbMock.getMasterData.mockResolvedValue({
      verifyHash: 'hash',
      verifySalt: 'salt',
      userSalt: 'FlowerKey',
      createdAt: 1,
    });
    dbMock.getConfig.mockResolvedValue('device-1');
    coreMock.verifyMasterPassword.mockResolvedValue(true);
    coreMock.createVerifyHash.mockResolvedValue('next-verify-hash');
    coreMock.deriveDatabaseKey.mockImplementation(async (pwd: string, salt: string) => `dbkey:${pwd}:${salt}`);
  });

  it('rejects changing the master password when a recovery payload exists', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    dbMock.getMasterData.mockResolvedValue({
      verifyHash: 'hash',
      verifySalt: 'salt',
      userSalt: 'FlowerKey',
      createdAt: 1,
      encryptedMasterPwd: 'encrypted-old-master',
      recoverySalt: 'recovery-salt',
    });

    await store.unlock('correct-password');

    await expect(store.changeMasterPwd('new-password')).rejects.toThrow('存在恢复码，请先记录并在改密后重新生成');
  });

  it('changes the master password when no recovery payload exists', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await store.unlock('correct-password');
    dbMock.setMasterData.mockClear();

    await store.changeMasterPwd('new-password');

    expect(dbMock.reEncryptAllEntries).toHaveBeenCalledWith(
      'dbkey:correct-password:FlowerKey',
      'dbkey:new-password:FlowerKey',
    );
    expect(dbMock.setMasterData).toHaveBeenCalledWith(expect.objectContaining({
      verifyHash: 'next-verify-hash',
      verifySalt: 'verify-salt',
      encryptedMasterPwd: undefined,
      recoverySalt: undefined,
    }));
  });

  it('reports a stable error when import JSON is invalid', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await expect(store.importData('{invalid')).rejects.toThrow('导入文件格式错误');
  });

  it('reports a stable error when import JSON has no entries array', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await expect(store.importData('{"version":1}')).rejects.toThrow('导入文件缺少 entries 字段');
  });

  it('skips importing a bookmark when another bookmark with the same url already exists', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    dbMock.getEntry.mockResolvedValue(undefined);
    dbMock.getBookmarkByUrl.mockResolvedValue({
      id: 'existing-bookmark',
      type: 'bookmark',
      url: 'https://example.com',
      title: 'Existing',
      tags: [],
      folder: '',
      description: '',
      createdAt: 1,
      updatedAt: 1,
    });

    const imported = await store.importData(JSON.stringify({
      entries: [{
        id: 'new-bookmark',
        type: 'bookmark',
        url: 'https://example.com',
        title: 'Imported duplicate',
        tags: [],
        folder: '',
        description: '',
        createdAt: 2,
        updatedAt: 2,
      }],
    }));

    expect(imported).toBe(0);
    expect(dbMock.importEntry).not.toHaveBeenCalled();
  });

  it('rejects importing an entry with an unsupported type', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await expect(store.importData(JSON.stringify({
      entries: [{
        id: 'bad-entry',
        type: 'unknown',
        tags: [],
        folder: '',
        description: '',
        createdAt: 1,
        updatedAt: 1,
      }],
    }))).rejects.toThrow('导入文件包含不支持的条目类型');
    expect(dbMock.importEntry).not.toHaveBeenCalled();
  });

  it('rejects importing an entry with a non-numeric updatedAt', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await expect(store.importData(JSON.stringify({
      entries: [{
        id: 'bad-entry',
        type: 'note',
        tags: [],
        folder: '',
        description: '',
        content: 'hello',
        createdAt: 1,
        updatedAt: 'oops',
      }],
    }))).rejects.toThrow('导入文件包含无效条目时间');
    expect(dbMock.importEntry).not.toHaveBeenCalled();
  });

  it('allows changing master password after recovery code unlock', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    dbMock.getMasterData
      .mockResolvedValueOnce({
        verifyHash: 'hash', verifySalt: 'salt', userSalt: 'FlowerKey', createdAt: 1,
        encryptedMasterPwd: 'encrypted-old-master', recoverySalt: 'recovery-salt',
      })
      .mockResolvedValueOnce({
        verifyHash: 'hash', verifySalt: 'salt', userSalt: 'FlowerKey', createdAt: 1,
        encryptedMasterPwd: 'encrypted-old-master', recoverySalt: 'recovery-salt',
      });
    coreMock.decryptMasterPwdWithRecovery.mockResolvedValue('correct-password');

    const recovered = await store.recoverWithCode('recovery-code');
    expect(recovered).toBe(true);
    expect(store.needsPasswordReset).toBe(true);

    dbMock.setMasterData.mockClear();
    await store.changeMasterPwd('new-password');

    expect(dbMock.reEncryptAllEntries).toHaveBeenCalled();
    expect(dbMock.setMasterData).toHaveBeenCalledWith(expect.objectContaining({
      encryptedMasterPwd: undefined, recoverySalt: undefined,
    }));
    expect(store.needsPasswordReset).toBe(false);
  });

  it('clears needsPasswordReset on lock', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();
    store.needsPasswordReset = true;
    store.lock();
    expect(store.needsPasswordReset).toBe(false);
  });
});
