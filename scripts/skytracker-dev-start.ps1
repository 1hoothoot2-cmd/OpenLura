Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$FrontendProject = "C:\Users\luis\Documents\New project\openlura-current"
$BackendProject = "C:\Users\luis\Documents\New project\skytracker-live"
$ContainerName = "skytracker-api-local"
$DockerImage = "skytracker-api:5.5-local"
$BackendUrl = "http://localhost:8080/v1/aircraft?minLat=50&minLon=3&maxLat=54&maxLon=9"
$FrontendUrl = "http://localhost:3000/skytracker/live"
$RuntimeDirectory = Join-Path $FrontendProject "scripts\.runtime"
$FrontendPidFile = Join-Path $RuntimeDirectory "skytracker-frontend.pid"
$FrontendLogFile = Join-Path $RuntimeDirectory "skytracker-frontend.log"
$FrontendErrorLogFile = Join-Path $RuntimeDirectory "skytracker-frontend-error.log"
$EnvironmentFile = Join-Path $FrontendProject ".env.local"
$RequiredEnvironmentLine = "SKYTRACKER_API_BASE_URL=http://localhost:8080"
$FrontendMarker = "SKYTRACKER_MANAGED_FRONTEND"

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 3
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSeconds
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Wait-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Name,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-HttpEndpoint -Url $Url) {
            return
        }
        Start-Sleep -Milliseconds 750
    } while ((Get-Date) -lt $deadline)

    throw "$Name did not return HTTP 200 within $TimeoutSeconds seconds."
}

