/**
 * 花钥扩展 - 前台到 background 的锁定态同步
 * 保证 popup 和 sidepanel 的解锁/锁定都能同步到 service worker。
 */
export interface LockStateSnapshot {
  isUnlocked: boolean;
  masterPwd: string;
  userSalt: string;
}

export async function syncBackgroundLockState(
  sendMessage: (message: unknown) => Promise<unknown>,
  state: LockStateSnapshot,
): Promise<void> {
  if (!state.isUnlocked) {
    await sendMessage({ type: 'setLocked' });
    return;
  }

  if (!state.masterPwd) return;

  await sendMessage({
    type: 'setUnlocked',
    masterPwd: state.masterPwd,
    userSalt: state.userSalt,
  });
}
