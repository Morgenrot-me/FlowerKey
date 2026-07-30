# GitHub Actions 工作流目录说明

> 更新时间：2026-07-30
> 更新概要：建立持续集成和版本标签多端自动发布流程。

## 目录作用

本目录保存 FlowerKey 的 GitHub Actions 工作流。普通提交只执行质量门禁；正式版本标签额外构建并发布浏览器扩展、Android APK 和 Windows 安装程序。

## 文件列表

| 文件 | 作用 |
|------|------|
| `ci.yml` | 在 `main` 推送和 Pull Request 时运行测试、类型检查和全部 Web 构建。 |
| `release.yml` | 在版本标签或手动补发时校验版本、构建三端产物并更新 GitHub Release。 |

## 技术说明

- JavaScript 任务统一使用 Node.js 22、pnpm 11.1.3 和冻结锁文件安装。
- Android 使用 Ubuntu、Temurin Java 21 和项目 Gradle Wrapper。
- Windows 桌面端使用 Windows runner、Rust stable 和 Tauri NSIS。
- Release 任务只在所有平台构建成功后获得 `contents: write`。
- Android 正式签名通过仓库 Secrets 注入，密钥不得出现在源码、日志或工件中。
- 所有第三方 Actions 固定到完整提交 SHA，升级时必须重新审核对应上游版本。
- `prepare` 只解析一次标签提交，各平台按不可变 commit SHA 构建；上传前强制刷新远端标签并再次核对。
- Android 标签源码构建完成后才解码临时 PKCS#12，证书核验后立即从 runner 删除。

## 使用示例

推送新标签会自动发布：

```bash
git tag v1.0.3
git push origin v1.0.3
```

已有标签需要补发时，在 GitHub Actions 页面运行“发布多端安装包”，输入完整标签，例如 `v1.0.2`。

## 扩展方式

新增平台时，优先增加独立构建 job，并将产物作为 Actions artifact 交给最终 `release` job。不要让平台构建 job 直接修改 Release，避免部分成功时留下不完整版本。

## 注意事项

- 不要在 Pull Request 工作流中读取发布 Secrets。
- 不要扩大默认 `GITHUB_TOKEN` 权限。
- 不要用分支当前版本替代标签版本构建。
- 不要把签名 Secrets 提升为 job 级环境变量，依赖安装和标签源码前端构建不得读取发布密钥。
- 更新 action 主版本、runner 或工具链版本后，必须重新执行一次手动发布验证。
