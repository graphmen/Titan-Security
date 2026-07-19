# Repack existing debug APK with fresh web assets, permissions, and Titan icons.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$repoRoot = Split-Path (Split-Path $root -Parent) -Parent
$srcApk = Join-Path $root "app\build\outputs\apk\debug\security.apk"
$assetsSrc = Join-Path $root "app\src\main\assets\public"
$outApk = Join-Path $root "app\build\outputs\apk\debug\app-debug.apk"
$manifestSrc = Join-Path $root "app\src\main\AndroidManifest.xml"
$resRoot = Join-Path $root "app\src\main\res"
$repackScript = Join-Path $repoRoot "scripts\repack-capacitor-apk.ps1"

# Restore a known-good base if the current one was corrupted by full apktool rebuild.
$fallbackBase = Join-Path (Split-Path $root -Parent) "TitanMonitor-v1.0.13.apk"
if ((Test-Path $fallbackBase) -and (Test-Path $srcApk)) {
  $curLen = (Get-Item $srcApk).Length
  if ($curLen -lt 4200000) {
    Write-Host "Restoring security.apk from TitanMonitor-v1.0.13.apk (safe base)..." -ForegroundColor Yellow
    Copy-Item $fallbackBase $srcApk -Force
  }
}

if (-not (Test-Path $srcApk)) {
  if (Test-Path $fallbackBase) {
    Copy-Item $fallbackBase $srcApk -Force
  } else {
    throw "Base APK not found: $srcApk. Build once in Android Studio to create security.apk."
  }
}

if (-not (Test-Path $assetsSrc)) {
  throw "Web assets not found. Run: cd mobile; npm run cap:sync"
}

$pkg = Get-Content (Join-Path (Split-Path $root -Parent) "package.json") -Raw | ConvertFrom-Json
$distApk = Join-Path (Split-Path $root -Parent) "TitanMonitor-v$($pkg.version).apk"

& $repackScript `
  -BaseApk $srcApk `
  -AssetsSrc $assetsSrc `
  -ManifestSrc $manifestSrc `
  -ResRoot $resRoot `
  -OutApk $outApk `
  -DistApk $distApk
