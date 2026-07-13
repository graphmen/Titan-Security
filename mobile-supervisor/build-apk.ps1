# Titan Supervisor - build APK
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Building supervisor web assets (v1.0.0)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Generating launcher icons..." -ForegroundColor Cyan
npm run icons:android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Syncing into Android project..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$androidDir = Join-Path $PSScriptRoot "android"
$apkOut = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
$repackScript = Join-Path $androidDir "repack-apk.ps1"

Write-Host "Building debug APK..." -ForegroundColor Cyan
Push-Location $androidDir
try {
  $ErrorActionPreference = "Continue"
  cmd /c ".\gradlew.bat assembleDebug --no-daemon"
  $gradleExit = $LASTEXITCODE
  if ($gradleExit -eq 0 -and (Test-Path $apkOut)) {
    $size = [math]::Round((Get-Item $apkOut).Length / 1MB, 2)
    Write-Host "APK ready: $apkOut ($size MB)" -ForegroundColor Green
  } elseif (Test-Path $repackScript) {
    Write-Host "Gradle unavailable - using repack..." -ForegroundColor Yellow
    & $repackScript
  }
  $ErrorActionPreference = "Stop"
} finally {
  Pop-Location
}

$distApk = Join-Path $PSScriptRoot "TitanSupervisor-v1.0.0.apk"
if (Test-Path $apkOut) {
  Copy-Item $apkOut $distApk -Force
  Write-Host "Copy to phone: $distApk" -ForegroundColor Green
}
