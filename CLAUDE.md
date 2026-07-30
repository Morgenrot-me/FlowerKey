# 花钥 FlowerKey - 项目说明

## 项目概述

确定性密码生成、加密密码存储与加密秘密库的多端工具。
核心理念：无后端、本地优先、端到端加密、WebDAV 自托管同步。

## Monorepo 结构

```
packages/
├── core/       核心库（加密/数据层/同步引擎），所有端复用
├── ui/         插件共享 UI 组件（仅 extension 使用）
├── extension/  Chrome/Edge 浏览器插件（Manifest V3）
├── mobile/     Android/iOS 移动端（Capacitor 7）
└── desktop/    Windows 桌面端（Tauri 2）
scripts/
└── sync-version.js   版本号同步脚本
```

## 技术栈

| 用途 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| 本地存储 | SQLite（移动端：@capacitor-community/sqlite；插件端：Dexie.js IndexedDB） |
| 加密 | Web Crypto API（零外部依赖） |
| 云同步 | WebDAV（webdav npm 包） |
| 移动端 | Capacitor 7 |
| 桌面端 | Tauri 2 |
| 样式 | Tailwind CSS 3 |
| 构建 | Vite 6 |
| 包管理 | pnpm workspace |

## 核心加密设计

三路 PBKDF2 密钥完全隔离（600,000 次迭代，SHA-256）：

```
verifyHash = PBKDF2(masterPwd, "flowerkey_verify_" + verifySalt)
             verifySalt 随机生成，仅本地存储，防彩虹表攻击

masterKey  = PBKDF2(masterPwd, NFC(identitySecret))
             identitySecret 为用户首次设置并确认的身份密语

dbKey      = PBKDF2(masterPwd, "flowerkey_dbenc_" + identitySecret)
             用于 IndexedDB 条目敏感字段 AES-256-GCM 加密

identityWrapKey = PBKDF2(masterPwd, "flowerkey_identity_wrap_" + wrapSalt)
                  用于 AES-256-GCM 加密本地身份密语
```

`masterPasswordData` 只保存身份包装密文、随机包装盐和版本，不得保存身份密语明文。主密码与身份密语均为不可变生成根；恢复码只能恢复原主密码，不提供普通改密或恢复后重置主密码。

密码生成遵循根目录《密码生成协议.md》的冻结协议 FK-DP1：

- 区分代号执行 NFC，并将 ASCII `A-Z` 统一为小写
- 字符模式仅允许“字母+数字”与“含特殊字符”
- 长度仅允许 8、16（默认）、32
- 字母和数字确定性必含；特殊字符模式额外保证特殊字符必含
- 稳定版发布后不得修改既有输入输出结果

## IndexedDB / SQLite 加密字段

以下字段 AES-256-GCM 加密后以 base64 存储：
`codename`, `title`, `description`, `fileName`, `sourceUrl`, `storedPassword`, `content`

未加密字段（索引 / 匹配需要）：
`id`, `type`, `folder`, `tags`, `url`, `appPackage`, `favicon`, `createdAt`, `updatedAt`

> 注意：`url` 和 `appPackage` 明文存储，供 Android AutofillService SQL 直接匹配。

秘密库使用 `FK-SECRET-1`：标题、内容、账号、标签、文件夹和备注全部序列化进 `content` 后整体加密；顶层敏感字段必须为空。备份使用当前数据库密钥整体加密为 `FK-BACKUP-1`。

## Android AutofillService 三级回退

```
Level 1：内联建议（Android 11+，已解锁，有匹配条目）
         → 键盘上方芯片，点击直接填充，零界面
Level 2：Dialog Activity（已解锁，无匹配 / Android 10-）
         → 悬浮小窗，展示匹配条目或手动输入代号
Level 3：Dialog Activity（未解锁）
         → 输入主密码验证后展示匹配条目
```

匹配逻辑：
- WebView/Chrome：`url LIKE '%webDomain%'`（url 明文）
- 原生 App：`appPackage = ?`（精确匹配）

密码生成：`FlowerKeyApp` 内存中的 `masterKey` + `HMAC-SHA256(masterKey, codename)`

AutofillAuthActivity 安全措施：

- `FLAG_SECURE`：禁止截屏/录屏/任务切换器预览
- 手动输入代号填充后自动写入 changelog（synced=0），下次同步时推送到 WebDAV

## 常用命令

```bash
pnpm build:core          # 构建核心库
pnpm build:extension     # 构建浏览器插件
pnpm build               # 构建所有包
pnpm version:sync        # 同步版本号（改根 package.json 后运行）
```

## Android APK 构建

```bash
# 1. 构建前端
pnpm --filter @flowerkey/mobile build

# 2. 同步到 Android 原生项目
cd packages/mobile && npx cap sync android

# 3. 构建 APK（必须用 PowerShell，bash 下 gradlew 无法运行）
powershell -Command "Set-Location 'packages/mobile/android'; .\gradlew.bat --no-daemon --max-workers=1 \"-Dorg.gradle.jvmargs=-Xms64m -Xmx1024m -XX:CICompilerCount=2 -XX:ReservedCodeCacheSize=64m -XX:+HeapDumpOnOutOfMemoryError\" \"-Dorg.gradle.parallel=false\" :app:assembleRelease"
# APK 输出：packages/mobile/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

Release 构建说明：
- 启用 R8 混淆（`minifyEnabled true`）
- ABI split：仅打包 arm64-v8a + armeabi-v7a，包体约 7MB
- 本地常规构建使用 debug keystore 签名，只能用于功能验证
- GitHub Release 使用仓库 Secrets 中的固定发布密钥，通过 Gradle 命令行属性签名并核对证书指纹

## 产物收集

构建完成后运行以下脚本，将各端产物复制到根目录 `release/` 文件夹：

```powershell
powershell -File scripts/collect-release.ps1
```

收集内容：
- `花钥-android-arm64.apk`：Android arm64 release APK
- `花钥-desktop-setup.exe`：Windows 桌面端安装包（取 bundle/nsis/ 最新版本）

`release/` 已加入 `.gitignore`，不纳入版本控制。

## GitHub Actions 自动发布

- `.github/workflows/ci.yml`：`main` 和 Pull Request 的测试、类型检查与全部 Web 构建。
- `.github/workflows/release.yml`：`v*.*.*` 标签或手动指定已有标签时，构建浏览器扩展、Android 双 ABI APK、Windows NSIS，并上传 SHA-256 清单。
- Android 正式发布依赖 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEY_ALIAS`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_PASSWORD` 四个仓库 Secrets；缺少任一项或证书不匹配时禁止发布。

## 版本管理

统一在根 `package.json` 的 `version` 字段维护，运行 `pnpm version:sync` 同步到所有子包、Cargo.toml、Cargo.lock、Tauri、扩展 manifest 和 Android。

## 数据模型

```typescript
Entry {
  id, type, createdAt, updatedAt, lastUsedAt                 // 通用元数据
  codename?, charsetMode?, passwordLength?, storedPassword?   // 密码条目（加密）
  url?, appPackage?                                           // 密码自动填充匹配元数据（明文）
  content?                                                    // secret 的 FK-SECRET-1 整体加密载荷
}
```

## WebDAV 同步

增量同步，基于 ChangeLog（LWW 冲突解决）。
远端目录结构：`/FlowerKey/oplog/{deviceId}_{timestamp}.enc`

兼容坚果云（API 频率限制：每30分钟600次）。
