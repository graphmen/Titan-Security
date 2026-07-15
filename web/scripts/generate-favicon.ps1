# Next.js app icons + favicon.ico from Titan emblem-light.jpg
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$public = Join-Path $PSScriptRoot "..\public"
$app = Join-Path $PSScriptRoot "..\app"
$srcPath = Join-Path $public "emblem-light.jpg"

function New-EmblemBitmap([int]$size, [string]$bgHex = "#F4FAF6") {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml($bgHex))
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

$icon32 = New-EmblemBitmap 32
$icon32.Save((Join-Path $app "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$icon32.Dispose()
Write-Host "Wrote app/icon.png (32px)"

$apple = New-EmblemBitmap 180
$apple.Save((Join-Path $app "apple-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$apple.Dispose()
Write-Host "Wrote app/apple-icon.png (180px)"

$faviconBmp = New-EmblemBitmap 32
$iconHandle = $faviconBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$fs = [System.IO.File]::Open((Join-Path $app "favicon.ico"), [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$faviconBmp.Dispose()
Write-Host "Wrote app/favicon.ico"

# Browser copy in public (32px PNG — some hosts serve /favicon.ico from app/)
$pub32 = New-EmblemBitmap 32
$pub32.Save((Join-Path $public "favicon-32.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$pub32.Dispose()
Write-Host "Wrote public/favicon-32.png"
Write-Host "Titan favicons ready." -ForegroundColor Green
