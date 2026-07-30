// 从根 package.json 读取版本号，同步到所有子包和原生构建元数据。
import { readFileSync, writeFileSync } from 'fs';
import { syncCargoLockPackageVersion } from './sync-version-utils.js';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const version = root.version;
const pkgs = ['packages/core', 'packages/ui', 'packages/extension', 'packages/mobile', 'packages/desktop'];

for (const pkg of pkgs) {
  const path = `${pkg}/package.json`;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`${pkg}: ${version}`);
}

// 同步 Cargo.toml
const cargoPath = 'packages/desktop/src-tauri/Cargo.toml';
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version = "[^"]*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);
console.log(`Cargo.toml: ${version}`);

// 同步 Cargo.lock 中桌面应用自身版本，避免锁文件保留旧发布号。
const cargoLockPath = 'packages/desktop/src-tauri/Cargo.lock';
const cargoLock = syncCargoLockPackageVersion(
  readFileSync(cargoLockPath, 'utf8'),
  'flowerkey-desktop',
  version,
);
writeFileSync(cargoLockPath, cargoLock);
console.log(`Cargo.lock: ${version}`);

// 同步 tauri.conf.json
const tauriConfPath = 'packages/desktop/src-tauri/tauri.conf.json';
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`tauri.conf.json: ${version}`);

// 同步 manifest.json
for (const manifestPath of ['packages/extension/manifest.json', 'packages/extension/public/manifest.json']) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${manifestPath}: ${version}`);
}

// 同步 Android build.gradle versionName
// versionCode 用版本号各段相加（如 0.3.0 → 3）保持递增
const buildGradlePath = 'packages/mobile/android/app/build.gradle';
let gradle = readFileSync(buildGradlePath, 'utf8');
const parts = version.split('.').map(Number);
const versionCode = parts[0] * 10000 + parts[1] * 100 + parts[2];
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]*"/, `versionName "${version}"`);
writeFileSync(buildGradlePath, gradle);
console.log(`android build.gradle: ${version} (code: ${versionCode})`);
