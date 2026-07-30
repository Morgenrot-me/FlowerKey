# GitHub Actions 多端自动发布设计

> 更新时间：2026-07-30
> 更新概要：定义普通提交质量门禁、版本标签多端构建、固定 Android 签名和 GitHub Release 产物上传流程。

## 1. 目标

花钥在推送 `v*.*.*` 标签后，必须由 GitHub Actions 从该标签对应的同一份源码构建并发布以下产物：

- Chrome / Edge 浏览器扩展 ZIP；
- Android `arm64-v8a` 与 `armeabi-v7a` Release APK；
- Windows Tauri NSIS 安装程序；
- 包含所有发布文件 SHA-256 的校验清单。

已经存在的标签和 Release 可以通过手动调度补发，不需要删除或重建 Git 标签。

## 2. 工作流边界

### CI

`.github/workflows/ci.yml` 在 `main` 推送和 Pull Request 时运行：

1. 使用锁文件安装依赖；
2. 执行 `pnpm test`；
3. 执行 `pnpm typecheck`；
4. 执行 `pnpm build`。

CI 只需要 `contents: read`，不得创建 Release 或写入仓库。

### Release

`.github/workflows/release.yml` 支持两种触发方式：

- 推送匹配 `v*.*.*` 的标签；
- 手动调度并输入已经存在的版本标签。

工作流先验证标签格式、标签对应版本和各端版本号一致，并将标签解析为不可变 commit SHA，再让各平台按该 SHA 并行构建。最终发布任务仅在所有构建成功后执行，强制刷新并复核远端标签、下载同一次运行产生的工件、生成 SHA-256 清单，并使用 `contents: write` 创建或更新该标签的正式 Release。

## 3. Android 固定签名

公开 APK 不得使用 Gradle 自动生成的 debug keystore。GitHub 仓库需要配置：

- `ANDROID_KEYSTORE_BASE64`：发布 PKCS#12 密钥库的 Base64 文本；
- `ANDROID_KEY_ALIAS`：密钥别名；
- `ANDROID_KEYSTORE_PASSWORD`：密钥库密码；
- `ANDROID_KEY_PASSWORD`：密钥密码。

Actions 必须先完成依赖安装、移动端 Web 构建和 Capacitor 同步，再将密钥库解码到 runner 临时目录，并通过 Android Gradle Plugin 的 `android.injected.signing.*` 命令行属性覆盖标签源码中的本地签名配置。构建后必须逐个比对 APK 证书与密钥库证书的 SHA-256 指纹，随后立即删除 runner 临时密钥库。密钥库、密码和 Base64 内容不得写入仓库、构建日志或 Actions 工件，也不得作为 job 级环境变量暴露给无关步骤。

固定发布证书的公开 SHA-256 为：

```text
72:95:BE:DE:9D:97:C3:DE:BF:28:41:61:4A:85:4A:37:B4:DE:5D:D5:F2:96:42:E8:4D:04:3C:FE:A5:B1:99:6C
```

工作流内部使用去除冒号的小写形式进行比对。任何其他证书都不得签署 FlowerKey 正式 APK。

本地常规 `assembleRelease` 可以继续生成仅供本机验证的 debug 签名 Release APK；GitHub Release 工作流必须在构建前验证四个 Secrets 全部存在，缺失或证书指纹不匹配时立即失败，禁止将 debug 签名 APK 上传为正式产物。命令行签名注入不要求历史标签预先包含新的 `build.gradle`，因此可以从原始标签源码补发 `v1.0.2`。

## 4. 构建环境

- JavaScript：Node.js 22、pnpm 11.1.3；
- Android：Ubuntu runner、Temurin Java 21、Gradle Wrapper；
- Windows：Windows runner、Rust stable、Tauri CLI；
- 浏览器扩展：Ubuntu runner、Vite 构建后压缩 `dist` 内容。

所有 JavaScript 依赖必须使用 `pnpm install --frozen-lockfile`。Android 必须先构建移动端 Web 资源并运行 `cap sync android`，再执行 `assembleRelease`。Windows 只构建 NSIS，避免在 Windows runner 请求 macOS `.app` 目标。

## 5. 产物命名

文件名必须包含版本，防止下载后混淆：

```text
FlowerKey-v1.0.2-browser-extension.zip
FlowerKey-v1.0.2-android-arm64-v8a.apk
FlowerKey-v1.0.2-android-armeabi-v7a.apk
FlowerKey-v1.0.2-windows-x64-setup.exe
FlowerKey-v1.0.2-SHA256SUMS.txt
```

版本来自触发标签，不从当前分支或手动文本拼装其他版本。

## 6. 安全与失败策略

- 工作流默认权限为 `contents: read`，只有最终发布任务提升为 `contents: write`；
- 所有 GitHub Actions 使用审核过的完整提交 SHA，不引用可移动的主版本标签；
- 不使用 `pull_request_target`，避免不可信 Pull Request 获得写权限或 Secrets；
- Release 任务只消费当前工作流运行的工件；
- 所有平台使用 `prepare` 输出的不可变 commit SHA，发布前强制刷新远端标签并确认标签没有移动；
- 任一测试、版本校验、签名检查或平台构建失败时，不创建、不更新 Release 附件；
- 手动补发只允许已经存在且符合 `v*.*.*` 的 Git 标签；
- 同名附件允许覆盖，便于修复同一标签下缺失的自动构建产物，但源码始终以标签提交为准。

## 7. 验证

提交前执行：

1. GitHub Actions YAML 静态检查；
2. `pnpm test`；
3. `pnpm typecheck`；
4. `pnpm build`；
5. Android Gradle 任务与本地 APK 构建检查；
6. Windows Tauri NSIS 构建检查；
7. 扩展 ZIP 内容与 manifest 版本检查。

推送后通过手动调度 `v1.0.2` 完成第一次真实端到端验证，并确认 Release 页面存在四类文件及 SHA-256 清单。
