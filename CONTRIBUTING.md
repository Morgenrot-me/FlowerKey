# 贡献指南

感谢你愿意为花钥（FlowerKey）贡献代码。请先阅读本指南，确保改动符合项目规范。

## 项目结构

```
packages/
├── core/       核心库：密码学、数据模型、数据层、同步引擎
├── ui/         共享 UI：Vue 组件、Pinia 状态、通用表单与页面
├── extension/  浏览器插件（Manifest V3）
├── mobile/     移动端（Capacitor 7）
├── desktop/    桌面端（Tauri 2）
└── via/        用户脚本
docs/           架构、安全与实现计划文档
scripts/        版本同步等工具脚本
```

## 开发环境

- Node.js 22+
- pnpm 11（仓库已启用 `packageManager` 与冻结锁文件）

```bash
pnpm install            # 安装依赖
pnpm test               # 运行测试
pnpm typecheck          # 类型检查
pnpm build              # 构建全部 Web 包
pnpm version:sync       # 同步各包版本号
```

## 提交规范

- 使用 Conventional Commits 格式：`<type>(<scope>): <subject>`
- 常用 type：`feat` / `fix` / `docs` / `test` / `chore` / `refactor`
- 常用 scope：`core` / `ui` / `extension` / `mobile` / `desktop` / `sync` / `android`
- 提交信息用中文描述，subject 简明扼要（一般不超过 50 字）
- 单个提交保持单一职责：不要混入无关重构、文档或版本号变更

示例：

```
fix(core): 修复同步锁竞态导致的多设备写入冲突
feat(mobile): 为 AutofillService 增加内联建议回退
chore(release): 同步 1.0.3 版本号
```

## 分支与 PR

- 从 `main` 新建功能分支，命名建议：`feat/<简述>`、`fix/<简述>`
- 提交前运行 `pnpm test` 与 `pnpm typecheck`，确保全部通过
- PR 请关联对应 Issue，描述改动内容与验证方式

## 代码约定

- 修改前检查 git 状态，功能完成后立即提交
- 文件头保留作用说明注释，关键逻辑添加注释
- 前后端/多端同步修改，保证字段一致、通信正常
- 新增/修改代码后同步更新对应目录说明文档（`docs/` 与各包内说明文档）

## 安全相关

涉及加密、密钥派生、数据格式或同步协议的改动，请先阅读 [SECURITY.md](SECURITY.md) 与 `docs/` 下的设计文档，并在 PR 描述中说明安全影响。

## 文档

- `docs/` 保存需要先于代码确定的设计与计划
- 会改变 FK-DP1 输出的设计不得直接覆盖旧协议，必须新增协议版本
