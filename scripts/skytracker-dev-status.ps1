Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$FrontendProject = "C:\Users\luis\Documents\New project\openlura-current"
$ContainerName = "skytracker-api-local"
$BackendUrl = "http://localhost:8080/v1/aircraft?minLat=50&minLon=3&maxLat=54&maxLon=9"
$FrontendUrl = "http://localhost:3000/skytracker/live"
$FrontendPidFile = Join-Path $FrontendProject "scripts\.runtime\skytracker-frontend.pid"
$FrontendLogFile = Join-Path $FrontendProject "scripts\.runtime\skytracker-frontend.log"
$FrontendErrorLogFile = Join-Path $FrontendProject "scripts\.runtime\skytracker-frontend-error.log"
$EnvironmentFile = Join-Path $FrontendProject ".env.local"
$RequiredEnvironmentLine = "SKYTRACKER_API_BASE_URL=http://localhost:8080"
$FrontendMarker = "SKYTRACKER_MANAGED_FRONTEND"

function Test-HttpEndpoint {
    param([Parameter(Mandatory = $true)][string]$Url)
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Get-FrontendEncodedCommand {
    $escapedProject = $FrontendProject.Replace("'", "''")
    $escapedLog = $FrontendLogFile.Replace("'", "''")
    $escapedErrorLog = $FrontendErrorLogFile.Replace("'", "''")
    $command = "`$env:$FrontendMarker='1'; Set-Location -LiteralPath '$escapedProject'; & npm.cmd run dev 1>> '$escapedLog' 2>> '$escapedErrorLog'"
    return [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
}

function Test-ManagedFrontendActive {
    if (-not (Test-Path -LiteralPath $FrontendPidFile)) {
        return $false
    }

    $pidText = (Get-Content -Raw -LiteralPath $FrontendPidFile).Trim()
    $managedPid = 0
    if (-not [int]::TryParse($pidText, [ref]$managedPid)) {
        return $false
    }
    $process = Get-Process -Id $managedPid -ErrorAction SilentlyContinue
    if (-not $process) {
        return $false
    }
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$managedPid").CommandLine
    return (
        $process.ProcessName -like "powershell*" -and
        $commandLine -like "*$(Get-FrontendEncodedCommand)*"
    )
}

$dockerAvailable = [bool](Get-Command docker -ErrorAction SilentlyContinue)
$dockerActive = $false
$containerExists = $false
$containerRunning = $false
if ($dockerAvailable) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        & docker info 2>$null | Out-Null
        $dockerActive = $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($dockerActive) {
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        try {
            & docker container inspect $ContainerName 2>$null | Out-Null
            $containerExists = $LASTEXITCODE -eq 0
        }
        finally {
            $ErrorActionPreference = $previousPreference
        }
        if ($containerExists) {
            $running = (& docker container inspect --format "{{.State.Running}}" $ContainerName 2>$null)
            $containerRunning = $LASTEXITCODE -eq 0 -and $running.Trim() -eq "true"
        }
    }
}

$backendReachable = Test-HttpEndpoint -Url $BackendUrl
$frontendReachable = Test-HttpEndpoint -Url $FrontendUrl
$managedPidPresent = Test-Path -LiteralPath $FrontendPidFile
$managedFrontendActive = Test-ManagedFrontendActive
$environmentCorrect = $false
if (Test-Path -LiteralPath $EnvironmentFile) {
    $targetLines = @(
        Get-Content -LiteralPath $EnvironmentFile -Encoding UTF8 |
            Where-Object { $_ -match "^SKYTRACKER_API_BASE_URL=" }
    )
    $environmentCorrect = (
        $targetLines.Count -eq 1 -and
        $targetLines[0] -eq $RequiredEnvironmentLine
    )
}

$status = "PARTIAL"
if ($backendReachable -and $frontendReachable -and $environmentCorrect) {
    $status = "READY"
}
elseif (
    -not $backendReachable -and
    -not $frontendReachable -and
    -not $containerRunning -and
    -not $managedFrontendActive
) {
    $status = "STOPPED"
}

function Format-YesNo {
    param([bool]$Value)
    if ($Value) { return "yes" }
    return "no"
}

Write-Host "Docker available: $(Format-YesNo $dockerAvailable)"
Write-Host "Docker active: $(Format-YesNo $dockerActive)"
Write-Host "Backend container exists: $(Format-YesNo $containerExists)"
Write-Host "Backend container running: $(Format-YesNo $containerRunning)"
Write-Host "Backend endpoint reachable: $(Format-YesNo $backendReachable)"
Write-Host "Frontend route reachable: $(Format-YesNo $frontendReachable)"
Write-Host "Managed frontend PID present: $(Format-YesNo $managedPidPresent)"
Write-Host "Managed frontend process active: $(Format-YesNo $managedFrontendActive)"
Write-Host "Frontend environment correct: $(Format-YesNo $environmentCorrect)"
Write-Host "Status: $status"
