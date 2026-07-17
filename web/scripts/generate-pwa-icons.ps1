# PWA icons from the Titan Protection institution emblem (hexagon TP mark).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$public = Join-Path $PSScriptRoot "..\public"
$srcPath = Join-Path $public "emblem-light.jpg"
$out = Join-Path $public "icons"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

# Dark Titan green — visible on white browser tabs (light bg made favicon look blank).
$TitanBg = [System.Drawing.Color]::FromArgb(255, 27, 67, 50)

function New-EmblemIcon([int]$size) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($TitanBg)

    $cropSize = [int][Math]::Min($src.Width * 0.34, $src.Height)
    $srcRect = New-Object System.Drawing.Rectangle 0, 0, $cropSize, $cropSize
    $pad = [int]($size * 0.08)
    $dest = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
    $g.DrawImage($src, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
  } finally {
    $src.Dispose()
  }
}

function Save-ResizedIcon([System.Drawing.Image]$src, [int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

foreach ($pair in @(@(192, 'icon-192.png'), @(512, 'icon-512.png'))) {
  $bmp = New-EmblemIcon $pair[0]
  $bmp.Save((Join-Path $out $pair[1]), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $($pair[1])"
}

$icon192 = [System.Drawing.Image]::FromFile((Join-Path $out "icon-192.png"))
try {
  Save-ResizedIcon $icon192 48 (Join-Path $public "favicon-48.png")
  Save-ResizedIcon $icon192 32 (Join-Path $public "favicon-32.png")
  Write-Host "Wrote favicon-32.png and favicon-48.png"
} finally {
  $icon192.Dispose()
}

Write-Host "PWA icons ready." -ForegroundColor Green
