<p align="center">
  <img src="透明蓝钥匙白天.png" alt="花钥 Logo" width="120" />
</p>

<h1 align="center">花钥 FlowerKey</h1>

<p align="center">
  <strong>确定性密码生成 · 端到端加密 · 本地优先 · 多端同步</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.4.2-blue?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-green?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/crypto-AES--256--GCM-purple?style=flat-square" alt="crypto" />
  <img src="https://img.shields.io/badge/PBKDF2-600k%20iterations-orange?style=flat-square" alt="PBKDF2" />
</p>

<p align="center">
  密码生成管理 + 书签收藏 + 文件引用管理的多端工具。<br/>
  无后端、零信任、主密码永不离开本地、WebDAV 自托管同步。
</p>

---

## ✨ 特性

|  | 功能 | 说明 |
|:---:|------|------|
| 🔑 | **确定性密码生成** | 主密码 + 代号 → 确定性密码，无需存储，跨设备一致 |
| 🗄️ | **任意密码存储** | 银行卡 PIN、已有账户等无法生成的密码，AES-256-GCM 加密存储 |
| 🔖 | **书签收藏** | 浏览器插件一键收藏，支持加密 / 明文两种模式 |
| 🔒 | **端到端加密** | 敏感字段逐字段加密，主密码永不落盘 |
| ☁️ | **WebDAV 同步** | 增量 OpLog 同步，兼容坚果云，LWW 冲突解决 |
| 🤖 | **自动填充** | 浏览器插件内联填充 + Android AutofillService |

### 📦 多端支持

| 平台 | 技术 | 状态 |
|------|------|:----:|
| 🖥️ Windows / macOS | Tauri 2 桌面端 | ✅ |
| 🌐 Chrome / Edge | Manifest V3 浏览器插件 | ✅ |
| 📱 Android / iOS | Capacitor 7 移动端 | ✅ |
| 🔧 via 浏览器 | 油猴脚本 | ✅ |

---

## 🔐 安全设计

> **核心原则：花钥从不存储主密码，也从不存储任何网站的实际密码。**

所有密码在需要时**实时计算**，用完即弃。只要主密码和代号不变，任何设备、任何时间生成的密码**完全一致**——即使数据全部丢失，密码依然可以还原。

### 三路密钥派生

主密码输入后派生三个**完全独立**的密钥，互不干扰：

```
主密码 (masterPwd)
    │
    ├── PBKDF2(pwd, "flowerkey_verify_" + verifySalt)
    │   └─→ verifyHash — 验证密码正确性，存入本地
    │
    ├── PBKDF2(pwd, userSalt)
    │   └─→ masterKey  — 生成网站密码，不存储，用完即弃
    │
    └── PBKDF2(pwd, "flowerkey_dbenc_" + userSalt)
        └─→ dbKey      — 加解密数据库字段，不存储，锁定后清除
```

> PBKDF2 · SHA-256 · **600,000 次迭代** — 符合 OWASP 2024 推荐标准

### 密码生成原理

```
masterKey = PBKDF2(masterPwd, userSalt)          ① 派生主密钥
rawBytes  = HMAC-SHA256(masterKey, codename)      ② 用代号生成字节流
password  = encode(rawBytes, charset, length)     ③ 编码为可用密码
```

### 本地存储内容

| 字段 | 存储形式 | 用途 |
|------|:--------:|------|
| `verifyHash` / `verifySalt` | 明文 | 验证主密码（无法反推） |
| `codename` / `title` / `description` / `url` / `storedPassword` | 🔒 AES-256-GCM | 敏感业务数据 |
| `id` / `type` / `folder` / `tags` | 明文 | 索引字段 |

**不存储**：主密码、任何网站的实际密码、数据库加密密钥（仅内存中，锁定即清除）

### 加密格式

```
[版本 1B] + [随机 IV 12B] + [AES-256-GCM 密文 + 认证标签]
```

