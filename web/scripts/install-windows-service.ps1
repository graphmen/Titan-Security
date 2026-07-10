# Install Titan Protection as a Windows service (run PowerShell as Administrator)
# Keeps the production server running after logout/reboot.

$ErrorActionPreference = "Stop"
$Root = "c:\Users\ndebelem.ZINGSERVER1\Desktop\2026\Security Company\web"
$Node = (Get-Command node).Source
$Npm = (Get-Command npm).Source
$TaskName = "TitanProtectionWeb"

# Firewall
$ruleName = "Titan Protection Web (3001)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 | Out-Null
  Write-Host "Firewall rule created for port 3001."
}

# Build once
Set-Location $Root
npm run build

# Scheduled task: run at startup, restart on failure
$action = New-ScheduledTaskAction -Execute $Npm -Argument "run start:prod" -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null

Write-Host ""
Write-Host "Titan Protection is installed as scheduled task '$TaskName'." -ForegroundColor Green
Write-Host "Start now:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Dashboard:  http://192.168.96.73:3001"
Write-Host "Guards enter this URL in the mobile app Server field."
