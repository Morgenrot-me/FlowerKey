# 收集各端打包产物到根目录 release/ 文件夹
# 运行前请确保已完成各端构建

$base = "$PSScriptRoot\.."
$out = "$base\release"

# 清空并重建输出目录
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

# Android APK（arm64 release）
$apk = "$base\packages\mobile\android\app\build\outputs\apk\release\app-arm64-v8a-release.apk"
if (Test-Path $apk) {
    Copy-Item $apk "$out\花钥-android-arm64.apk"
    Write-Host "OK: Android APK"
} else { Write-Host "SKIP: Android APK not found" }

# 桌面端安装包（取最新版本）
$nsis = Get-ChildItem "$base\packages\desktop\src-tauri\target\release\bundle\nsis\*-setup.exe" |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($nsis) {
    Copy-Item $nsis.FullName "$out\花钥-desktop-setup.exe"
    Write-Host "OK: Desktop installer ($($nsis.Name))"
} else { Write-Host "SKIP: Desktop installer not found" }

Write-Host "`n产物已收集到: $out"
Get-ChildItem $out | Format-Table Name, @{L='Size';E={"{0:N1} MB" -f ($_.Length/1MB)}}
