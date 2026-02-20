# 花钥 FlowerKey

密码生成管理 + 书签收藏 + 文件引用管理的多端工具。

**核心理念：无后端、本地优先、端到端加密、WebDAV 自托管同步。**

## 特性

- 🔑 **确定性密码生成** — 基于主密码 + 代号，无需存储密码本身，跨设备一致
- 🔖 **书签收藏** — 浏览器插件一键收藏，支持加密/明文两种模式
- 🔒 **端到端加密** — AES-256-GCM 加密敏感字段，主密码永不离开本地
- ☁️ **WebDAV 同步** — 兼容坚果云等服务，增量同步，LWW 冲突解决
- 📱 **多端支持** — Chrome/Edge 插件 + Android/iOS 移动端

---

## 安全设计：为什么密码不会泄露

### 核心原则

花钥**从不存储你的主密码**，也**从不存储任何网站的实际密码**。

所有密码都是在你需要时**实时计算**出来的，计算完成后立即丢弃，不写入任何存储介质。

### 本地存储了什么

IndexedDB 中存储的内容：

| 字段 | 存储形式 | 说明 |
|------|----------|------|
| `verifyHash` | 明文哈希 | 用于验证主密码是否正确，**无法反推出主密码**。存储它有两个目的：① 代号（codename）加密存储，若主密码输错则无法解密代号，用户将生成完全不同的密码而不自知；② 在用户输入时即时提示密码有误，防止因手误导致后续所有生成密码与预期不符 |
| `verifySalt` | 明文 | 随机盐，防止彩虹表攻击 |
| `userSalt` | 明文 | 固定为 `"FlowerKey"`，保证跨设备密码一致 |
| `codename` | **AES-256-GCM 加密** | 区分代号（如"github"），加密后存储 |
| `url` / `title` / `description` | **AES-256-GCM 加密** | 书签内容，加密后存储 |
| `id` / `type` / `folder` / `tags` | 明文 | 索引字段，不含敏感信息 |

**没有存储的内容：**
- 主密码本身
- 任何网站的实际密码
- 数据库加密密钥（dbKey）——仅在解锁期间存在于内存中，锁定后立即清除

### 三路密钥派生（PBKDF2，600,000 次迭代，SHA-256）

主密码输入后，派生出三个完全独立的密钥，互不干扰：

```
主密码 (masterPwd)
    │
    ├─ PBKDF2(masterPwd, "flowerkey_verify_" + verifySalt)
    │   └─→ verifyHash    仅用于验证密码是否正确，存入本地
    │
    ├─ PBKDF2(masterPwd, "FlowerKey")
    │   └─→ masterKey     仅用于生成网站密码，不存储，用完即弃
    │
    └─ PBKDF2(masterPwd, "flowerkey_dbenc_" + "FlowerKey")
        └─→ dbKey         仅用于加解密 IndexedDB 字段，不存储，锁定后清除
```

600,000 次迭代意味着即使攻击者拿到了本地数据库，每尝试一个候选密码也需要消耗数秒 CPU 时间。面对一个8位以上的强密码，穷举所需时间以千年计。

### 密码生成原理

网站密码**不存储**，每次使用时实时计算：

```
masterKey = PBKDF2(masterPwd, userSalt)          # 步骤1：派生主密钥
rawBytes  = HMAC-SHA256(masterKey, codename)      # 步骤2：用代号生成字节流
password  = encode(rawBytes, charset, length)     # 步骤3：编码为可用密码
```

同样的主密码 + 同样的代号，在任何设备上都会得到完全相同的密码。**代号本身不是密码，泄露代号不会暴露密码**（攻击者还需要主密码）。

### 数据加密格式

每个加密字段的存储格式：

```
[版本(1字节)] + [随机IV(12字节)] + [AES-256-GCM密文+认证标签]
```

随机 IV 保证同一内容每次加密结果不同，防止模式分析。GCM 认证标签保证数据完整性，任何篡改都会被检测到。

### WebDAV 同步安全

同步到 WebDAV 的文件（`.enc`）是已加密的 OpLog，内容与本地 IndexedDB 一致——敏感字段已加密，WebDAV 服务商（包括坚果云）**无法读取你的数据内容**。

### 恢复码机制

恢复码是一个 32 字节（64位十六进制）的随机字符串，用于在忘记主密码时恢复账户：

```
恢复码 (recoveryCode)
    └─ PBKDF2(recoveryCode, "flowerkey_recovery_" + recoverySalt)
        └─→ recoveryKey
            └─ AES-256-GCM 加密(主密码) → encryptedMasterPwd（存入本地）
```

恢复码本身**不存储在本地**，只有加密后的主密码存储。丢失恢复码且忘记主密码，数据将无法恢复。

---

## 快速开始

```bash
pnpm install
pnpm build:extension    # 构建浏览器插件
pnpm build              # 构建所有包
pnpm version:sync       # 同步版本号（改根 package.json 后运行）
```

构建产物在 `packages/extension/dist/`，在浏览器扩展管理页加载即可。

## 项目结构

```
packages/
├── core/       核心库（加密/数据层/同步引擎），所有端复用
├── ui/         插件共享 UI 组件
├── extension/  Chrome/Edge 浏览器插件（Manifest V3）
└── mobile/     Android/iOS 移动端（Capacitor 7）
scripts/
└── sync-version.js   版本号同步脚本
```

## 技术栈

| 用途 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| 本地存储 | Dexie.js (IndexedDB) |
| 加密 | Web Crypto API（零外部依赖） |
| 云同步 | WebDAV |
| 移动端 | Capacitor 7 |
| 样式 | Tailwind CSS 3 |
| 构建 | Vite 6 |
| 包管理 | pnpm workspace |

## WebDAV 同步

增量同步，基于 ChangeLog（LWW 冲突解决）。

远端目录：`/FlowerKey/oplog/{deviceId}_{timestamp}.enc`

坚果云限制：每 30 分钟 600 次请求。

## 版本管理

统一在根 `package.json` 的 `version` 字段维护，运行 `pnpm version:sync` 同步到所有子包和 `manifest.json`。
