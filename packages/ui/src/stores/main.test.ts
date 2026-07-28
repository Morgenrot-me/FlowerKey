/**
 * 花钥 FlowerKey - 主状态 Store 测试
 * 覆盖解锁、锁定与临时写库时数据库密钥恢复行为。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const dbMock = vi.hoisted(() => ({
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
  touchLastUsed: vi.fn(),
  reEncryptAllEntries: vi.fn(),
  getEntry: vi.fn(),
  importEntry: vi.fn(),
  getBookmarkByUrl: vi.fn(),
}));

const coreMock = vi.hoisted(() => ({
  db: dbMock,
  generateDeviceId: vi.fn(() => 'device-1'),
  createMasterPasswordData: vi.fn(),
  openMasterPasswordData: vi.fn(),
  generatePassword: vi.fn(),
  deriveDatabaseKey: vi.fn(),
  generateRecoveryCode: vi.fn(),
  encryptMasterPwdWithRecovery: vi.fn(),
  decryptMasterPwdWithRecovery: vi.fn(),
  decryptEntry: vi.fn(),
  runDirectPasswordFlow: vi.fn(),
  savePasswordEntry: vi.fn(),
}));

vi.mock('@flowerkey/core', () => coreMock);

describe('useMainStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    dbMock.getMasterData.mockResolvedValue({
      formatVersion: 1,
      verifyHash: 'hash',
      verifySalt: 'salt',
      identityEnvelope: { version: 1, kdfSalt: 'wrap-salt', ciphertext: 'wrapped' },
      createdAt: 1,
    });
    dbMock.getMasterDataStatus.mockResolvedValue('current');
    dbMock.getConfig.mockResolvedValue('device-1');
    coreMock.createMasterPasswordData.mockResolvedValue({
      formatVersion: 1,
      verifyHash: 'hash',
      verifySalt: 'salt',
      identityEnvelope: { version: 1, kdfSalt: 'wrap-salt', ciphertext: 'wrapped' },
      createdAt: 1,
    });
    coreMock.openMasterPasswordData.mockResolvedValue('身份密语');
    coreMock.deriveDatabaseKey.mockImplementation(async (pwd: string, salt: string) => `dbkey:${pwd}:${salt}`);
    coreMock.savePasswordEntry.mockImplementation(async (input: {
      masterPwd: string;
      codename: string;
      mode: string;
      length: number;
      runtime: { withWritableDbKey: (pwd: string, salt: string, run: () => Promise<{ ok: boolean }>) => Promise<{ ok: boolean }> };
    }) => input.runtime.withWritableDbKey(input.masterPwd, '身份密语', async () => ({ ok: true })));
  });

  it('restores the unlocked database key after saving a temporary password with another password', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await store.unlock('correct-password');
    dbMock.setDbKey.mockClear();
    dbMock.clearDbKey.mockClear();

    await store.savePassword('another-password', 'github-main');

    expect(coreMock.savePasswordEntry).toHaveBeenCalledOnce();
    expect(dbMock.setDbKey).toHaveBeenNthCalledWith(1, 'dbkey:another-password:身份密语');
    expect(dbMock.setDbKey).toHaveBeenNthCalledWith(2, 'dbkey:correct-password:身份密语');
    expect(dbMock.clearDbKey).not.toHaveBeenCalled();
  });

  it('stores only the wrapped identity master data returned by core setup', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await store.setup('correct-password', '身份密语');

    expect(coreMock.createMasterPasswordData)
      .toHaveBeenCalledWith('correct-password', '身份密语');
    expect(dbMock.createMasterData).toHaveBeenCalledWith(expect.objectContaining({
      formatVersion: 1,
      identityEnvelope: expect.objectContaining({ ciphertext: 'wrapped' }),
    }));
    expect(JSON.stringify(dbMock.createMasterData.mock.calls[0][0]))
      .not.toContain('身份密语');
  });

  it('blocks setup when unsupported pre-release identity data exists', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();
    dbMock.getMasterDataStatus.mockResolvedValue('unsupported');

    await store.checkSetup();

    expect(store.hasUnsupportedMasterData).toBe(true);
    await expect(store.setup('new-password', '新身份密语'))
      .rejects.toThrow('请先清除本地开发数据');
    expect(dbMock.createMasterData).not.toHaveBeenCalled();
  });

  it('opens the wrapped identity before deriving the database key', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await store.unlock('correct-password');

    expect(coreMock.openMasterPasswordData).toHaveBeenCalledWith(
      'correct-password',
      expect.objectContaining({ formatVersion: 1 }),
    );
    expect(dbMock.setDbKey).toHaveBeenCalledWith('dbkey:correct-password:身份密语');
    expect(store.userSalt).toBe('身份密语');
  });

  it('recovers the original master password and exposes no password change action', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    dbMock.getMasterData.mockResolvedValue({
      formatVersion: 1,
      verifyHash: 'hash',
      verifySalt: 'salt',
      identityEnvelope: { version: 1, kdfSalt: 'wrap-salt', ciphertext: 'wrapped' },
      createdAt: 1,
      encryptedMasterPwd: 'encrypted-original-master',
      recoverySalt: 'recovery-salt',
    });
    coreMock.decryptMasterPwdWithRecovery.mockResolvedValue('correct-password');

    await expect(store.recoverWithCode('recovery-code')).resolves.toBe(true);

    expect(store.masterPwd).toBe('correct-password');
    expect(store.isUnlocked).toBe(true);
    expect('changeMasterPwd' in store).toBe(false);
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
});
