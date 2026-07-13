# Android launcher icons from the Titan Protection institution emblem.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root "public\emblem-light.jpg"
$resRoot = Join-Path $root "android\app\src\main\res"

$sizes = @{
  "mipmap-mdpi"    = 48
  "mipmap-hdpi"    = 72
  "mipmap-xhdpi"   = 96
  "mipmap-xxhdpi"  = 144
  "mipmap-xxxhdpi" = 192
}

function New-EmblemLauncherIcon([int]$size) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(255, 27, 67, 50))

    $cropSize = [int][Math]::Min($src.Width * 0.34, $src.Height)
    $srcRect = New-Object System.Drawing.Rectangle 0, 0, $cropSize, $cropSize
    $pad = [int]($size * 0.14)
    $dest = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
    $g.DrawImage($src, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
  } finally {
    $src.Dispose()
  }
}

foreach ($folder in $sizes.Keys) {
  $size = $sizes[$folder]
  $dir = Join-Path $resRoot $folder
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $bmp = New-EmblemLauncherIcon $size
  $launcher = Join-Path $dir "ic_launcher.png"
  $round = Join-Path $dir "ic_launcher_round.png"
  $bmp.Save($launcher, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Save($round, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $folder (${size}px) from emblem-light.jpg"
}

Write-Host "Titan institution launcher icons ready." -ForegroundColor Green
