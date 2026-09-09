# Build Titan Protection Windows desktop client (Electron)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$desktopDir = Join-Path $repoRoot "desktop"
$downloadsDir = Join-Path $repoRoot "web\public\downloads"

Push-Location $desktopDir
try {
  if (-not (Test-Path "node_modules")) {
    Write-Host "Installing desktop dependencies..." -ForegroundColor Cyan
    npm install
  }

  $existingPortable = Get-ChildItem -Path (Join-Path $desktopDir "dist") -Filter "TitanProtection-*-portable.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $existingPortable) {
    Write-Host "Building Windows desktop app..." -ForegroundColor Cyan
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    npm run build
  } else {
    Write-Host "Using existing build: $($existingPortable.Name)" -ForegroundColor Cyan
  }

  if (-not (Test-Path $downloadsDir)) {
    New-Item -ItemType Directory -Path $downloadsDir | Out-Null
  }

  $portable = Get-ChildItem -Path (Join-Path $desktopDir "dist") -Filter "TitanProtection-*-portable.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($portable) {
    Copy-Item $portable.FullName (Join-Path $downloadsDir "titan-protection-desktop.exe") -Force
    $sizeMb = [math]::Round($portable.Length / 1MB, 2)
    Write-Host "Published portable EXE -> web/public/downloads/titan-protection-desktop.exe ($sizeMb MB)" -ForegroundColor Green
  }

  $setup = Get-ChildItem -Path (Join-Path $desktopDir "dist") -Filter "TitanProtection-*-Setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($setup) {
    Copy-Item $setup.FullName (Join-Path $downloadsDir "titan-protection-desktop-setup.exe") -Force
    Write-Host "Published installer -> web/public/downloads/titan-protection-desktop-setup.exe" -ForegroundColor Green
  }

  Write-Host "Done. Artifacts in desktop/dist/" -ForegroundColor Green
} finally {
  Pop-Location
}
