# Next.js app icons + favicon from Titan PWA icon-192 (dark green, high contrast).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$public = Join-Path $PSScriptRoot "..\public"
$app = Join-Path $PSScriptRoot "..\app"
$icon192Path = Join-Path $public "icons\icon-192.png"

if (-not (Test-Path $icon192Path)) {
  Write-Host "icon-192.png missing - run generate-pwa-icons.ps1 first" -ForegroundColor Yellow
  & (Join-Path $PSScriptRoot "generate-pwa-icons.ps1")
}

function Save-Resized([string]$srcPath, [int]$size, [string]$destPath) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } finally {
    $src.Dispose()
  }
}

# Next.js app/ metadata icons - scale from 192px master for crisp small sizes
Save-Resized $icon192Path 48 (Join-Path $app "icon.png")
Save-Resized $icon192Path 180 (Join-Path $app "apple-icon.png")
Save-Resized $icon192Path 32 (Join-Path $public "favicon-32.png")
Save-Resized $icon192Path 180 (Join-Path $public "apple-icon.png")
Write-Host "Wrote app/icon.png (48px), app/apple-icon.png, public favicons"

# favicon.ico - build from 32px PNG (GetHicon on tiny crop was producing blank icons)
$ico32Path = Join-Path $env:TEMP "titan-favicon-32.png"
Save-Resized $icon192Path 32 $ico32Path
$bmp = [System.Drawing.Bitmap]::FromFile($ico32Path)
try {
  $iconHandle = $bmp.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
  $icoPath = Join-Path $app "favicon.ico"
  $fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
  $icon.Save($fs)
  $fs.Close()
  $icon.Dispose()
  Write-Host "Wrote app/favicon.ico ($((Get-Item $icoPath).Length) bytes)"
} finally {
  $bmp.Dispose()
  Remove-Item $ico32Path -ErrorAction SilentlyContinue
}

Write-Host "Titan favicons ready." -ForegroundColor Green
