# 花钥 FlowerKey

![花钥 Logo](透明蓝钥匙白天.png)

**本地优先的密码、书签与加密笔记管理工具。**

![version](https://img.shields.io/badge/version-0.4.2-blue?style=flat-square)
![license](https://img.shields.io/badge/license-GPL--3.0-green?style=flat-square)
![crypto](https://img.shields.io/badge/crypto-AES--256--GCM-purple?style=flat-square)
![PBKDF2](https://img.shields.io/badge/PBKDF2-600k%20iterations-orange?style=flat-square)

中文 | [English](README.en.md)

---

花钥是一个无后端、本地优先、端到端加密的多端工具，用于确定性密码生成、加密密码存储、书签收藏和加密笔记管理。它把核心密码学、数据模型和同步引擎封装在共享核心库中，再分别提供浏览器插件、移动端、桌面端和轻量用户脚本入口。

## 核心定位

- 本地优先：数据默认保存在本机，主密码和派生密钥不上传到任何服务端。
- 确定性密码生成：主密码 + 代号可稳定生成同一密码，适合不想保存站点密码的场景。
- 加密存储：对需要保存的固定密码、书签标题、备注、笔记正文等敏感字段使用 AES-256-GCM 加密。
- 多端同步：通过 WebDAV 增量同步加密后的操作日志；移动端可选 iCloud 同步。
- 自动填充：浏览器插件支持页面内填充，Android 端提供 AutofillService。

## 功能概览

### 确定性密码生成

使用 PBKDF2 派生主密钥，再以 `HMAC-SHA256(masterKey, codename)` 生成密码字节流。该模式适合不想保存网站实际密码的用户。

### 存储模式密码

用户可主动保存无法由代号生成的固定密码，例如银行卡 PIN 或历史账户密码。`storedPassword` 字段会在落库前加密。

### 书签管理

浏览器插件支持一键收藏当前页面。书签标题和描述是否加密，取决于用户的书签加密设置。

### 加密笔记

浏览器插件、移动端和桌面端都提供笔记管理。笔记正文被视为敏感字段并加密存储。

### 文件引用模型

共享数据模型包含 `file_ref` 条目类型，可保存文件名、来源链接等引用信息。该能力目前属于核心模型支持，不是所有端的主导航入口。

### 同步与自动填充

同步引擎使用加密 OpLog、短期同步锁、快照压缩和 Last-Write-Wins 冲突解决。Chrome/Edge 扩展提供页面内填充，Android 使用系统 AutofillService 匹配域名或原生 App 包名。

### 恢复码

花钥可生成恢复码并用它加密保存主密码，降低忘记主密码后永久丢失数据的风险。

## 平台支持

### 浏览器插件

- Chrome/Edge Manifest V3 扩展。
- Popup 提供快速操作。
- Side Panel 提供完整管理界面。
- Background Service Worker 负责解锁态、右键菜单、密码生成和填充。
- Content Script 提供悬浮球、页内快速生成、密码框浮层和 Shadow DOM 隔离。

### 移动端

- Capacitor 7 Android/iOS 应用。
- 通过 `@capacitor-community/sqlite` 使用 SQLite 本地存储。
- 通过原生后端支持 WebDAV 同步。
- iOS 场景支持 iCloud 同步。
- Android 集成 AutofillService，支持系统版本允许时的内联建议。

### 桌面端

- Tauri 2 Windows/macOS 应用。
- 提供密码、书签、笔记和设置管理。
- 支持 WebDAV 同步、恢复码、修改主密码、备份导入导出和浏览器书签导入。

### 用户脚本

- Tampermonkey/Via 单文件脚本。
- 提供轻量密码生成、复制和页面填充。
- 启用“记住主密码”时会把主密码保存在用户脚本本地存储中，安全级别低于正式端。

## 安全设计

花钥正式端的边界是：主密码不离开本地，派生密钥仅在解锁期间驻留内存。生成模式不会保存网站实际密码；存储模式仅在用户主动选择时保存加密后的固定密码。

### 三路密钥派生

```text
master password
    |
    |-- PBKDF2(masterPwd, "flowerkey_verify_" + verifySalt)
    |   `-- verifyHash: 本地验证主密码，不能反推出主密码
    |
    |-- PBKDF2(masterPwd, userSalt)
    |   `-- masterKey: 确定性密码生成，不落盘
    |
    `-- PBKDF2(masterPwd, "flowerkey_dbenc_" + userSalt)
        `-- dbKey: 数据库敏感字段加解密，锁定后清除
```

参数：PBKDF2、SHA-256、600,000 次迭代、256-bit 密钥长度。

### 密码生成流程

```text
masterKey = PBKDF2(masterPwd, userSalt)
rawBytes  = HMAC-SHA256(masterKey, codename)
password  = encode(rawBytes, charset, length)
```

只要主密码、代号、字符集和长度一致，任意设备生成结果一致。代号变更会生成不同密码。

### 字段加密边界

加密字段：

- `codename`
- `title`
- `description`
- `fileName`
- `sourceUrl`
- `storedPassword`
- `content`

明文字段：

- `id`
- `type`
- `folder`
- `tags`
- `url`
- `favicon`
- `encrypted`
- `appPackage`
- `createdAt`
- `updatedAt`
- `lastUsedAt`

`url` 和 `appPackage` 明文保存，是为了浏览器域名匹配和 Android AutofillService 包名匹配。书签是否加密由 `encrypted` 配置决定；如果书签选择明文模式，标题和描述会按用户配置保留为明文。

### 加密格式

```text
[version 1B] + [random IV 12B] + [AES-256-GCM ciphertext + auth tag]
```

随机 IV 避免相同内容产生相同密文，GCM 认证标签用于发现密文被篡改。

### 威胁模型

花钥设计上可以防御：

- WebDAV 服务商或网络中间人读取同步文件内容。
- 本地数据库或远端同步目录泄露后的离线读取。
- 同步文件被篡改后无法通过认证解密。
- 普通云盘同步服务不可信。

花钥不承诺防御：

- 设备已解锁时本机恶意软件读取内存。
- 过弱主密码导致的低成本暴力破解。
- 用户忘记主密码且未保存恢复码。
- 用户脚本启用本地保存主密码后的脚本存储风险。

请务必保存恢复码，并为 WebDAV 或 iCloud 同步配置可靠的备份策略。花钥没有中心化账号系统，无法代替用户恢复丢失的主密码或本地数据。

## 同步机制

WebDAV 是正式端的通用同步后端，默认远端目录为：

```text
/FlowerKey/
├── sync.lock
├── vault.enc
└── oplog/
    └── {deviceId}_{timestamp}.enc
```

同步流程：

1. 获取 `sync.lock`，避免多设备同时写入。
2. 将本地未同步 ChangeLog 序列化为 OpLog。
3. 使用 `dbKey` 加密 OpLog 后写入 WebDAV。
4. 拉取其他设备的新 OpLog 并按时间顺序应用。
5. 使用 Last-Write-Wins，以 `updatedAt` 时间戳解决冲突。
6. 当 OpLog 文件数量达到阈值后，生成 `vault.enc` 快照进行压缩。

移动端额外支持 iCloud 后端，主要用于 iOS 设备之间通过 iCloud Drive 同步。

## 项目结构

```text
packages/
├── core/       核心库：密码学、数据模型、Dexie 数据层、同步引擎
├── ui/         共享 UI：Vue 组件、Pinia 状态、通用表单与页面
├── extension/  浏览器插件：Popup、Side Panel、Background、Content Script
├── mobile/     移动端：Capacitor 应用、SQLite 适配、Android Autofill
├── desktop/    桌面端：Tauri 应用
└── via/        用户脚本：轻量密码生成和填充
scripts/
└── sync-version.js
```

## 技术栈

- 语言与框架：TypeScript、Vue 3
- 状态管理：Pinia
- 构建：Vite 6、pnpm workspace
- 样式：Tailwind CSS 3
- 核心加密：Web Crypto API、PBKDF2、HMAC-SHA256、AES-256-GCM
- 浏览器存储：Dexie.js / IndexedDB
- 移动端存储：`@capacitor-community/sqlite`
- 同步：WebDAV、iCloud（移动端）
- 浏览器插件：Chrome/Edge Manifest V3
- 移动端：Capacitor 7
- 桌面端：Tauri 2

## 快速开始

要求：Node.js、pnpm，以及对应平台构建所需的 Android Studio、Xcode 或 Rust/Tauri 工具链。

```bash
# 安装依赖。
pnpm install

# 以监听模式运行浏览器插件开发构建。
pnpm dev:extension

# 构建核心库。
pnpm build:core

# 构建浏览器插件，输出到 packages/extension/dist。
pnpm build:extension
```

根目录的 `pnpm build` 会递归执行 workspace 中存在的 build 脚本。当前 `@flowerkey/ui` 是共享源码包，没有独立 build 脚本和单独发布产物。

## 分端构建

### 构建浏览器插件

```bash
pnpm --filter @flowerkey/extension build
```

构建产物位于 `packages/extension/dist/`。在 Chrome 或 Edge 中以“加载已解压的扩展程序”方式加载该目录。

### 构建移动端

```bash
pnpm --filter @flowerkey/mobile build
pnpm --filter @flowerkey/mobile sync
pnpm --filter @flowerkey/mobile android
pnpm --filter @flowerkey/mobile ios
```

Android Release APK 构建可参考项目内 CLAUDE.md 中记录的 Gradle 命令。Windows 环境下建议使用 PowerShell 执行 `gradlew.bat`。

### 构建桌面端

```bash
pnpm --filter @flowerkey/desktop tauri:dev
pnpm --filter @flowerkey/desktop tauri:build
```

Tauri 打包目标包括 NSIS 和 macOS app。

## 版本管理

统一修改根 `package.json` 的 `version` 字段，然后运行：

```bash
pnpm version:sync
```

脚本会同步 core、ui、extension、mobile、desktop 的 package 版本，并更新桌面端 Cargo/Tauri 配置、浏览器插件 manifest、Android versionCode/versionName。`packages/via/flowerkey.user.js` 是非 workspace 单文件脚本，版本需单独确认。

## 数据与备份建议

- 主密码不会上传到 WebDAV、iCloud 或任何第三方服务。
- 生成模式密码依赖主密码和代号；忘记任一项都无法重新生成原密码。
- 存储模式密码、书签、笔记等数据依赖本地数据库和同步备份。
- 建议启用 WebDAV 或 iCloud 同步，并离线保存恢复码。
- 修改主密码、迁移设备或清理浏览器数据前，应先完成一次同步或备份导出。

## 许可证

本项目采用 GNU General Public License v3.0。详见 [LICENSE](LICENSE)。
