/**
 * 花钥 FlowerKey - 主状态 Store 测试
 * 覆盖解锁、锁定与临时写库时数据库密钥恢复行为。
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
  savePasswordEntry: vi.fn(),
}));

vi.mock('@flowerkey/core', () => coreMock);

describe('useMainStore', () => {
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
    coreMock.deriveDatabaseKey.mockImplementation(async (pwd: string, salt: string) => `dbkey:${pwd}:${salt}`);
    coreMock.savePasswordEntry.mockImplementation(async (input: {
      masterPwd: string;
      codename: string;
      mode: string;
      length: number;
      runtime: { withWritableDbKey: (pwd: string, salt: string, run: () => Promise<{ ok: boolean }>) => Promise<{ ok: boolean }> };
    }) => input.runtime.withWritableDbKey(input.masterPwd, 'FlowerKey', async () => ({ ok: true })));
  });

  it('restores the unlocked database key after saving a temporary password with another password', async () => {
    const { useMainStore } = await import('./main.js');
    const store = useMainStore();

    await store.unlock('correct-password');
    dbMock.setDbKey.mockClear();
    dbMock.clearDbKey.mockClear();

    await store.savePassword('another-password', 'github-main');

    expect(coreMock.savePasswordEntry).toHaveBeenCalledOnce();
    expect(dbMock.setDbKey).toHaveBeenNthCalledWith(1, 'dbkey:another-password:FlowerKey');
    expect(dbMock.setDbKey).toHaveBeenNthCalledWith(2, 'dbkey:correct-password:FlowerKey');
    expect(dbMock.clearDbKey).not.toHaveBeenCalled();
  });
});
