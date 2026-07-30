/**
 * 版本同步纯函数回归测试
 * 保证 Cargo.lock 只更新 FlowerKey 桌面应用自身版本，不误改第三方依赖。
 */
import { describe, expect, it } from 'vitest';
import { syncCargoLockPackageVersion } from './sync-version-utils.js';

describe('syncCargoLockPackageVersion', () => {
  it('只更新指定 Cargo 包的版本', () => {
    const lock = `[[package]]
name = "flowerkey-desktop"
version = "0.5.1"

[[package]]
name = "serde"
version = "1.0.228"
`;

    expect(syncCargoLockPackageVersion(lock, 'flowerkey-desktop', '1.0.2')).toBe(`[[package]]
name = "flowerkey-desktop"
version = "1.0.2"

[[package]]
name = "serde"
version = "1.0.228"
`);
  });

  it('找不到指定 Cargo 包时明确失败', () => {
    expect(() => syncCargoLockPackageVersion(
      '[[package]]\nname = "serde"\nversion = "1.0.228"\n',
      'flowerkey-desktop',
      '1.0.2',
    )).toThrow('Cargo.lock 中未找到包 flowerkey-desktop');
  });
});
