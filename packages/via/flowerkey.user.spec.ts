/**
 * Via 最终 userscript 的 FK-DP1 兼容测试。
 * 直接提取并执行发布文件中的内联实现，避免只测试核心库而遗漏手工复制版本。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type ViaGenerator = (
  masterPwd: string,
  identitySecret: string,
  codename: string,
  mode?: 'alphanumeric' | 'with_symbols',
  length?: number,
) => Promise<string>;

function loadPublishedGenerator(): ViaGenerator {
  const source = readFileSync(resolve(process.cwd(), 'packages/via/flowerkey.user.js'), 'utf8');
  const coreStart = source.indexOf('  const ITERATIONS = 600000;');
  const uiStart = source.indexOf('  // ==================== UI ====================');

  if (coreStart < 0 || uiStart < 0 || uiStart <= coreStart) {
    throw new Error('无法从 Via userscript 定位 FK-DP1 内联实现');
  }

  const coreSource = source.slice(coreStart, uiStart);
  return new Function(`${coreSource}\nreturn generatePassword;`)() as ViaGenerator;
}

describe('Via userscript FK-DP1', () => {
  it.each([
    ['微信', 'alphanumeric', 8, 'nWH46L86'],
    ['微信', 'alphanumeric', 16, 'nWH4ML8643UhgxED'],
    ['微信', 'alphanumeric', 32, 'nWH4M68643UhgxEDONcxrIfACZQYC2Ac'],
    ['支付宝', 'with_symbols', 8, 'Z*M&1{|>'],
    ['支付宝', 'with_symbols', 16, 'Z1M&7{|WtJ8{-PX>'],
    ['支付宝', 'with_symbols', 32, 'Z*M&7{|WtJ8{-PX1HF8m4_#>.4&h-3f>'],
    ['GitHub-工作', 'alphanumeric', 16, 'UXOWCqi8siOSpjR7'],
  ] as const)('matches the frozen vector for %s / %s / %i', async (codename, mode, length, expected) => {
    const generatePassword = loadPublishedGenerator();
    await expect(generatePassword(
      'correct horse battery staple',
      '只属于我的身份句',
      codename,
      mode,
      length,
    )).resolves.toBe(expected);
  });

  it('keeps ASCII codename letters case-insensitive', async () => {
    const generatePassword = loadPublishedGenerator();
    const upper = await generatePassword(
      'correct horse battery staple',
      '只属于我的身份句',
      'GitHub-工作',
    );
    const lower = await generatePassword(
      'correct horse battery staple',
      '只属于我的身份句',
      'github-工作',
    );

    expect(upper).toBe(lower);
  });
});
