/**
 * 花钥移动端 - 主状态 Store 测试
 * 覆盖身份密语包装解锁、恢复原主密码、不可变凭据 API 与锁定清理。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const sqliteDbMock = vi.hoisted(() => ({
  getMasterData: vi.fn(),
  getMasterDataStatus: vi.fn(),
  createMasterData: vi.fn(),
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
}));

const coreMock = vi.hoisted(() => ({
  generateDeviceId: vi.fn(() => 'device-1'),
  createMasterPasswordData: vi.fn(),
  openMasterPasswordData: vi.fn(),
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
      formatVersion: 1,
      verifyHash: 'hash',
      verifySalt: 'salt',
      identityEnvelope: { version: 1, kdfSalt: 'wrap-salt', ciphertext: 'wrapped' },
      createdAt: 1,
    });
    sqliteDbMock.getMasterDataStatus.mockResolvedValue('current');
    sqliteDbMock.getConfig.mockResolvedValue('device-1');
    coreMock.createMasterPasswordData.mockResolvedValue({
      formatVersion: 1,
      verifyHash: 'hash',
      verifySalt: 'salt',
      identityEnvelope: { version: 1, kdfSalt: 'wrap-salt', ciphertext: 'wrapped' },
      createdAt: 1,
    });
    coreMock.openMasterPasswordData.mockResolvedValue('身份密语');
    coreMock.deriveDatabaseKey.mockImplementation(async (pwd: string, salt: string) => `dbkey:${pwd}:${salt}`);
  });

  it('stores wrapped identity data without plaintext fields', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await store.setup('correct-password', '身份密语');

    expect(coreMock.createMasterPasswordData)
      .toHaveBeenCalledWith('correct-password', '身份密语');
    expect(JSON.stringify(sqliteDbMock.createMasterData.mock.calls[0][0]))
      .not.toContain('身份密语');
  });

  it('recovers the original master password without exposing a reset flow', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    sqliteDbMock.getMasterData
      .mockResolvedValueOnce({
        formatVersion: 1,
        verifyHash: 'hash',
        verifySalt: 'salt',
        identityEnvelope: { version: 1, kdfSalt: 'wrap-salt', ciphertext: 'wrapped' },
        createdAt: 1,
        encryptedMasterPwd: 'encrypted-old-master',
        recoverySalt: 'recovery-salt',
      })
      .mockResolvedValueOnce({
        formatVersion: 1,
        verifyHash: 'hash',
        verifySalt: 'salt',
        identityEnvelope: { version: 1, kdfSalt: 'wrap-salt', ciphertext: 'wrapped' },
        createdAt: 1,
        encryptedMasterPwd: 'encrypted-old-master',
        recoverySalt: 'recovery-salt',
      });
    coreMock.decryptMasterPwdWithRecovery.mockResolvedValue('correct-password');

    const recovered = await store.recoverWithCode('recovery-code');
    expect(recovered).toBe(true);

    expect(store.masterPwd).toBe('correct-password');
    expect(store.userSalt).toBe('身份密语');
    expect('needsPasswordReset' in store).toBe(false);
    expect('changeMasterPwd' in store).toBe(false);
  });

  it('opens the wrapped identity before deriving the database key', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await store.unlock('correct-password');

    expect(coreMock.openMasterPasswordData).toHaveBeenCalled();
    expect(sqliteDbMock.setDbKey).toHaveBeenCalledWith('dbkey:correct-password:身份密语');
  });

  it('skips legacy bookmarks during backup import', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

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
