param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 3000 }),
  [string]$DevHost = $(if ($env:CAREEROS_DEV_HOST) { $env:CAREEROS_DEV_HOST } else { "127.0.0.1" })
)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

$StateDir = Join-Path $RootDir ".dev"
$StateFile = Join-Path $StateDir "dev-processes.json"
$StdoutLog = Join-Path $StateDir "next-dev.out.log"
$StderrLog = Join-Path $StateDir "next-dev.err.log"

function Write-DevLog {
  param([string]$Message)
  Write-Host "[dev-up] $Message"
}

function Get-PortListeners {
  param([int]$LocalPort)
  Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
}

$Listeners = @(Get-PortListeners -LocalPort $Port)
if ($Listeners.Count -gt 0) {
  Write-DevLog "Port $Port is already in use."
  foreach ($Listener in $Listeners) {
    $Process = Get-Process -Id $Listener.OwningProcess -ErrorAction SilentlyContinue
    $Name = if ($Process) { $Process.ProcessName } else { "unknown" }
    Write-Host "  PID $($Listener.OwningProcess) $Name"
  }
  Write-DevLog "Run .\scripts\dev-down.ps1 first, or use a different PORT."
  exit 1
}

if (-not (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)) {
  Write-DevLog "pnpm is required."
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-DevLog "Installing dependencies..."
  pnpm install
}

Write-DevLog "Seeding local data..."
pnpm seed | Out-Null

New-Item -ItemType Directory -Force $StateDir | Out-Null

Write-DevLog "Starting CareerOS local dashboard..."
$Process = Start-Process `
  -FilePath "pnpm.cmd" `
  -ArgumentList @("dev", "--hostname", $DevHost, "--port", "$Port") `
  -WorkingDirectory $RootDir `
  -RedirectStandardOutput $StdoutLog `
  -RedirectStandardError $StderrLog `
  -WindowStyle Hidden `
  -PassThru

$State = [pscustomobject]@{
  startedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  mode = "local-powershell"
  port = $Port
  processes = @(
    [pscustomobject]@{
      name = "web"
      id = $Process.Id
    }
  )
  logs = [pscustomobject]@{
    stdout = $StdoutLog
    stderr = $StderrLog
  }
}
$State | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $StateFile

for ($Attempt = 0; $Attempt -lt 40; $Attempt++) {
  Start-Sleep -Milliseconds 500
  try {
    $Response = Invoke-WebRequest -Uri "http://${DevHost}:$Port" -UseBasicParsing -TimeoutSec 2
    if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 500) {
      break
    }
  } catch {
    if ($Process.HasExited) {
      Write-DevLog "Dev server exited during startup. Check $StdoutLog and $StderrLog."
      exit 1
    }
  }
}

Write-Host ""
Write-DevLog "CareerOS is running."
Write-Host "Dashboard:      http://${DevHost}:$Port"
Write-Host "Applications:   http://${DevHost}:$Port/applications"
Write-Host "Review:         http://${DevHost}:$Port/review"
Write-Host "Resume:         http://${DevHost}:$Port/resume"
Write-Host "Notifications:  http://${DevHost}:$Port/notifications"
Write-Host "Settings:       http://${DevHost}:$Port/settings"
Write-Host ""
Write-Host "Stop with:      .\scripts\dev-down.ps1"
