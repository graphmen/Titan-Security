# Gradle-friendly SSL trust store for corporate networks (same CA bundle as git-push.ps1).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$gitCa = "C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt"
$winCa = Join-Path $Root ".git\ssl-ca-bundle.pem"

if (-not (Test-Path $winCa)) {
  if (-not (Test-Path $gitCa)) {
    Write-Warning "Git CA bundle not found — Gradle may fail SSL on corporate network."
    return
  }
  $pem = Get-Content $gitCa -Raw
  Get-ChildItem Cert:\LocalMachine\Root | ForEach-Object {
    $pem += "`n-----BEGIN CERTIFICATE-----`n"
    $pem += [Convert]::ToBase64String($_.RawData, [Base64FormattingOptions]::InsertLineBreaks)
    $pem += "`n-----END CERTIFICATE-----`n"
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $winCa) | Out-Null
  Set-Content -Path $winCa -Value $pem -NoNewline
}

$trustStore = Join-Path $Root ".git\gradle-truststore.jks"
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$keytool = Join-Path $javaHome "bin\keytool.exe"

if (-not (Test-Path $trustStore) -and (Test-Path $keytool)) {
  Write-Host "Building Gradle Java trust store..." -ForegroundColor Cyan
  Copy-Item (Join-Path $javaHome "lib\security\cacerts") $trustStore -Force
  $i = 0
  Select-String -Path $winCa -Pattern "-----BEGIN CERTIFICATE-----" -Context 0,9999 | ForEach-Object { } 
  $blocks = (Get-Content $winCa -Raw) -split "-----BEGIN CERTIFICATE-----"
  foreach ($block in $blocks) {
    if ($block -notmatch "-----END CERTIFICATE-----") { continue }
    $i++
    $certPem = "-----BEGIN CERTIFICATE-----" + ($block -split "-----END CERTIFICATE-----")[0] + "-----END CERTIFICATE-----"
    $tmp = Join-Path $env:TEMP "corp-cert-$i.pem"
    Set-Content -Path $tmp -Value $certPem -NoNewline
    & $keytool -importcert -noprompt -alias "corp$i" -file $tmp -keystore $trustStore -storepass changeit 2>$null
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

if (Test-Path $trustStore) {
  $env:GRADLE_OPTS = "-Djavax.net.ssl.trustStore=$trustStore -Djavax.net.ssl.trustStorePassword=changeit"
}
