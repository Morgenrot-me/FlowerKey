# 共享UI组件目录说明

## 目录作用

FlowerKey 的共享 Vue 3 UI 组件库，所有端（插件/桌面/移动）复用此组件。

## 文件列表

### components/

| 文件 | 作用 |
|------|------|
| `SetupForm.vue` | 首次设置表单 - 设置记忆密码和自定义盐 |
| `UnlockForm.vue` | 解锁表单 - 输入记忆密码验证后解锁 |
| `EntryList.vue` | 条目列表 - 展示密码/书签/文件引用条目 |
| `EntryForm.vue` | 条目新建/编辑表单 - 支持三种条目类型 |

### stores/

| 文件 | 作用 |
|------|------|
| `main.ts` | 主状态管理 - 认证状态、解锁/锁定、密码生成 |
| `entries.ts` | 条目状态管理 - CRUD、筛选、搜索 |

### 其他

| 文件 | 作用 |
|------|------|
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
