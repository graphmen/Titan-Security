# Build Titan Protection Windows desktop client (Electron NSIS installer only)
param(
  [switch]$SkipBuild
)

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

  Write-Host "Generating Titan emblem desktop icons..." -ForegroundColor Cyan
  npm run icons

  if (-not $SkipBuild) {
    Write-Host "Building Windows NSIS installer..." -ForegroundColor Cyan
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "electron-builder failed with exit code $LASTEXITCODE" }
  } else {
    Write-Host "Skipping build (-SkipBuild). Publishing existing artifacts..." -ForegroundColor Yellow
  }

  if (-not (Test-Path $downloadsDir)) {
    New-Item -ItemType Directory -Path $downloadsDir | Out-Null
  }

  $artifactDirs = @(
    (Join-Path $desktopDir "release"),
    (Join-Path $desktopDir "dist")
  )

  $setup = $null
  foreach ($dir in $artifactDirs) {
    if (-not (Test-Path $dir)) { continue }
    if (-not $setup) {
      $setup = Get-ChildItem -Path $dir -Filter "TitanProtection-*-Setup.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
  }

  if ($setup) {
    Copy-Item $setup.FullName (Join-Path $downloadsDir "titan-protection-desktop-setup.exe") -Force
    $sizeMb = [math]::Round($setup.Length / 1MB, 2)
    Write-Host "Published installer -> web/public/downloads/titan-protection-desktop-setup.exe ($sizeMb MB)" -ForegroundColor Green
  } else {
    Write-Warning "Setup installer not found - build may have failed."
  }

  $legacyPortable = Join-Path $downloadsDir "titan-protection-desktop.exe"
  if (Test-Path $legacyPortable) {
    Remove-Item $legacyPortable -Force
    Write-Host "Removed legacy portable download (setup-only distribution)." -ForegroundColor Yellow
  }

  Write-Host "Done. Artifacts in desktop/release/" -ForegroundColor Green
} finally {
  Pop-Location
}
