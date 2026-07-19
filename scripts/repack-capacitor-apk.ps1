# Safe Capacitor APK repack: manifest permissions + web assets + Titan launcher icons.
# Uses apktool -s (resources only) so original DEX/native libraries stay intact.
param(
  [Parameter(Mandatory = $true)][string]$BaseApk,
  [Parameter(Mandatory = $true)][string]$AssetsSrc,
  [Parameter(Mandatory = $true)][string]$ManifestSrc,
  [Parameter(Mandatory = $true)][string]$ResRoot,
  [Parameter(Mandatory = $true)][string]$OutApk,
  [Parameter(Mandatory = $true)][string]$DistApk
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ApktoolJar = Join-Path $PSScriptRoot "apktool.jar"
$Java = "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"
if (-not (Test-Path $Java)) { $Java = "java" }
$Keystore = Join-Path $env:USERPROFILE ".android\debug.keystore"

function Get-BuildTool($name) {
  $root = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools"
  if (-not (Test-Path $root)) { return $null }
  Get-ChildItem $root -Recurse -Filter $name -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
}

function Get-Aapt {
  Get-BuildTool "aapt.exe"
}

function Test-ApkHasPermissions($apk, [string[]]$required) {
  $aapt = Get-Aapt
  if (-not $aapt) { return $false }
  $dump = (& $aapt.FullName dump permissions $apk 2>$null | Out-String)
  foreach ($perm in $required) {
    if ($dump -notmatch [regex]::Escape($perm)) { return $false }
  }
  return $true
}

function Update-DecodedManifest($manifestPath, $manifestSourcePath) {
  [xml]$xml = Get-Content $manifestPath -Raw
  $existing = @{}
  foreach ($node in $xml.manifest.SelectNodes("uses-permission")) {
    $name = $node.GetAttribute("name", "http://schemas.android.com/apk/res/android")
    if ($name) { $existing[$name] = $true }
  }

  $sourceText = Get-Content $manifestSourcePath -Raw
  foreach ($m in [regex]::Matches($sourceText, 'uses-permission\s+android:name="([^"]+)"')) {
    $permName = $m.Groups[1].Value
    if ($existing.ContainsKey($permName)) { continue }
    $el = $xml.CreateElement("uses-permission")
    $el.SetAttribute("name", "http://schemas.android.com/apk/res/android", $permName)
    $xml.manifest.InsertBefore($el, $xml.manifest.application) | Out-Null
    Write-Host "  + permission $permName" -ForegroundColor Green
  }

  foreach ($m in [regex]::Matches($sourceText, 'uses-feature\s+android:name="([^"]+)"[^/]*')) {
    $featName = $m.Groups[1].Value
    if ($xml.manifest.OuterXml -match [regex]::Escape($featName)) { continue }
    $el = $xml.CreateElement("uses-feature")
    $el.SetAttribute("name", "http://schemas.android.com/apk/res/android", $featName)
    if ($sourceText -match "uses-feature\s+android:name=`"$([regex]::Escape($featName))`"[^>]*android:required=`"false`"") {
      $el.SetAttribute("required", "http://schemas.android.com/apk/res/android", "false")
    }
    $xml.manifest.InsertBefore($el, $xml.manifest.application) | Out-Null
    Write-Host "  + feature $featName" -ForegroundColor Green
  }

  $xml.Save($manifestPath)
}

function Sync-ResFolder($srcRoot, $destRoot, $relativePath) {
  $src = Join-Path $srcRoot $relativePath
  if (-not (Test-Path $src)) { return }
  $dest = Join-Path $destRoot $relativePath
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Copy-Item $src $dest -Recurse -Force
  Write-Host "  + res/$relativePath" -ForegroundColor DarkGray
}

if (-not (Test-Path $BaseApk)) { throw "Base APK not found: $BaseApk" }
if (-not (Test-Path $AssetsSrc)) { throw "Web assets not found: $AssetsSrc" }
if (-not (Test-Path $ManifestSrc)) { throw "Manifest not found: $ManifestSrc" }
if (-not (Test-Path $Keystore)) { throw "Debug keystore not found: $Keystore" }
if (-not (Test-Path $ApktoolJar)) {
  Write-Host "Downloading apktool..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar" -OutFile $ApktoolJar -UseBasicParsing
}

$RequiredPerms = @(
  "android.permission.CAMERA",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION"
)

$work = Join-Path $env:TEMP "titan-safe-repack-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$decoded = Join-Path $work "decoded"
$unsignedApk = Join-Path $work "unsigned.apk"
New-Item -ItemType Directory -Force -Path $work | Out-Null

try {
  Write-Host "Decoding APK (resources only, keeping native code)..." -ForegroundColor Cyan
  & $Java -jar $ApktoolJar d $BaseApk -o $decoded -s -f | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "apktool decode failed" }

  Write-Host "Patching AndroidManifest..." -ForegroundColor Cyan
  Update-DecodedManifest (Join-Path $decoded "AndroidManifest.xml") $ManifestSrc

  Write-Host "Syncing web assets..." -ForegroundColor Cyan
  $assetsDest = Join-Path $decoded "assets\public"
  if (Test-Path $assetsDest) { Remove-Item $assetsDest -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $assetsDest | Out-Null
  Copy-Item (Join-Path $AssetsSrc "*") $assetsDest -Recurse -Force

  Write-Host "Injecting Titan launcher icons..." -ForegroundColor Cyan
  $decodedRes = Join-Path $decoded "res"
  foreach ($folder in @("mipmap-mdpi","mipmap-hdpi","mipmap-xhdpi","mipmap-xxhdpi","mipmap-xxxhdpi","mipmap-anydpi-v26")) {
    Sync-ResFolder $ResRoot $decodedRes $folder
  }
  foreach ($folder in @("drawable","drawable-v24")) {
    $src = Join-Path $ResRoot $folder
    if (-not (Test-Path $src)) { continue }
    $dest = Join-Path $decodedRes $folder
    if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
    Get-ChildItem $src -Filter "ic_launcher*" | ForEach-Object {
      Copy-Item $_.FullName (Join-Path $dest $_.Name) -Force
      Write-Host "  + res/$folder/$($_.Name)" -ForegroundColor DarkGray
    }
  }

  Write-Host "Building APK..." -ForegroundColor Cyan
  & $Java -jar $ApktoolJar b $decoded -o $unsignedApk | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "apktool build failed" }

  if (-not (Test-ApkHasPermissions $unsignedApk $RequiredPerms)) {
    throw "Built APK missing required permissions"
  }

  $zipalign = Get-BuildTool "zipalign.exe"
  $alignedApk = Join-Path $work "aligned.apk"
  $signInput = $unsignedApk
  if ($zipalign) {
    Write-Host "Running zipalign..." -ForegroundColor Cyan
    & $zipalign.FullName -f -p 4 $unsignedApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }
    $signInput = $alignedApk
  }

  $apksigner = Get-BuildTool "apksigner.bat"
  if (-not $apksigner) { throw "apksigner not found" }

  Write-Host "Signing APK..." -ForegroundColor Cyan
  $signedApk = Join-Path $work "signed.apk"
  & $apksigner.FullName sign --ks $Keystore --ks-pass pass:android --key-pass pass:android --out $signedApk $signInput
  if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed" }

  & $apksigner.FullName verify --verbose $signedApk | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "APK verification failed" }

  New-Item -ItemType Directory -Force -Path (Split-Path $OutApk) | Out-Null
  Copy-Item $signedApk $OutApk -Force
  Copy-Item $signedApk $DistApk -Force
  Copy-Item $signedApk $BaseApk -Force

  $assetCount = (Get-ChildItem $AssetsSrc -Recurse -File | Measure-Object).Count
  $size = [math]::Round((Get-Item $OutApk).Length / 1MB, 2)
  Write-Host ""
  Write-Host "APK ready: $OutApk ($size MB, $assetCount web assets)" -ForegroundColor Green
  Write-Host "Copy to phone: $DistApk" -ForegroundColor Green
}
finally {
  Start-Sleep -Milliseconds 200
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
