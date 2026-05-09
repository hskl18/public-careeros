param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 3000 })
)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

$StateFile = Join-Path $RootDir ".dev\dev-processes.json"

function Write-DevLog {
  param([string]$Message)
  Write-Host "[dev-down] $Message"
}

function Stop-ProcessTree {
  param(
    [int]$ProcessId,
    [string]$Name = "process"
  )

  $CurrentProcessId = $PID
  if ($ProcessId -eq $CurrentProcessId) {
    return
  }

  $Children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
  foreach ($Child in $Children) {
    Stop-ProcessTree -ProcessId $Child.ProcessId -Name "child process"
  }

  $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $Process) {
    return
  }

  Write-DevLog "Stopping $Name (PID $ProcessId)..."
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Should-StopPortProcess {
  param([int]$ProcessId)

  if ($env:FORCE -eq "1") {
    return $true
  }

  $ProcessInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  $CommandLine = if ($ProcessInfo) { $ProcessInfo.CommandLine } else { "" }
  if (-not $CommandLine) {
    return $false
  }

  return (
    $CommandLine.Contains($RootDir.Path) -or
    $CommandLine.Contains("next dev") -or
    $CommandLine.Contains("next-server") -or
    $CommandLine.Contains("pnpm") -or
    $CommandLine.Contains("npm.cmd")
  )
}

if (Test-Path $StateFile) {
  $State = Get-Content -Raw $StateFile | ConvertFrom-Json
  foreach ($Item in @($State.processes)) {
    if ($Item.id) {
      $ProcessName = if ($Item.name) { [string]$Item.name } else { "process" }
      Stop-ProcessTree -ProcessId ([int]$Item.id) -Name $ProcessName
    }
  }
} else {
  Write-DevLog "No running dev state file found."
}

$Listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
foreach ($Listener in $Listeners) {
  $OwningProcess = [int]$Listener.OwningProcess
  if (Should-StopPortProcess -ProcessId $OwningProcess) {
    Stop-ProcessTree -ProcessId $OwningProcess -Name "port $Port listener"
  } else {
    $ProcessInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $OwningProcess" -ErrorAction SilentlyContinue
    Write-DevLog "Port $Port is used by PID $OwningProcess, but it does not look like this dev stack."
    if ($ProcessInfo.CommandLine) {
      Write-Host "  $($ProcessInfo.CommandLine)"
    }
    Write-DevLog "Leaving it running. Set FORCE=1 to stop it anyway."
  }
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  $ComposeFile = Join-Path $RootDir "docker-compose.yml"
  if (Test-Path $ComposeFile) {
    $Running = docker compose ps -q --status running app 2>$null
    if ($Running) {
      Write-DevLog "Stopping docker compose stack..."
      docker compose down
    }
  }
}

Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
Write-DevLog "Local stack stopped."
