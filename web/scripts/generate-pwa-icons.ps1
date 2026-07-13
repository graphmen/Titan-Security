# PWA icons from the Titan Protection institution emblem (hexagon TP mark).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$public = Join-Path $PSScriptRoot "..\public"
$srcPath = Join-Path $public "emblem-light.jpg"
$out = Join-Path $public "icons"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

function New-EmblemIcon([int]$size) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(255, 244, 250, 246))

    # Crop the left emblem (hexagon TP) from the wordmark image.
    $cropSize = [int][Math]::Min($src.Width * 0.34, $src.Height)
    $srcRect = New-Object System.Drawing.Rectangle 0, 0, $cropSize, $cropSize
    $pad = [int]($size * 0.12)
    $dest = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
    $g.DrawImage($src, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
  } finally {
    $src.Dispose()
  }
}

foreach ($pair in @(@(192, 'icon-192.png'), @(512, 'icon-512.png'))) {
  $bmp = New-EmblemIcon $pair[0]
  $bmp.Save((Join-Path $out $pair[1]), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $($pair[1]) from emblem-light.jpg"
}
