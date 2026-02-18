# UI 组件库源码目录说明

## 目录作用

Vue 3 共享 UI 组件库，供浏览器插件、桌面端、移动端复用。

## 文件列表

### components/

| 文件 | 作用 |
|------|------|
| `UnlockForm.vue` | 解锁表单：输入记忆密码解锁，验证后写入 session |
| `SetupForm.vue` | 初始化设置：首次使用时设置记忆密码和用户盐 |
| `EntryList.vue` | 条目列表：展示密码/书签/文件引用，支持搜索、文件夹/标签筛选 |
| `EntryForm.vue` | 条目编辑表单：新建/编辑 Entry，支持三种类型 |
| `SettingsPage.vue` | 设置页：WebDAV 配置、修改记忆密码、导出/导入数据 |

### stores/

| 文件 | 作用 |
|------|------|
| `main.ts` | 主状态：解锁状态、当前用户、初始化流程 |
| `entries.ts` | 条目状态：Entry 列表、CRUD 操作、搜索过滤 |
| `sync.ts` | 同步状态：WebDAV 配置、同步进度、上次同步时间 |

### 其他

| 文件 | 作用 |
|------|------|
| `style.css` | 全局样式，基于 Tailwind CSS |

## 技术说明

- 使用 Pinia 管理状态，stores 与 `@flowerkey/core` 的 db/crypto 直接交互
- 组件不依赖任何扩展 API，可在任意宿主环境使用
