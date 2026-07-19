# Repack existing debug APK with fresh Capacitor web assets (avoids Gradle SSL on corporate networks).
# Uses ZipArchive UPDATE mode so resources.arsc stays uncompressed and paths stay valid.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$srcApk = Join-Path $root "app\build\outputs\apk\debug\security.apk"
$assetsSrc = Join-Path $root "app\src\main\assets\public"
$outApk = Join-Path $root "app\build\outputs\apk\debug\app-debug.apk"
$work = Join-Path $env:TEMP "titan-apk-repack"
$keystore = Join-Path $env:USERPROFILE ".android\debug.keystore"

if (-not (Test-Path $srcApk)) {
  throw "Base APK not found: $srcApk. Build once in Android Studio (Build -> Build APK) to create security.apk."
}
if (-not (Test-Path $assetsSrc)) {
  throw "Web assets not found. Run: cd mobile; npm run cap:sync"
}
if (-not (Test-Path $keystore)) {
  throw "Debug keystore not found at $keystore"
}

function Get-BuildTool($name) {
  $root = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools"
  if (-not (Test-Path $root)) { return $null }
  Get-ChildItem $root -Recurse -Filter $name -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null

$unsignedApk = Join-Path $work "unsigned.apk"
Copy-Item $srcApk $unsignedApk -Force

Write-Host "Updating web assets in APK (preserving Android package structure)..." -ForegroundColor Cyan

$zip = [System.IO.Compression.ZipFile]::Open($unsignedApk, [System.IO.Compression.ZipArchiveMode]::Update)
$toRemove = @()
foreach ($entry in $zip.Entries) {
  $path = $entry.FullName.Replace('\', '/')
  if ($path -like 'META-INF/*' -or $path -like 'assets/public/*' -or $path -eq 'assets/public') {
    $toRemove += $entry
  }
}
foreach ($entry in $toRemove) {
  $entry.Delete()
}

Get-ChildItem $assetsSrc -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($assetsSrc.Length).TrimStart('\', '/')
  $entryName = ('assets/public/' + ($relative -replace '\\', '/'))
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
    $zip,
    $_.FullName,
    $entryName,
    [System.IO.Compression.CompressionLevel]::Optimal
  ) | Out-Null
}
$zip.Dispose()

$arsc = ([System.IO.Compression.ZipFile]::OpenRead($unsignedApk).Entries |
  Where-Object { $_.FullName.Replace('\', '/') -eq 'resources.arsc' } |
  Select-Object -First 1)
if (-not $arsc -or $arsc.CompressedLength -ne $arsc.Length) {
  throw "APK structure invalid - resources.arsc must remain uncompressed. Use Android Studio to rebuild security.apk."
}

$zipalign = Get-BuildTool "zipalign.exe"
$alignedApk = Join-Path $work "aligned.apk"
$signInput = $unsignedApk
if ($zipalign) {
  Write-Host "Running zipalign..." -ForegroundColor Cyan
  if (Test-Path $alignedApk) { Remove-Item $alignedApk -Force }
  & $zipalign.FullName -f -p 4 $unsignedApk $alignedApk
  if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }
  $signInput = $alignedApk
} else {
  Write-Host "zipalign not found - continuing without alignment" -ForegroundColor Yellow
}

$apksigner = Get-BuildTool "apksigner.bat"
if (-not $apksigner) {
  throw "apksigner not found. Install Android SDK Build-Tools in Android Studio."
}

Write-Host "Signing APK..." -ForegroundColor Cyan
$signedApk = Join-Path $work "signed.apk"
& $apksigner.FullName sign --ks $keystore --ks-pass pass:android --key-pass pass:android --out $signedApk $signInput
if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed" }

& $apksigner.FullName verify --verbose $signedApk | Out-Host
if ($LASTEXITCODE -ne 0) { throw "APK verification failed after signing" }

New-Item -ItemType Directory -Force -Path (Split-Path $outApk) | Out-Null
Copy-Item $signedApk $outApk -Force

$distApk = Join-Path (Split-Path $root -Parent) "TitanMonitor-v1.0.13.apk"
Copy-Item $outApk $distApk -Force

try {
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
  Start-Sleep -Milliseconds 300
  if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
} catch { }

$assetCount = ([System.IO.Compression.ZipFile]::OpenRead($outApk).Entries |
  Where-Object { $_.FullName.Replace('\', '/') -like 'assets/public/*' } |
  Measure-Object).Count

$size = [math]::Round((Get-Item $outApk).Length / 1MB, 2)
Write-Host ""
Write-Host "APK ready: $outApk ($size MB, $assetCount web assets)" -ForegroundColor Green
Write-Host "Copy to phone: $distApk" -ForegroundColor Green
