Add-Type -AssemblyName System.Drawing

$src = "$PSScriptRoot\..\透明蓝钥匙.png"
$dst = "$PSScriptRoot\..\packages\desktop\src-tauri\icons\icon.ico"
$orig = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$sizes = @(16, 32, 48, 64, 128, 256)
$ms = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($ms)

$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$sizes.Count)

$pngStreams = @()
foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($orig, 0, 0, $s, $s)
    $g.Dispose()
    $ps = New-Object System.IO.MemoryStream
    $bmp.Save($ps, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngStreams += $ps
}

$offset = 6 + $sizes.Count * 16
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    if ($s -eq 256) { $sz = [byte]0 } else { $sz = [byte]$s }
    $len = [int]$pngStreams[$i].Length
    $writer.Write($sz); $writer.Write($sz)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$len); $writer.Write([uint32]$offset)
    $offset += $len
}
foreach ($ps in $pngStreams) { $writer.Write($ps.ToArray()); $ps.Dispose() }
$orig.Dispose()
[System.IO.File]::WriteAllBytes($dst, $ms.ToArray())
$writer.Dispose()
Write-Host "OK: $dst"
