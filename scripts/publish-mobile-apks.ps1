# Publish built Android APKs to web/public/downloads for hosting + in-app OTA updates.
param(
  [string]$MonitorApk,
  [string]$SupervisorApk
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$downloadsDir = Join-Path $repoRoot "web\public\downloads"
$manifestPath = Join-Path $downloadsDir "versions.json"

if (-not (Test-Path $downloadsDir)) {
  New-Item -ItemType Directory -Path $downloadsDir | Out-Null
}

function Read-Json($path) {
  if (Test-Path $path) {
    return Get-Content $path -Raw | ConvertFrom-Json
  }
  return [ordered]@{}
}

function Read-PackageVersion($appDir) {
  $pkg = Get-Content (Join-Path $appDir "package.json") -Raw | ConvertFrom-Json
  return [string]$pkg.version
}

function Read-VersionCode($gradlePath) {
  if (-not (Test-Path $gradlePath)) { return $null }
  $text = Get-Content $gradlePath -Raw
  if ($text -match 'versionCode\s+(\d+)') { return [int]$Matches[1] }
  return $null
}

function Publish-One($key, $appDir, $apkPath, $apkFileName, $description) {
  if (-not $apkPath -or -not (Test-Path $apkPath)) {
    Write-Host "Skip $key - APK not found: $apkPath" -ForegroundColor Yellow
    return $null
  }

  $version = Read-PackageVersion $appDir
  $versionCode = Read-VersionCode (Join-Path $appDir "android\app\build.gradle")
  if (-not $versionCode) { $versionCode = 1 }

  $dest = Join-Path $downloadsDir $apkFileName
  Copy-Item $apkPath $dest -Force
  $sizeMb = [math]::Round((Get-Item $dest).Length / 1MB, 2)
  Write-Host ('Published {0} -> {1} ({2} MB, v{3}, code {4})' -f $key, $dest, $sizeMb, $version, $versionCode) -ForegroundColor Green

  $publishedAt = Get-Date -Format 'yyyy-MM-dd HH:mm'
  return [ordered]@{
    appId = $key
    name = if ($key -eq 'monitor') { 'Titan Monitor' } else { 'Titan Supervisor' }
    description = $description
    version = $version
    versionCode = $versionCode
    apkFile = $apkFileName
    notes = "Published $publishedAt"
  }
}

$monitorDefault = Join-Path $repoRoot "mobile\android\app\build\outputs\apk\debug\app-debug.apk"
$supervisorDefault = Join-Path $repoRoot "mobile-supervisor\android\app\build\outputs\apk\debug\app-debug.apk"

if (-not $MonitorApk) { $MonitorApk = $monitorDefault }
if (-not $SupervisorApk) { $SupervisorApk = $supervisorDefault }

$manifest = Read-Json $manifestPath
if (-not $manifest.monitor) { $manifest.monitor = [ordered]@{} }
if (-not $manifest.supervisor) { $manifest.supervisor = [ordered]@{} }

$monitorDesc = 'Guard field app - patrol, clock-in, SOS, and NFC checkpoints.'
$supervisorDesc = 'Supervisor field app - teams, sites, and territory operations.'

$monitorEntry = Publish-One 'monitor' (Join-Path $repoRoot 'mobile') $MonitorApk 'titan-monitor-latest.apk' $monitorDesc
$supervisorEntry = Publish-One 'supervisor' (Join-Path $repoRoot 'mobile-supervisor') $SupervisorApk 'titan-supervisor-latest.apk' $supervisorDesc

if ($monitorEntry) { $manifest.monitor = $monitorEntry }
if ($supervisorEntry) { $manifest.supervisor = $supervisorEntry }
$manifest.updatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')

$manifest | ConvertTo-Json -Depth 6 | Set-Content $manifestPath -Encoding UTF8
Write-Host ('Updated manifest: {0}' -f $manifestPath) -ForegroundColor Cyan
