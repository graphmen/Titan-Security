# Titan Protection — production server (Windows)
# Listens on all network interfaces so guards can reach it on the LAN.
# Usage: .\scripts\start-production.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".env.local")) {
  Write-Host "Missing .env.local — copy .env.example and add your Supabase credentials." -ForegroundColor Red
  exit 1
}

Write-Host "Building Titan Protection web app..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Port = 3001
Write-Host "Opening firewall for TCP $Port (requires admin)..." -ForegroundColor Cyan
$ruleName = "Titan Protection Web ($Port)"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existing) {
  try {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
    Write-Host "Firewall rule created." -ForegroundColor Green
  } catch {
    Write-Host "Could not create firewall rule (run PowerShell as Administrator): $($_.Exception.Message)" -ForegroundColor Yellow
  }
} else {
  Write-Host "Firewall rule already exists." -ForegroundColor Green
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown"
} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Starting production server on port $Port..." -ForegroundColor Green
Write-Host "  Local:   http://localhost:$Port"
if ($ip) { Write-Host "  Network: http://${ip}:$Port" }
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

npm run start:prod
