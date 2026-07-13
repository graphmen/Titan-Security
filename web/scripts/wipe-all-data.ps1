# Wipe ALL Titan Protection operational data via Supabase REST API.
# Requires SUPABASE_SERVICE_ROLE_KEY in web/.env.local (or env var).
# Leaves only empty tables + you must re-seed titan via the app or SQL script.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }

$url = ($envContent = Get-Content $envFile | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' }) -replace '^NEXT_PUBLIC_SUPABASE_URL=',''
$key = (Get-Content $envFile | Where-Object { $_ -match '^SUPABASE_SERVICE_ROLE_KEY=' }) -replace '^SUPABASE_SERVICE_ROLE_KEY=',''
if (-not $url -or -not $key) { throw "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local" }

$h = @{ apikey = $key; Authorization = "Bearer $key" }
$base = "$url/rest/v1"

$tables = @(
  'shift_swap_requests','guard_alerts','whatsapp_outbox','guard_attendance','shifts','checkpoints',
  'guard_premises','guards','places','premises','supervisor_territories','supervisors',
  'territory_suburbs','territories','visitors','active_sos_alerts','occurrence_book',
  'checklist_submissions','checklist_templates','titan_state','app_settings','tenants'
)

Write-Host "Wiping all operational data..." -ForegroundColor Yellow
foreach ($t in $tables) {
  $col = if ($t -eq 'app_settings') { 'key' } elseif ($t -eq 'guard_premises') { 'guard_id' } elseif ($t -eq 'supervisor_territories') { 'supervisor_id' } elseif ($t -eq 'active_sos_alerts') { 'tenant_id' } else { 'id' }
  try {
    Invoke-RestMethod -Method Delete -Uri "$base/$t`?${col}=not.is.null" -Headers $h -TimeoutSec 30 | Out-Null
    Write-Host "  cleared $t"
  } catch {
    Write-Host "  $t : $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

# Re-seed minimal Titan tenant
$tenantBody = @{ id = 'titan'; name = 'Titan Protection'; primary_color = '#1b4332'; logo_text = 'TP'; plan = 'Growth Trial'; status = 'Active' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/tenants" -Headers ($h + @{ Prefer = 'resolution=merge-duplicates' }) -Body $tenantBody -ContentType 'application/json' | Out-Null
try {
  Invoke-RestMethod -Method Delete -Uri "$base/tenants?id=in.(alpha,omega)" -Headers $h -TimeoutSec 15 | Out-Null
} catch { }
Write-Host "Re-seeded titan tenant only." -ForegroundColor Green

foreach ($check in 'territories','guards','premises','supervisors','tenants') {
  $r = Invoke-RestMethod -Uri "$base/${check}?select=id" -Headers $h -TimeoutSec 15
  $n = @($r).Count
  Write-Host "$check rows: $n"
}

Write-Host "Done. Database is clean - register real data on the live site." -ForegroundColor Green
