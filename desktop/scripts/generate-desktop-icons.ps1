# Titan Protection desktop icons from the institution emblem (emblem-light.jpg).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$srcPath = Join-Path $repoRoot "web\public\emblem-light.jpg"
$assetsDir = Join-Path $repoRoot "desktop\assets"
$iconPng = Join-Path $assetsDir "icon.png"
$iconIco = Join-Path $assetsDir "icon.ico"

if (-not (Test-Path $srcPath)) {
  throw "Emblem source not found: $srcPath"
}
if (-not (Test-Path $assetsDir)) {
  New-Item -ItemType Directory -Path $assetsDir | Out-Null
}

$TitanBg = [System.Drawing.Color]::FromArgb(255, 27, 67, 50)

function New-EmblemBitmap([int]$size) {
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

function Save-IcoFromBitmaps([System.Drawing.Bitmap[]]$bitmaps, [string]$path) {
  $ms = New-Object System.IO.MemoryStream
  try {
    $writer = New-Object System.IO.BinaryWriter $ms
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$bitmaps.Count)

    $offset = 6 + (16 * $bitmaps.Count)
    foreach ($bmp in $bitmaps) {
      $pngMs = New-Object System.IO.MemoryStream
      $bmp.Save($pngMs, [System.Drawing.Imaging.ImageFormat]::Png)
      $pngBytes = $pngMs.ToArray()
      $pngMs.Dispose()

      $width = if ($bmp.Width -ge 256) { 0 } else { [byte]$bmp.Width }
      $height = if ($bmp.Height -ge 256) { 0 } else { [byte]$bmp.Height }
      $writer.Write($width)
      $writer.Write($height)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$pngBytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $pngBytes.Length
    }

    foreach ($bmp in $bitmaps) {
      $pngMs = New-Object System.IO.MemoryStream
      $bmp.Save($pngMs, [System.Drawing.Imaging.ImageFormat]::Png)
      $writer.Write($pngMs.ToArray())
      $pngMs.Dispose()
    }

    [System.IO.File]::WriteAllBytes($path, $ms.ToArray())
  } finally {
    $ms.Dispose()
  }
}

$png512 = New-EmblemBitmap 512
$png512.Save($iconPng, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Wrote $iconPng"

$icoSizes = @(16, 32, 48, 64, 128, 256)
$icoBitmaps = @()
foreach ($size in $icoSizes) {
  $icoBitmaps += New-EmblemBitmap $size
}
Save-IcoFromBitmaps $icoBitmaps $iconIco
foreach ($bmp in $icoBitmaps) { $bmp.Dispose() }
$png512.Dispose()

Write-Host "Wrote $iconIco" -ForegroundColor Green
