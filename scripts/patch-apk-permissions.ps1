# Ensure Titan APKs declare runtime permissions (camera, location, etc.) in AndroidManifest.
# Repacked base APKs were built before permissions were added — patch via apktool.
param(
  [Parameter(Mandatory = $true)][string]$ApkPath,
  [Parameter(Mandatory = $true)][string]$ManifestSourcePath
)

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path $Root)) { $Root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent }
$RepoRoot = if (Test-Path (Join-Path $PSScriptRoot "..\mobile")) { Split-Path $PSScriptRoot -Parent } else { Split-Path $PSScriptRoot -Parent }

$ApktoolJar = Join-Path $PSScriptRoot "apktool.jar"
$Java = "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"
if (-not (Test-Path $Java)) { $Java = "java" }

function Get-Aapt {
  $root = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools"
  if (-not (Test-Path $root)) { return $null }
  Get-ChildItem $root -Recurse -Filter "aapt.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
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

$RequiredPerms = @(
  "android.permission.CAMERA",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION"
)

if (-not (Test-Path $ApkPath)) {
  throw "APK not found: $ApkPath"
}

if (Test-ApkHasPermissions $ApkPath $RequiredPerms) {
  Write-Host "APK already declares camera + location permissions." -ForegroundColor DarkGray
  return $ApkPath
}

if (-not (Test-Path $ApktoolJar)) {
  Write-Host "Downloading apktool..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar" -OutFile $ApktoolJar -UseBasicParsing
}

Write-Host "Patching AndroidManifest permissions via apktool..." -ForegroundColor Cyan

$work = Join-Path $env:TEMP "titan-apk-patch-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$decoded = Join-Path $work "decoded"
$built = Join-Path $work "built.apk"
New-Item -ItemType Directory -Force -Path $work | Out-Null

try {
  & $Java -jar $ApktoolJar d $ApkPath -o $decoded -f | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "apktool decode failed" }

  $manifestPath = Join-Path $decoded "AndroidManifest.xml"
  [xml]$xml = Get-Content $manifestPath -Raw

  $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $ns.AddNamespace("android", "http://schemas.android.com/apk/res/android")

  $existing = @{}
  foreach ($node in $xml.manifest.SelectNodes("uses-permission")) {
    $name = $node.GetAttribute("name", "http://schemas.android.com/apk/res/android")
    if ($name) { $existing[$name] = $true }
  }

  $sourceText = Get-Content $ManifestSourcePath -Raw
  $permMatches = [regex]::Matches($sourceText, 'uses-permission\s+android:name="([^"]+)"')
  $featureMatches = [regex]::Matches($sourceText, 'uses-feature\s+android:name="([^"]+)"[^/]*')

  foreach ($m in $permMatches) {
    $permName = $m.Groups[1].Value
    if ($existing.ContainsKey($permName)) { continue }
    $el = $xml.CreateElement("uses-permission")
    $el.SetAttribute("name", "http://schemas.android.com/apk/res/android", $permName)
    $xml.manifest.InsertBefore($el, $xml.manifest.application) | Out-Null
    Write-Host "  + $permName" -ForegroundColor Green
  }

  foreach ($m in $featureMatches) {
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

  & $Java -jar $ApktoolJar b $decoded -o $built | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "apktool build failed" }

  if (-not (Test-ApkHasPermissions $built $RequiredPerms)) {
    throw "Manifest patch did not apply required permissions"
  }

  Copy-Item $built $ApkPath -Force
  Write-Host "Manifest permissions patched successfully." -ForegroundColor Green
  return $ApkPath
}
finally {
  Start-Sleep -Milliseconds 200
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
