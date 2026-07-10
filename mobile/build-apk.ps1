# Titan Monitor — sync web assets and open Android Studio to build the APK.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Building mobile web assets..." -ForegroundColor Cyan
npm run build

Write-Host "Syncing into Android project..." -ForegroundColor Cyan
npx cap sync android

$androidDir = Join-Path $PSScriptRoot "android"
$studio = "C:\Program Files\Android\Android Studio\bin\studio64.exe"

Write-Host ""
Write-Host "Android project is ready." -ForegroundColor Green
Write-Host "In Android Studio:" -ForegroundColor Yellow
Write-Host "  Build -> Build Bundle(s) / APK(s) -> Build APK(s)"
Write-Host ""
Write-Host "APK output:" -ForegroundColor Yellow
Write-Host "  android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host "  (or run android\repack-apk.ps1 after cap:sync if Gradle SSL fails)"
Write-Host ""
Write-Host "On your phone (same Wi-Fi as this PC):" -ForegroundColor Yellow
Write-Host "  1. Install the APK"
Write-Host "  2. Start web backend: cd web; npm run dev -- -p 3001 -H 0.0.0.0"
Write-Host "  3. In app -> Server Network Config -> http://YOUR_PC_IP:3001 -> Link"
Write-Host ""

if (Test-Path $studio) {
  Start-Process $studio -ArgumentList "`"$androidDir`""
} else {
  Write-Host "Open Android Studio manually and select: $androidDir" -ForegroundColor DarkYellow
}
