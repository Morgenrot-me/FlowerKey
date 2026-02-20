# 花钥 FlowerKey

密码生成管理 + 书签收藏 + 文件引用管理的多端工具。

**核心理念：无后端、本地优先、端到端加密、WebDAV 自托管同步。**

## 特性

- 🔑 **确定性密码生成** — 基于主密码 + 代号，无需存储密码本身，跨设备一致
- 🔖 **书签收藏** — 浏览器插件一键收藏，支持加密/明文两种模式
- 🔒 **端到端加密** — AES-256-GCM 加密敏感字段，主密码永不离开本地
- ☁️ **WebDAV 同步** — 兼容坚果云等服务，增量同步，LWW 冲突解决
- 📱 **多端支持** — Chrome/Edge 插件 + Android/iOS 移动端

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

## 加密设计

三路 PBKDF2 密钥完全隔离（600,000 次迭代，SHA-256）：

```
verifyHash = PBKDF2(masterPwd, "flowerkey_verify_" + verifySalt)
masterKey  = PBKDF2(masterPwd, userSalt)          # 跨设备密码一致性
dbKey      = PBKDF2(masterPwd, "flowerkey_dbenc_" + userSalt)
```

加密字段（AES-256-GCM）：`codename` `url` `title` `description` `fileName` `sourceUrl`

明文字段（IndexedDB 索引）：`id` `type` `folder` `tags` `createdAt` `updatedAt`

## 快速开始

```bash
pnpm install
pnpm build:extension    # 构建浏览器插件
pnpm build              # 构建所有包
pnpm version:sync       # 同步版本号（改根 package.json 后运行）
```

构建产物在 `packages/extension/dist/`，在浏览器扩展管理页加载即可。

## 数据模型

```typescript
Entry {
  // 明文（索引）
  id, type, tags, folder, createdAt, updatedAt
  encrypted?    // false = 书签明文存储

  // 密码条目（加密）
  codename?, salt?, charsetMode?, passwordLength?

  // 书签条目（加密或明文）
  url?, title?, favicon?, description?

  // 文件引用（加密）
  fileName?, sourceUrl?
}
```

## WebDAV 同步

增量同步，基于 ChangeLog（LWW 冲突解决）。

远端目录：`/FlowerKey/oplog/{deviceId}_{timestamp}.enc`

坚果云限制：每 30 分钟 600 次请求。

## 版本管理

统一在根 `package.json` 的 `version` 字段维护，运行 `pnpm version:sync` 同步到所有子包和 `manifest.json`。