function Assert-DockerReady {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI is not available. Start or install Docker Desktop first."
    }

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        & docker info 2>$null | Out-Null
        $dockerExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($dockerExitCode -ne 0) {
        throw "Docker is available but its daemon is not active. Start Docker Desktop first."
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

function Test-ContainerRunning {
    if (-not (Test-ContainerExists)) {
        return $false
    }
    $running = (& docker container inspect --format "{{.State.Running}}" $ContainerName 2>$null)
    return $LASTEXITCODE -eq 0 -and $running.Trim() -eq "true"
}

function Get-FrontendLaunchCommand {
    $escapedProject = $FrontendProject.Replace("'", "''")
    $escapedLog = $FrontendLogFile.Replace("'", "''")
    $escapedErrorLog = $FrontendErrorLogFile.Replace("'", "''")
    return "`$env:$FrontendMarker='1'; Set-Location -LiteralPath '$escapedProject'; & npm.cmd run dev 1>> '$escapedLog' 2>> '$escapedErrorLog'"
}

function Get-FrontendEncodedCommand {
    $bytes = [Text.Encoding]::Unicode.GetBytes((Get-FrontendLaunchCommand))
    return [Convert]::ToBase64String($bytes)
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

function Stop-ManagedFrontendProcess {
    $process = Get-ManagedFrontendProcess
    if (-not $process) {
        return $false
    }

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        & taskkill.exe /PID $process.Id /T /F *> $null
        $taskKillExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($taskKillExitCode -ne 0 -and (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
        throw "The managed frontend process could not be stopped safely."
    }
    Remove-Item -LiteralPath $FrontendPidFile -Force -ErrorAction SilentlyContinue
    return $true
}

function Ensure-FrontendEnvironment {
    $lines = @()
    if (Test-Path -LiteralPath $EnvironmentFile) {
        $lines = @(Get-Content -LiteralPath $EnvironmentFile -Encoding UTF8)
    }

    $nextLines = New-Object System.Collections.Generic.List[string]
    $targetWritten = $false
    $changed = $false
    foreach ($line in $lines) {
        if ($line -match "^(NEXT_PUBLIC_SKYTRACKER_API_BASE_URL|SKYTRACKER_API_BASE_URL)=") {
            if (-not $targetWritten) {
                $nextLines.Add($RequiredEnvironmentLine)
                $targetWritten = $true
                if ($line -ne $RequiredEnvironmentLine) {
                    $changed = $true
                }
            }
            else {
                $changed = $true
            }
        }
        else {
            $nextLines.Add($line)
        }
    }

    if (-not $targetWritten) {
        $nextLines.Add($RequiredEnvironmentLine)
        $changed = $true
    }

    if ($changed) {
        $utf8WithoutBom = New-Object Text.UTF8Encoding($false)
        [IO.File]::WriteAllLines($EnvironmentFile, $nextLines, $utf8WithoutBom)
    }
    return $changed
}

function Start-ManagedFrontend {
    New-Item -ItemType Directory -Force -Path $RuntimeDirectory | Out-Null
    Set-Content -LiteralPath $FrontendLogFile -Value "" -Encoding UTF8
    Set-Content -LiteralPath $FrontendErrorLogFile -Value "" -Encoding UTF8

    $encodedCommand = Get-FrontendEncodedCommand
    $powershellPath = (Get-Command powershell.exe).Source
    $process = Start-Process -FilePath $powershellPath `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand) `
        -WindowStyle Hidden `
        -PassThru
    [IO.File]::WriteAllText($FrontendPidFile, "$($process.Id)", (New-Object Text.UTF8Encoding($false)))
    return $process
}

if (-not (Test-Path -LiteralPath $FrontendProject -PathType Container)) {
    throw "Frontend project not found: $FrontendProject"
}
if (-not (Test-Path -LiteralPath $BackendProject -PathType Container)) {
    throw "Backend project not found: $BackendProject"
}

Assert-DockerReady
New-Item -ItemType Directory -Force -Path $RuntimeDirectory | Out-Null

$environmentChanged = Ensure-FrontendEnvironment
$backendAlreadyHealthy = Test-HttpEndpoint -Url $BackendUrl
$backendStarted = $false

if (-not $backendAlreadyHealthy) {
    if (Test-ContainerRunning) {
        Write-Host "Backend container already runs; waiting for its endpoint."
    }
    else {
        if (Test-ContainerExists) {
            & docker container rm $ContainerName | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Stopped backend container could not be removed."
            }
        }

        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        try {
            & docker image inspect $DockerImage 2>$null | Out-Null
            $imageExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousPreference
        }
        if ($imageExitCode -ne 0) {
            throw "Required Docker image is not available: $DockerImage"
        }

        $containerId = & docker run --detach `
            --name $ContainerName `
            --publish "8080:8080" `
            --env "SKYTRACKER_ENVIRONMENT=development" `
            --env "HOST=0.0.0.0" `
            $DockerImage
        if ($LASTEXITCODE -ne 0 -or -not $containerId) {
            throw "Backend container could not be started."
        }
        $backendStarted = $true
    }

    try {
        Wait-HttpEndpoint -Url $BackendUrl -Name "Backend endpoint"
    }
    catch {
        if ($backendStarted -and (Test-ContainerExists)) {
            & docker container stop $ContainerName *> $null
            & docker container rm $ContainerName *> $null
        }
        throw
    }
}

$frontendAlreadyHealthy = Test-HttpEndpoint -Url $FrontendUrl
$managedFrontend = Get-ManagedFrontendProcess
$frontendStarted = $false
$frontendRestartRequired = $false

if ($environmentChanged -and $frontendAlreadyHealthy) {
    if ($managedFrontend) {
        Stop-ManagedFrontendProcess | Out-Null
        $frontendAlreadyHealthy = $false
        $managedFrontend = $null
    }
    else {
        $frontendRestartRequired = $true
    }
}

if (-not $frontendAlreadyHealthy) {
    if ($managedFrontend) {
        Write-Host "Managed frontend process already exists; waiting for its route."
    }
    else {
        Start-ManagedFrontend | Out-Null
        $frontendStarted = $true
    }

    try {
        Wait-HttpEndpoint -Url $FrontendUrl -Name "Frontend route"
    }
    catch {
        if ($frontendStarted) {
            Stop-ManagedFrontendProcess | Out-Null
        }
        throw
    }
}

Write-Output ""
Write-Output "SkyTracker local development is ready"
Write-Output ""
Write-Output "Frontend:"
Write-Output $FrontendUrl
Write-Output ""
Write-Output "Backend:"
Write-Output $BackendUrl
Write-Output ""
Write-Output "Backend reused: $backendAlreadyHealthy"
Write-Output "Frontend reused: $frontendAlreadyHealthy"
Write-Output "Environment updated: $environmentChanged"
if ($frontendRestartRequired) {
    Write-Warning "The frontend was not started by this script. Restart it once to load the updated .env.local."
}
