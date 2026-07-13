# Generate Android mipmap PNG launcher icons (Titan shield on green) — no npm deps required.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$resRoot = Join-Path $root "android\app\src\main\res"

$sizes = @{
  "mipmap-mdpi"    = 48
  "mipmap-hdpi"    = 72
  "mipmap-xhdpi"   = 96
  "mipmap-xxhdpi"  = 144
  "mipmap-xxxhdpi" = 192
}

function New-TitanLauncherIcon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 27, 67, 50))

  $cx = $size / 2.0
  $outer = @(
    [System.Drawing.PointF]::new($cx, $size * 0.19),
    [System.Drawing.PointF]::new($size * 0.72, $size * 0.28),
    [System.Drawing.PointF]::new($size * 0.72, $size * 0.53),
    [System.Drawing.PointF]::new($cx, $size * 0.81),
    [System.Drawing.PointF]::new($size * 0.28, $size * 0.53),
    [System.Drawing.PointF]::new($size * 0.28, $size * 0.28)
  )
  $mid = @(
    [System.Drawing.PointF]::new($cx, $size * 0.25),
    [System.Drawing.PointF]::new($size * 0.66, $size * 0.31),
    [System.Drawing.PointF]::new($size * 0.66, $size * 0.47),
    [System.Drawing.PointF]::new($cx, $size * 0.67),
    [System.Drawing.PointF]::new($size * 0.34, $size * 0.47),
    [System.Drawing.PointF]::new($size * 0.34, $size * 0.31)
  )
  $inner = @(
    [System.Drawing.PointF]::new($cx, $size * 0.34),
    [System.Drawing.PointF]::new($size * 0.58, $size * 0.38),
    [System.Drawing.PointF]::new($size * 0.58, $size * 0.47),
    [System.Drawing.PointF]::new($cx, $size * 0.56),
    [System.Drawing.PointF]::new($size * 0.42, $size * 0.47),
    [System.Drawing.PointF]::new($size * 0.42, $size * 0.38)
  )

  $g.FillPolygon([System.Drawing.Brushes]::White, $outer)
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 82, 183, 136))), $mid)
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 11, 40, 24))), $inner)

  $g.Dispose()
  return $bmp
}

foreach ($folder in $sizes.Keys) {
  $size = $sizes[$folder]
  $dir = Join-Path $resRoot $folder
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $bmp = New-TitanLauncherIcon $size
  $launcher = Join-Path $dir "ic_launcher.png"
  $round = Join-Path $dir "ic_launcher_round.png"
  $bmp.Save($launcher, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Save($round, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $folder (${size}px)"
}

Write-Host "Titan launcher icons ready." -ForegroundColor Green
