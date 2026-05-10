/**
 * 花钥移动端 - 主状态 Store 测试
 * 覆盖普通改密时的恢复码保护，以及恢复码重置后的合法改密路径。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const sqliteDbMock = vi.hoisted(() => ({
  getMasterData: vi.fn(),
  setDbKey: vi.fn(),
  clearDbKey: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  setMasterData: vi.fn(),
  setDeviceId: vi.fn(),
  getEntriesByType: vi.fn(),
  createEntry: vi.fn(),
  updateLastUsed: vi.fn(),
  reEncryptAllEntries: vi.fn(),
  getAllEntries: vi.fn(),
  getEntry: vi.fn(),
  importEntry: vi.fn(),
  getBookmarkByUrl: vi.fn(),
}));

const coreMock = vi.hoisted(() => ({
  generateSalt: vi.fn(() => 'verify-salt'),
  generateDeviceId: vi.fn(() => 'device-1'),
  createVerifyHash: vi.fn(),
  verifyMasterPassword: vi.fn(),
  generatePassword: vi.fn(),
  deriveDatabaseKey: vi.fn(),
  generateRecoveryCode: vi.fn(),
  encryptMasterPwdWithRecovery: vi.fn(),
  decryptMasterPwdWithRecovery: vi.fn(),
  runDirectPasswordFlow: vi.fn(),
}));

const capacitorMock = vi.hoisted(() => ({
  Capacitor: { getPlatform: vi.fn(() => 'web') },
  registerPlugin: vi.fn(() => ({ setUnlocked: vi.fn(), setLocked: vi.fn() })),
}));

vi.mock('@flowerkey/core', () => coreMock);
vi.mock('../db-sqlite', () => sqliteDbMock);
vi.mock('@capacitor/core', () => capacitorMock);

describe('mobile useMainStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    sqliteDbMock.getMasterData.mockResolvedValue({
      verifyHash: 'hash',
      verifySalt: 'salt',
      userSalt: 'FlowerKey',
      createdAt: 1,
    });
    sqliteDbMock.getConfig.mockResolvedValue('device-1');
    coreMock.verifyMasterPassword.mockResolvedValue(true);
    coreMock.createVerifyHash.mockResolvedValue('next-verify-hash');
    coreMock.deriveDatabaseKey.mockImplementation(async (pwd: string, salt: string) => `dbkey:${pwd}:${salt}`);
  });

  it('rejects a normal password change when a recovery payload exists', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    sqliteDbMock.getMasterData.mockResolvedValue({
      verifyHash: 'hash',
      verifySalt: 'salt',
      userSalt: 'FlowerKey',
      createdAt: 1,
      encryptedMasterPwd: 'encrypted-old-master',
      recoverySalt: 'recovery-salt',
    });

    await store.unlock('correct-password');

    await expect(store.changeMasterPwd('correct-password', 'new-password')).rejects.toThrow('存在恢复码，请先记录并在改密后重新生成');
  });

  it('allows changing the master password after recovery unlock reset flow', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    sqliteDbMock.getMasterData
      .mockResolvedValueOnce({
        verifyHash: 'hash',
        verifySalt: 'salt',
        userSalt: 'FlowerKey',
        createdAt: 1,
        encryptedMasterPwd: 'encrypted-old-master',
        recoverySalt: 'recovery-salt',
      })
      .mockResolvedValueOnce({
        verifyHash: 'hash',
        verifySalt: 'salt',
        userSalt: 'FlowerKey',
        createdAt: 1,
        encryptedMasterPwd: 'encrypted-old-master',
        recoverySalt: 'recovery-salt',
      });
    coreMock.decryptMasterPwdWithRecovery.mockResolvedValue('correct-password');

    const recovered = await store.recoverWithCode('recovery-code');
    expect(recovered).toBe(true);

    sqliteDbMock.setMasterData.mockClear();
    await store.changeMasterPwd('', 'new-password');

    expect(sqliteDbMock.reEncryptAllEntries).toHaveBeenCalledWith(
      'dbkey:correct-password:FlowerKey',
      'dbkey:new-password:FlowerKey',
    );
    expect(sqliteDbMock.setMasterData).toHaveBeenCalledWith(expect.objectContaining({
      verifyHash: 'next-verify-hash',
      verifySalt: 'verify-salt',
      encryptedMasterPwd: undefined,
      recoverySalt: undefined,
    }));
  });

  it('skips importing a bookmark when another bookmark with the same url already exists', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    sqliteDbMock.getEntry.mockResolvedValue(undefined);
    sqliteDbMock.getBookmarkByUrl.mockResolvedValue({
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
    expect(sqliteDbMock.importEntry).not.toHaveBeenCalled();
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
    expect(sqliteDbMock.importEntry).not.toHaveBeenCalled();
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
    expect(sqliteDbMock.importEntry).not.toHaveBeenCalled();
  });
});
