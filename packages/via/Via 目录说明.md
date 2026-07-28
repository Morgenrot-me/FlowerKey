# Via 单文件脚本目录说明

> 更新时间：2026-07-28
> 更新概要：补充 FK-DP1 最终 userscript 固定向量测试。

## 目录作用

提供可在 Via、Tampermonkey 等 userscript 环境中直接运行的花钥单文件版本。该端不持久化主密码或身份密语，每次使用时由用户输入。

## 文件列表

- `flowerkey.user.js`：最终发布的 userscript，内联 FK-DP1 生成实现与悬浮面板。
- `flowerkey.user.spec.ts`：直接从最终发布文件中提取并执行生成实现，核对冻结固定向量。

## 技术说明

userscript 为保持单文件部署而内联密码生成代码。它必须与核心 TypeScript 和 Android Java 实现逐字符兼容，不能自行调整字符表、规范化顺序、迭代次数或输出位置规则。

## 使用与验证

```bash
# 从仓库根目录执行；直接测试最终 userscript 中的实际实现
pnpm test -- packages/via/flowerkey.user.spec.ts
```

## 扩展方式与注意事项

- 修改 FK-DP1 相关代码后必须运行固定向量测试。
- 不得在 userscript 存储区、页面 DOM 或站点存储中持久化主密码与身份密语。
- 若未来新增生成协议版本，必须保留 FK-DP1 兼容路径，不能静默改变已有输出。
