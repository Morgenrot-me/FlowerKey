# UI 组件库源码目录说明

> 更新时间：2026-08-02
> 更新概要：视觉优化——统一密码显示掩码（UnlockForm 支持显示/隐藏）、补齐 SVG 图标接线（chevron/plus/close）、全局 focus-visible 与 reduced-motion 适配、移动端触控目标与对话框语义化、新增品牌色 token。

## 目录作用

Vue 3 共享 UI 组件库，供浏览器插件、桌面端、移动端复用。

## 文件列表

### components/

| 文件 | 作用 |
|------|------|
| `UnlockForm.vue` | 解锁表单：输入记忆密码解锁，验证后写入 session |
| `SetupForm.vue` | 初始化设置：首次使用时设置记忆密码和用户盐 |
| `OnboardingForm.vue` | 引导表单：插件端紧凑版欢迎页，介绍花钥核心理念 |
| `EntryList.vue` | 密码列表：展示生成配置、最近使用时间和标签 |
| `EntryForm.vue` | 密码编辑表单：支持确定性生成与加密存储模式 |
| `SecretPage.vue` | 秘密库：管理 FK-SECRET-1 整体加密载荷，不显示内容摘要 |
| `SettingsPage.vue` | 设置页：WebDAV、锁定策略、恢复原主密码和加密备份 |
| `PasswordStrength.vue` | 密码强度指示条：实时评估密码强度（弱/一般/较强/强） |
| `ConfirmDialog.vue` | 确认对话框：替代原生 confirm()，支持深色模式 |
| `Toast.vue` | Toast 提示：轻量级操作反馈，自动消失 |

### icons/

| 文件 | 作用 |
|------|------|
| `AppIcon.vue` | 统一 SVG 图标组件，替代 emoji，确保跨平台一致性 |

### composables/

| 文件 | 作用 |
|------|------|
| `useConfirm.ts` | 确认对话框可组合函数，替代原生 confirm() |
| `useToast.ts` | Toast 提示可组合函数，提供操作反馈 |

### stores/

| 文件 | 作用 |
|------|------|
| `main.ts` | 主状态：解锁状态、当前用户、初始化流程 |
| `entries.ts` | 条目状态：Entry 列表、CRUD 操作、搜索过滤 |
| `sync.ts` | 同步状态：WebDAV 配置、同步进度、上次同步时间 |

### 其他

| 文件 | 作用 |
|------|------|
| `style.css` | 全局样式，含 `.input` 组件类和 Tailwind CSS 基础层 |

## 技术说明

- 使用 Pinia 管理状态，stores 与 `@flowerkey/core` 的 db/crypto 直接交互
- 组件不依赖任何扩展 API，可在任意宿主环境使用
- `.input` 类在全局 CSS 的 `@layer components` 中定义，各端共享统一输入框样式
