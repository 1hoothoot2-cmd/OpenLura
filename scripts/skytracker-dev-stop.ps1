Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$FrontendProject = "C:\Users\luis\Documents\New project\openlura-current"
$ContainerName = "skytracker-api-local"
$RuntimeDirectory = Join-Path $FrontendProject "scripts\.runtime"
$FrontendPidFile = Join-Path $RuntimeDirectory "skytracker-frontend.pid"
$FrontendLogFile = Join-Path $RuntimeDirectory "skytracker-frontend.log"
$FrontendErrorLogFile = Join-Path $RuntimeDirectory "skytracker-frontend-error.log"
$FrontendMarker = "SKYTRACKER_MANAGED_FRONTEND"

function Test-DockerReady {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        return $false
    }
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        & docker info 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Test-ContainerExists {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        & docker container inspect $ContainerName 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Get-FrontendEncodedCommand {
    $escapedProject = $FrontendProject.Replace("'", "''")
    $escapedLog = $FrontendLogFile.Replace("'", "''")
    $escapedErrorLog = $FrontendErrorLogFile.Replace("'", "''")
    $command = "`$env:$FrontendMarker='1'; Set-Location -LiteralPath '$escapedProject'; & npm.cmd run dev 1>> '$escapedLog' 2>> '$escapedErrorLog'"
    return [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
}

function Get-ManagedFrontendProcess {
    if (-not (Test-Path -LiteralPath $FrontendPidFile)) {
        return $null
    }

    $pidText = (Get-Content -Raw -LiteralPath $FrontendPidFile).Trim()
    $managedPid = 0
    if (-not [int]::TryParse($pidText, [ref]$managedPid)) {
        Remove-Item -LiteralPath $FrontendPidFile -Force
        return $null
    }

    $process = Get-Process -Id $managedPid -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -LiteralPath $FrontendPidFile -Force
        return $null
    }

    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$managedPid").CommandLine
    $expectedCommand = Get-FrontendEncodedCommand
    if ($process.ProcessName -notlike "powershell*" -or $commandLine -notlike "*$expectedCommand*") {
        Remove-Item -LiteralPath $FrontendPidFile -Force
        return $null
    }
    return $process
}

$backendStopped = $false
$backendExisted = $false
if (Test-DockerReady) {
    $backendExisted = Test-ContainerExists
    if ($backendExisted) {
        $running = (& docker container inspect --format "{{.State.Running}}" $ContainerName 2>$null)
        if ($LASTEXITCODE -eq 0 -and $running.Trim() -eq "true") {
            & docker container stop $ContainerName | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Backend container could not be stopped."
            }
            $backendStopped = $true
        }
        if (Test-ContainerExists) {
            & docker container rm $ContainerName | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Backend container could not be removed."
            }
        }
    }
}

$frontendProcess = Get-ManagedFrontendProcess
$frontendStopped = $false
if ($frontendProcess) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        & taskkill.exe /PID $frontendProcess.Id /T /F *> $null
        $taskKillExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($taskKillExitCode -ne 0 -and (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue)) {
        throw "The managed frontend process could not be stopped safely."
    }
    $frontendStopped = $true
}
Remove-Item -LiteralPath $FrontendPidFile -Force -ErrorAction SilentlyContinue

Write-Host "SkyTracker local development stopped"
Write-Host "Backend container existed: $backendExisted"
Write-Host "Backend container stopped: $backendStopped"
Write-Host "Managed frontend process found: $([bool]$frontendProcess)"
Write-Host "Managed frontend process stopped: $frontendStopped"
