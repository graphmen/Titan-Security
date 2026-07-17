# Rasterize app-icon.svg to PNG favicons using PowerShell + System.Drawing (no npm deps).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot ".."
$public = Join-Path $root "public"
$app = Join-Path $root "app"
$icons = Join-Path $public "icons"
$svgPath = Join-Path $public "app-icon.svg"
if (-not (Test-Path $icons)) { New-Item -ItemType Directory -Path $icons | Out-Null }

$TitanDark = [System.Drawing.Color]::FromArgb(255, 27, 67, 50)
$TitanMid = [System.Drawing.Color]::FromArgb(255, 82, 183, 136)
$TitanDeep = [System.Drawing.Color]::FromArgb(255, 11, 40, 24)

function New-ShieldBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  $radius = [int]($size * 0.22)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $path.AddArc($rect.X, $rect.Y, $radius * 2, $radius * 2, 180, 90)
  $path.AddArc($rect.Right - $radius * 2, $rect.Y, $radius * 2, $radius * 2, 270, 90)
  $path.AddArc($rect.Right - $radius * 2, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect, $TitanDeep, $TitanDark, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $g.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()

  $s = $size / 512.0
  function To-Point([double]$x, [double]$y) {
    return New-Object System.Drawing.Point([int]($x * $s), [int]($y * $s))
  }

  $outer = @(
    (To-Point 256 96), (To-Point 368 144), (To-Point 368 272), (To-Point 256 368), (To-Point 144 272), (To-Point 144 144)
  )
  $g.FillPolygon([System.Drawing.Brushes]::White, $outer)

  $mid = @(
    (To-Point 256 128), (To-Point 336 160), (To-Point 336 256), (To-Point 256 320), (To-Point 176 256), (To-Point 176 160)
  )
  $g.FillPolygon((New-Object System.Drawing.SolidBrush $TitanMid), $mid)

  $inner = @(
    (To-Point 256 176), (To-Point 296 192), (To-Point 296 256), (To-Point 256 280), (To-Point 216 256), (To-Point 216 192)
  )
  $g.FillPolygon((New-Object System.Drawing.SolidBrush $TitanDark), $inner)

  $g.Dispose()
  return $bmp
}

function Save-Shield([int]$size, [string]$dest) {
  $bmp = New-ShieldBitmap $size
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $dest ($size px)"
}

Save-Shield 32 (Join-Path $public "favicon-32.png")
Save-Shield 48 (Join-Path $public "favicon-48.png")
Save-Shield 48 (Join-Path $app "icon.png")
Save-Shield 180 (Join-Path $app "apple-icon.png")
Save-Shield 180 (Join-Path $public "apple-icon.png")
Save-Shield 192 (Join-Path $icons "icon-192.png")
Save-Shield 512 (Join-Path $icons "icon-512.png")

$icoBmp = New-ShieldBitmap 32
$iconHandle = $icoBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$fs = [System.IO.File]::Open((Join-Path $app "favicon.ico"), [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$icoBmp.Dispose()
Write-Host "Wrote app/favicon.ico"
Write-Host "Titan shield PNG icons ready." -ForegroundColor Green
