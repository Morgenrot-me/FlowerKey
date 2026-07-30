# Android 原生工程目录说明

> 更新时间：2026-07-30
> 更新概要：移除本机 Java 绝对路径，增加环境变量固定发布签名。

## 目录作用

本目录是 Capacitor 生成并维护的 Android 原生工程，用于构建花钥移动端 APK，并承载 Android AutofillService、原生插件、Gradle 构建配置与平台资源。

## 文件列表

| 文件 / 目录 | 作用 |
|-------------|------|
| `app/` | Android 应用模块，包含原生 Java 代码、Manifest、资源、ProGuard 规则和 APK 构建配置。 |
| `capacitor-cordova-android-plugins/` | Capacitor / Cordova 插件桥接模块，由 Capacitor 同步生成。 |
| `build.gradle` | Android 根工程 Gradle 配置，声明 Android Gradle Plugin 等顶层依赖。 |
| `settings.gradle` | Gradle 模块注册与插件仓库配置，包含 Capacitor 生成的模块引入。 |
| `capacitor.settings.gradle` | Capacitor 插件模块设置，由 `npx cap sync android` 生成。 |
| `variables.gradle` | Android SDK、AndroidX、测试依赖等版本变量。 |
| `gradle.properties` | Gradle 运行参数、AndroidX 与构建缓存配置。 |
| `gradlew` / `gradlew.bat` | Gradle Wrapper 启动脚本，Windows 构建使用 `gradlew.bat`。 |
| `gradle/` | Gradle Wrapper 元数据目录。 |
| `build/` | Gradle 构建输出和报告目录，不作为源码维护入口。 |

## 技术说明

- Android 构建要求 Java 21，通过当前环境的 `JAVA_HOME` 选择 JDK。
- Release 构建启用 R8 混淆，并通过 ABI split 输出 `arm64-v8a` 与 `armeabi-v7a` APK。
- GitHub Actions 通过 Android Gradle Plugin 的 `android.injected.signing.*` 命令行属性注入固定发布签名，并在上传前比对 APK 与密钥库证书指纹；本地常规构建只生成用于功能验证的 debug 签名包。
- `app/capacitor.build.gradle`、`capacitor.settings.gradle` 等文件由 Capacitor 生成，优先通过 `npx cap sync android` 更新。
- AutofillService 原生代码直接读取 `flowerkeySQLite.db`，因此数据库字段变更必须同步检查 `app/src/main/java/com/flowerkey/app/`。

## 使用示例

```powershell
Set-Location 'packages/mobile/android'
.\gradlew.bat --no-daemon --max-workers=1 "-Dorg.gradle.jvmargs=-Xms64m -Xmx1024m -XX:CICompilerCount=2 -XX:ReservedCodeCacheSize=64m -XX:+HeapDumpOnOutOfMemoryError" "-Dorg.gradle.parallel=false" :app:assembleRelease
```

## 扩展方式

1. 新增原生能力时，在 `app/src/main/java/com/flowerkey/app/` 添加 Java 插件或服务，并在应用入口或 Manifest 中注册。
2. 新增 Capacitor 插件依赖时，先更新移动端包依赖，再运行 `npx cap sync android` 生成原生工程配置。
3. 新增数据库字段时，先改移动端 SQLite schema，再检查 AutofillService 查询、插入、更新 SQL 是否需要同步扩展。
4. 调整构建参数时优先修改非生成文件，例如 `gradle.properties`、`variables.gradle` 或根 `build.gradle`。

## 注意事项

- 不要手工修改标注为 Capacitor 生成的文件，除非随后会通过同步命令稳定再生成。
- 不要把发布签名密钥、密钥库密码或生产部署凭据写入本目录。
- 公开发布不得上传 debug 签名 APK；GitHub Actions 缺少任一 Android 签名 Secret 时必须失败。
- 构建输出位于 `app/build/outputs/apk/release/`，产物收集由根目录脚本统一处理。
