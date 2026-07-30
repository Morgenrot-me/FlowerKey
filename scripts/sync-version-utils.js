/**
 * 版本同步脚本使用的纯文本工具。
 * 这里不访问文件系统，便于单元测试精确验证 Cargo.lock 修改边界。
 */

/**
 * 只更新 Cargo.lock 中指定本地包的版本号。
 *
 * @param {string} content Cargo.lock 完整文本。
 * @param {string} packageName 需要更新的 Cargo 包名。
 * @param {string} version 新版本号。
 * @returns {string} 更新后的 Cargo.lock 文本。
 */
export function syncCargoLockPackageVersion(content, packageName, version) {
  let found = false;
  const blocks = content.split(/(?=^\[\[package\]\]\r?$)/m);
  const updated = blocks.map((block) => {
    const nameMatch = block.match(/^name = "([^"]+)"\r?$/m);
    if (nameMatch?.[1] !== packageName) return block;

    if (!/^version = "[^"]*"\r?$/m.test(block)) {
      throw new Error(`Cargo.lock 中的包 ${packageName} 缺少版本号`);
    }

    found = true;
    return block.replace(/^version = "[^"]*"/m, `version = "${version}"`);
  });

  if (!found) {
    throw new Error(`Cargo.lock 中未找到包 ${packageName}`);
  }
  return updated.join('');
}
