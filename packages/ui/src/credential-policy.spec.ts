/**
 * 不可变凭据源码门禁。
 * 主密码和身份密语决定全部 FK-DP1 输出，任何端都不得重新暴露普通改密或恢复后强制重置。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('不可变凭据 UI 策略', () => {
  it.each([
    'packages/ui/src/components/SettingsPage.vue',
    'packages/desktop/src/pages/SettingsTab.vue',
    'packages/mobile/src/pages/SettingsTab.vue',
  ])('%s does not expose master password changes', (path) => {
    const source = readWorkspaceFile(path);
    expect(source).not.toContain('changeMasterPwd');
    expect(source).not.toContain('修改主密码');
  });

  it('does not route recovery unlocks into a forced password reset page', () => {
    const source = readWorkspaceFile('packages/mobile/src/App.vue');
    expect(source).not.toContain('needsPasswordReset');
    expect(source).not.toContain('ForceResetPage');
  });

  it('removes the legacy plaintext identity key from extension session storage', () => {
    const source = readWorkspaceFile('packages/extension/background/service-worker.ts');
    expect(source).toContain("chrome.storage.session.remove('userSalt')");
  });
});
