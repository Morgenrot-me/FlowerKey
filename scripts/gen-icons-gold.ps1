Add-Type -AssemblyName System.Drawing

$src = "$PSScriptRoot\..\金色钥匙.png"
$orig = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$base = "$PSScriptRoot\..\packages\mobile\android\app\src\main\res"

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

$mipmap = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}
foreach ($m in $mipmap.GetEnumerator()) {
    $s = $m.Value
    $d = "$base\$($m.Key)-gold"
    Resize $orig $s $s "$d\ic_launcher.png"
    Resize $orig $s $s "$d\ic_launcher_round.png"
    $sf = [int]($s * 1.5)
    Resize $orig $sf $sf "$d\ic_launcher_foreground.png"
}

$orig.Dispose()
Write-Host "Done."
