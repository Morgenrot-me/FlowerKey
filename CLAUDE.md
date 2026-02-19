# 花钥 FlowerKey - 项目说明

## 项目概述

密码生成管理 + 书签收藏 + 文件引用管理的多端工具。
核心理念：无后端、本地优先、端到端加密、WebDAV 自托管同步。

## Monorepo 结构

```
packages/
├── core/       核心库（加密/数据层/同步引擎），所有端复用
├── ui/         插件共享 UI 组件（仅 extension 使用）
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
| 云同步 | WebDAV（webdav npm 包） |
| 移动端 | Capacitor 7 |
| 样式 | Tailwind CSS 3 |
| 构建 | Vite 6 |
| 包管理 | pnpm workspace |

## 核心加密设计

三路 PBKDF2 密钥完全隔离（600,000 次迭代，SHA-256）：

```
verifyHash = PBKDF2(masterPwd, "flowerkey_verify_" + verifySalt)
             verifySalt 随机生成，仅本地存储，防彩虹表攻击

masterKey  = PBKDF2(masterPwd, userSalt)
             userSalt 固定为 "FlowerKey"，保证跨设备密码一致性

dbKey      = PBKDF2(masterPwd, "flowerkey_dbenc_" + userSalt)
             用于 IndexedDB 条目敏感字段 AES-256-GCM 加密
```

密码生成：`HMAC-SHA256(masterKey, codename)` → 编码为指定字符集

## IndexedDB 加密字段

以下字段 AES-256-GCM 加密后以 base64 存储：
`codename`, `url`, `title`, `description`, `fileName`, `sourceUrl`

未加密字段（IndexedDB 索引需要）：
`id`, `type`, `folder`, `tags`, `createdAt`, `updatedAt`

## 常用命令

```bash
pnpm build:core          # 构建核心库
pnpm build:extension     # 构建浏览器插件
pnpm build               # 构建所有包
pnpm version:sync        # 同步版本号（改根 package.json 后运行）
```

## 版本管理

统一在根 `package.json` 的 `version` 字段维护，运行 `pnpm version:sync` 同步到所有子包。

## 数据模型

```typescript
Entry {
  id, type, tags, folder, description, createdAt, updatedAt  // 明文
  codename?, salt?, charsetMode?, passwordLength?             // 密码条目（加密）
  url?, title?, favicon?                                      // 书签条目（加密）
  fileName?, sourceUrl?                                       // 文件引用（加密）
}
```

## WebDAV 同步

增量同步，基于 ChangeLog（LWW 冲突解决）。
远端目录结构：`/FlowerKey/oplog/{deviceId}_{timestamp}.enc`

兼容坚果云（API 频率限制：每30分钟600次）。
