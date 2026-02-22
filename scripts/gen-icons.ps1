Add-Type -AssemblyName System.Drawing

$src = "$PSScriptRoot\..\蓝钥匙.png"
$orig = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$base = "$PSScriptRoot\.."

function Resize($img, $w, $h, $dst) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()
    $dir = Split-Path $dst
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "OK: $dst"
}

# 插件图标
Resize $orig 16  16  "$base\packages\extension\icons\icon16.png"
Resize $orig 48  48  "$base\packages\extension\icons\icon48.png"
Resize $orig 128 128 "$base\packages\extension\icons\icon128.png"

# 移动端 Android mipmap
$mipmap = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}
foreach ($m in $mipmap.GetEnumerator()) {
    $s = $m.Value
    $d = "$base\packages\mobile\android\app\src\main\res\$($m.Key)"
    Resize $orig $s $s "$d\ic_launcher.png"
    Resize $orig $s $s "$d\ic_launcher_round.png"
    $sf = [int]($s * 1.5)
    Resize $orig $sf $sf "$d\ic_launcher_foreground.png"
}

# 桌面端 Tauri
Resize $orig 32  32  "$base\packages\desktop\src-tauri\icons\32x32.png"
Resize $orig 64  64  "$base\packages\desktop\src-tauri\icons\64x64.png"
Resize $orig 128 128 "$base\packages\desktop\src-tauri\icons\128x128.png"
Resize $orig 256 256 "$base\packages\desktop\src-tauri\icons\128x128@2x.png"
Resize $orig 512 512 "$base\packages\desktop\src-tauri\icons\icon.png"

$orig.Dispose()
Write-Host "All done."
