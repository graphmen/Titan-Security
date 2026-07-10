# Repack existing debug APK with fresh Capacitor web assets (avoids Gradle SSL on corporate networks).
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$srcApk = Join-Path $root "app\build\outputs\apk\debug\security.apk"
$assetsSrc = Join-Path $root "app\src\main\assets\public"
$outApk = Join-Path $root "app\build\outputs\apk\debug\app-debug.apk"
$work = Join-Path $env:TEMP "titan-apk-repack"
$keystore = Join-Path $env:USERPROFILE ".android\debug.keystore"

if (-not (Test-Path $srcApk)) {
  throw "Base APK not found: $srcApk. Build once in Android Studio first."
}
if (-not (Test-Path $assetsSrc)) {
  throw "Web assets not found. Run: cd mobile; npm run cap:sync"
}
if (-not (Test-Path $keystore)) {
  throw "Debug keystore not found at $keystore"
}

if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null

$zipCopy = Join-Path $work "unsigned.zip"
Copy-Item $srcApk $zipCopy
Expand-Archive -Path $zipCopy -DestinationPath (Join-Path $work "apk") -Force

$destAssets = Join-Path $work "apk\assets\public"
if (Test-Path $destAssets) { Remove-Item $destAssets -Recurse -Force }
Copy-Item $assetsSrc $destAssets -Recurse -Force

$unsignedZip = Join-Path $work "repacked-unsigned.zip"
if (Test-Path $unsignedZip) { Remove-Item $unsignedZip -Force }
Compress-Archive -Path (Join-Path $work "apk\*") -DestinationPath $unsignedZip -Force
Move-Item $unsignedZip $outApk -Force

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$apksigner = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools"
$signer = Get-ChildItem $apksigner -Recurse -Filter "apksigner.bat" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signer) {
  Write-Host "apksigner not found - APK copied unsigned to $outApk" -ForegroundColor Yellow
  exit 0
}

& $signer.FullName sign --ks $keystore --ks-pass pass:android --key-pass pass:android --out (Join-Path $work "signed.apk") $outApk
Move-Item (Join-Path $work "signed.apk") $outApk -Force
Remove-Item $work -Recurse -Force

$size = [math]::Round((Get-Item $outApk).Length / 1MB, 2)
Write-Host ("APK ready: " + $outApk + " (" + $size + " MB)") -ForegroundColor Green
