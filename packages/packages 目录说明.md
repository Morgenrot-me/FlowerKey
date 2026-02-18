# packages 目录说明

## 目录作用

Monorepo 各包目录，包含核心库、UI 组件库、浏览器插件。

## 文件列表

| 目录 | 作用 |
|------|------|
| `core/` | TypeScript 核心库：加密、数据层、同步引擎，所有端复用 |
| `ui/` | Vue 3 共享 UI 组件库：页面视图、Pinia 状态管理 |
| `extension/` | Chrome/Edge 浏览器插件（Manifest V3） |