随机 IV 防止模式分析 · GCM 认证标签防止篡改

### 恢复码

32 字节随机恢复码，用 PBKDF2 派生密钥加密主密码后存储。恢复码本身**不存储在本地**，丢失恢复码且忘记主密码则数据无法恢复。

### 威胁模型

| 能防御 ✅ | 不能防御 ❌ |
|-----------|------------|
| WebDAV 服务商读取数据（已加密） | 设备解锁时恶意软件读取内存 |
| 设备被盗后离线暴力破解 | 主密码本身过于简单 |
| 数据库文件泄露 | 忘记主密码且未设置恢复码 |

> ⚠️ **数据丢失风险**：花钥无后端，数据仅存于本地。**请务必配置 WebDAV 同步并生成恢复码妥善保管。**

---

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 开发
pnpm dev:extension      # 浏览器插件开发模式

# 构建
pnpm build:extension    # 构建浏览器插件 → packages/extension/dist/
pnpm build:core         # 构建核心库
pnpm build              # 构建所有包

# 版本管理
pnpm version:sync       # 同步根 package.json 版本号到所有子包
```

---

## 📁 项目结构

```
packages/
├── core/         核心库 — 加密 / 数据层 / 同步引擎（所有端复用）
├── ui/           共享 UI — Vue 3 组件 + Pinia 状态管理
├── desktop/      桌面端 — Tauri 2（Windows / macOS）
├── extension/    浏览器插件 — Manifest V3（Chrome / Edge）
├── mobile/       移动端 — Capacitor 7（Android / iOS）
└── via/          油猴脚本 — via 浏览器适配
scripts/
└── sync-version.js   版本号同步脚本
```

## 🛠️ 技术栈

| 层 | 技术 |
|:---:|------|
| 框架 | Vue 3 + TypeScript |
| 状态 | Pinia |
| 存储 | Dexie.js（IndexedDB） |
| 加密 | Web Crypto API（零外部依赖） |
| 同步 | WebDAV（增量 OpLog） |
| 桌面 | Tauri 2 |
| 移动 | Capacitor 7 |
| 样式 | Tailwind CSS 3 |
| 构建 | Vite 6 |
| 管理 | pnpm workspace |

---

## ☁️ WebDAV 同步

增量同步，基于 OpLog + LWW 冲突解决。远端目录：

```
/FlowerKey/oplog/{deviceId}_{timestamp}.enc
```

**同步的核心价值**不是帮你记住密码（生成模式的密码只需主密码 + 代号即可还原），而是同步：
- 📚 **书签**和**存储模式密码**（无法从记忆还原）
- 📋 **代号列表**（避免新设备重新录入）
- 📂 **标签与文件夹结构**（多端一致）

> 坚果云限制：每 30 分钟 600 次 API 请求

---

## 🤖 自动填充

### 浏览器插件

监听密码框 `focusin` → 弹出内联浮层 → 匹配 `hostname` → 一键填充

- **已解锁**：直接展示匹配条目
- **未解锁**：浮层内嵌解锁表单

### Android AutofillService

系统检测密码框 → 弹出"使用花钥填充密码" → 匹配 `webDomain` 或 `packageName`

- **App 已解锁**：`FlowerKeyApp` 内存中有 `dbKey`，直接跳过验证
- **App 未解锁**：打开验证页输入主密码

### 主密码生命周期

```
解锁 ─┬─ 浏览器插件：masterPwd 存于 background service worker 内存
      │   永不写入 chrome.storage，关闭浏览器自动清除
      │
      └─ Android：验证后 dbKey 存入 FlowerKeyApp 内存
          masterPwd 仅在验证时短暂存于栈变量，验证后不保留

锁定 ─── 所有平台：内存中的 dbKey / masterPwd 立即清零
```

---

## 📄 许可证

GPL-3.0 License © 2025 FlowerKey
