# 共享UI组件目录说明

> 更新时间：2026-08-02
> 更新概要：视觉优化——统一密码显示掩码（UnlockForm 支持显示/隐藏）、补齐 SVG 图标接线（chevron/plus/close）、全局 focus-visible 与 reduced-motion 适配、移动端触控目标与对话框语义化、新增品牌色 token。

## 目录作用

FlowerKey 的共享 Vue 3 UI 组件库，所有端（插件/桌面/移动）复用此组件。

## 文件列表

### components/

| 文件 | 作用 |
| ---- | ---- |
| `SetupForm.vue` | 首次设置表单 - 设置记忆密码和自定义盐 |
| `UnlockForm.vue` | 锁定态入口表单 - 支持正式密码计算、独立计算、数据库登录与恢复码解锁 |
| `EntryList.vue` | 密码条目列表 |
| `EntryForm.vue` | 密码新建/编辑表单，支持生成与存储模式 |
| `SecretPage.vue` | 浏览器端 FK-SECRET-1 加密秘密库 |
| `PasswordStrength.vue` | 密码强度指示条 |
| `PasswordStrength.test.ts` | 密码强度组件测试 |

### stores/

| 文件 | 作用 |
| ---- | ---- |
| `main.ts` | 主状态管理 - 认证状态、解锁/锁定、密码生成 |
| `entries.ts` | 条目状态管理 - CRUD、筛选、搜索 |
| `entries.test.ts` | 条目状态管理测试（加载、筛选、搜索、CRUD 刷新） |

### 其他

| 文件 | 作用 |
| ---- | ---- |
| `style.css` | Tailwind CSS 入口样式 |

## 技术说明

- UI 框架：Vue 3 Composition API
- 状态管理：Pinia
- 样式：Tailwind CSS
- 组件通过 `@flowerkey/core` 调用加密和数据层

## 扩展方式

- 新增组件：在 `components/` 下创建 `.vue` 文件
- 新增页面：在 `views/` 下创建
- 新增状态：在 `stores/` 下创建 Pinia store

## 注意事项

- 组件不直接依赖浏览器扩展 API（chrome.*）
- 保持组件的平台无关性，方便多端复用
