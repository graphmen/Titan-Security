# Titan Monitor — sync web assets and build APK.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Building mobile web assets (v1.0.4)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Generating Titan emblem launcher icons..." -ForegroundColor Cyan
npm run icons:android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Syncing into Android project..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$androidDir = Join-Path $PSScriptRoot "android"
$apkOut = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
$repackScript = Join-Path $androidDir "repack-apk.ps1"
$sslScript = Join-Path $androidDir "setup-gradle-ssl.ps1"

Write-Host "Building debug APK..." -ForegroundColor Cyan
Push-Location $androidDir
try {
  if (Test-Path $sslScript) { . $sslScript }
  & .\gradlew.bat assembleDebug --no-daemon 2>&1 | Out-Host
  if ($LASTEXITCODE -eq 0 -and (Test-Path $apkOut)) {
    $size = [math]::Round((Get-Item $apkOut).Length / 1MB, 2)
    Write-Host ""
    Write-Host "APK ready (Gradle): $apkOut ($size MB)" -ForegroundColor Green
  } elseif (Test-Path $repackScript) {
    Write-Host "Gradle unavailable — using fixed repack-apk.ps1..." -ForegroundColor Yellow
    & $repackScript
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } else {
    throw "Could not build APK."
  }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Install on phone:" -ForegroundColor Yellow
Write-Host "  1. Copy app-debug.apk to your phone and install"
Write-Host "  2. Default server: https://titan-security.vercel.app (works on mobile data)"
Write-Host "  3. Register a guard on the web dashboard with YOUR email"
Write-Host "  4. Check email for 6-digit PIN -> enter in Titan Monitor app"
Write-Host ""
Write-Host "LAN testing (office Wi-Fi):" -ForegroundColor Yellow
Write-Host "  Start web: cd web; npm run start:prod"
Write-Host "  In app -> Server connection -> http://YOUR_PC_IP:3001 -> Link"
Write-Host ""

$studio = "C:\Program Files\Android\Android Studio\bin\studio64.exe"
if (Test-Path $studio) {
  Write-Host "Android Studio project: $androidDir" -ForegroundColor DarkGray
}
