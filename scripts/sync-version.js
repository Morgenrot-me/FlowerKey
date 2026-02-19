// 从根 package.json 读取版本号，同步到所有子包
import { readFileSync, writeFileSync } from 'fs';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const version = root.version;
const pkgs = ['packages/core', 'packages/ui', 'packages/extension', 'packages/mobile'];

for (const pkg of pkgs) {
  const path = `${pkg}/package.json`;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`${pkg}: ${version}`);
}
