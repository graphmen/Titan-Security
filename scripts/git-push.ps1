# Push to GitHub from this machine (handles corporate SSL / custom root CAs).
# Usage: .\scripts\git-push.ps1
#        .\scripts\git-push.ps1 -Branch main

param(
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$gitCa = "C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt"
$winCa = Join-Path $Root ".git\ssl-ca-bundle.pem"

if (-not (Test-Path $gitCa)) {
  Write-Error "Git CA bundle not found at $gitCa"
}

if (-not (Test-Path $winCa)) {
  Write-Host "Building SSL CA bundle for GitHub..." -ForegroundColor Cyan
  $pem = Get-Content $gitCa -Raw
  Get-ChildItem Cert:\LocalMachine\Root | ForEach-Object {
    $pem += "`n-----BEGIN CERTIFICATE-----`n"
    $pem += [Convert]::ToBase64String($_.RawData, [Base64FormattingOptions]::InsertLineBreaks)
    $pem += "`n-----END CERTIFICATE-----`n"
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $winCa) | Out-Null
  Set-Content -Path $winCa -Value $pem -NoNewline
}

$env:GIT_SSL_CAINFO = $winCa
git push -u origin $Branch
