/**
 * 花钥扩展 - 解锁状态同步测试
 * 覆盖解锁时上报 background 与锁定时清理 background 的行为。
 */
import { describe, expect, it, vi } from 'vitest';
import { syncBackgroundLockState } from './state-sync';

describe('syncBackgroundLockState', () => {
  it('sends unlocked state with master password when unlocked', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });

    await syncBackgroundLockState(sendMessage, {
      isUnlocked: true,
      masterPwd: 'master-123',
      userSalt: 'FlowerKey',
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'setUnlocked',
      masterPwd: 'master-123',
      userSalt: 'FlowerKey',
    });
  });

  it('sends locked state when store becomes locked', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await syncBackgroundLockState(sendMessage, {
      isUnlocked: false,
      masterPwd: '',
      userSalt: 'FlowerKey',
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ type: 'setLocked' });
  });
});
