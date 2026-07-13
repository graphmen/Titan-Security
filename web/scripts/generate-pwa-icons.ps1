# PWA icons for web/public/icons
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

function New-TitanIcon([int]$size) {
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
  $g.FillPolygon([System.Drawing.Brushes]::White, $outer)
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 82, 183, 136))), @(
    [System.Drawing.PointF]::new($cx, $size * 0.25),
    [System.Drawing.PointF]::new($size * 0.66, $size * 0.31),
    [System.Drawing.PointF]::new($size * 0.66, $size * 0.47),
    [System.Drawing.PointF]::new($cx, $size * 0.67),
    [System.Drawing.PointF]::new($size * 0.34, $size * 0.47),
    [System.Drawing.PointF]::new($size * 0.34, $size * 0.31)
  ))
  $g.Dispose()
  return $bmp
}

foreach ($pair in @(@(192, 'icon-192.png'), @(512, 'icon-512.png'))) {
  $bmp = New-TitanIcon $pair[0]
  $bmp.Save((Join-Path $out $pair[1]), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $($pair[1])"
}
