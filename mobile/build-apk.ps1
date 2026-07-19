# Titan Monitor - sync web assets and build APK.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Building mobile web assets..." -ForegroundColor Cyan
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
  $ErrorActionPreference = "Continue"
  Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue
  if (Test-Path $sslScript) { . $sslScript }
  cmd /c ".\gradlew.bat assembleDebug --no-daemon"
  $gradleExit = $LASTEXITCODE
  $Error.Clear()

  if ($gradleExit -eq 0 -and (Test-Path $apkOut)) {
    $size = [math]::Round((Get-Item $apkOut).Length / 1MB, 2)
    $baseApk = Join-Path $androidDir "app\build\outputs\apk\debug\security.apk"
    Copy-Item $apkOut $baseApk -Force
    Write-Host ""
    Write-Host "APK ready (Gradle): $apkOut ($size MB)" -ForegroundColor Green
    Write-Host "Base APK updated for repacks: $baseApk" -ForegroundColor DarkGray
  } elseif (Test-Path $repackScript) {
    Write-Host "Gradle unavailable - using repack-apk.ps1..." -ForegroundColor Yellow
    & $repackScript
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } else {
    throw "Could not build APK."
  }
  $ErrorActionPreference = "Stop"
} finally {
  Pop-Location
}

$publishScript = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\publish-mobile-apks.ps1"
if (Test-Path $publishScript) {
  Write-Host "Publishing APK to web downloads..." -ForegroundColor Cyan
  & $publishScript -MonitorApk $apkOut
}

Write-Host ""
Write-Host "Install on phone:" -ForegroundColor Yellow
Write-Host "  1. Copy app-debug.apk to your phone and install"
Write-Host "  2. Default server: https://titan-security.vercel.app"
Write-Host "  3. Register a guard on the web dashboard with YOUR email"
Write-Host "  4. Check email for 6-digit PIN, then enter in Titan Monitor app"
Write-Host ""
Write-Host "LAN testing (office Wi-Fi):" -ForegroundColor Yellow
Write-Host "  Start web: cd web; npm run start:prod"
Write-Host '  In app: Server connection, then http://YOUR_PC_IP:3001, then Link'
Write-Host ""

$studio = "C:\Program Files\Android\Android Studio\bin\studio64.exe"
if (Test-Path $studio) {
  Write-Host "Android Studio project: $androidDir" -ForegroundColor DarkGray
}
