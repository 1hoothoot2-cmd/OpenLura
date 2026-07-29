Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$FrontendProject = Split-Path -Parent $PSScriptRoot
$BackendProject = [IO.Path]::GetFullPath(
    (Join-Path $FrontendProject "..\skytracker-t1-staging")
)
$RuntimeDirectory = Join-Path $PSScriptRoot ".runtime\local-test"
$FrontendPidFile = Join-Path $RuntimeDirectory "frontend.pid"
$BackendPidFile = Join-Path $RuntimeDirectory "backend.pid"
$FrontendUrl = "http://127.0.0.1:3200/skytracker/live"
$BackendUrl = "http://127.0.0.1:8180/v1/health"

function Assert-Isolation {
    $forbidden = @(
        "openlura.ai",
        "a.run.app",
        "opensky-network.org",
        "openlura",
        "skytracker-api-vrm3g3m3va"
    )
    $values = @(
        "http://127.0.0.1:8180",
        "http://127.0.0.1:54321",
        "local-test-disabled"
    )
    foreach ($value in $values) {
        foreach ($item in $forbidden) {
            if ($value -like "*$item*") {
                throw "Production isolation failed: forbidden value detected."
            }
        }
    }
    if (-not (Test-Path (Join-Path $BackendProject "gradlew.bat"))) {
        throw "Isolated backend worktree not found: $BackendProject"
    }
}

function Test-Endpoint([string]$Url) {
    try {
        return (Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3).StatusCode -eq 200
    } catch {
        return $false
    }
}

function Wait-Endpoint([string]$Url, [string]$Name, [int]$Seconds = 90) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Endpoint $Url) { return }
        Start-Sleep -Milliseconds 750
    }
    throw "$Name did not become ready within $Seconds seconds."
}

function Test-ManagedProcess([string]$PidFile) {
    if (-not (Test-Path $PidFile)) { return $false }
    $value = (Get-Content -Raw $PidFile).Trim()
    $processId = 0
    if (-not [int]::TryParse($value, [ref]$processId)) { return $false }
    return [bool](Get-Process -Id $processId -ErrorAction SilentlyContinue)
}

function Start-EncodedPowerShell(
    [string]$Command,
    [string]$PidFile
) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
    $process = Start-Process powershell.exe `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded) `
        -WindowStyle Hidden -PassThru
    Set-Content -Encoding ASCII -Path $PidFile -Value $process.Id
}

Assert-Isolation
New-Item -ItemType Directory -Force $RuntimeDirectory | Out-Null

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
    throw "Java runtime not found at $javaHome"
}

if (-not (Test-ManagedProcess $BackendPidFile)) {
    $backendLog = Join-Path $RuntimeDirectory "backend.log"
    $backendError = Join-Path $RuntimeDirectory "backend-error.log"
    $backendCommand = @"
`$env:JAVA_HOME='$javaHome'
`$env:Path='$(Join-Path $javaHome "bin");' + `$env:Path
`$env:SKYTRACKER_ENVIRONMENT='development'
`$env:AIRCRAFT_STATE_PROVIDER='fake'
`$env:HOST='127.0.0.1'
`$env:PORT='8180'
Set-Location -LiteralPath '$BackendProject'
& .\gradlew.bat :backend:run 1>> '$backendLog' 2>> '$backendError'
"@
    Start-EncodedPowerShell $backendCommand $BackendPidFile
}
Wait-Endpoint $BackendUrl "Local fixture backend"

$env:NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT = "local-test"
$env:SKYTRACKER_LOCAL_TEST_MODE = "enabled"
$env:SKYTRACKER_LOCAL_TEST_HOST = "127.0.0.1"
$env:SKYTRACKER_API_BASE_URL = "http://127.0.0.1:8180"
$env:SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_ANON_KEY = "local-test-anon"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-anon"
$env:SUPABASE_SERVICE_ROLE_KEY = "local-test-service-role"
$env:OPENAI_API_KEY = "local-test-disabled"

Push-Location $FrontendProject
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Local test frontend build failed." }
} finally {
    Pop-Location
}

if (-not (Test-ManagedProcess $FrontendPidFile)) {
    $frontendLog = Join-Path $RuntimeDirectory "frontend.log"
    $frontendError = Join-Path $RuntimeDirectory "frontend-error.log"
    $frontendCommand = @"
`$env:NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT='local-test'
`$env:SKYTRACKER_LOCAL_TEST_MODE='enabled'
`$env:SKYTRACKER_LOCAL_TEST_HOST='127.0.0.1'
`$env:SKYTRACKER_API_BASE_URL='http://127.0.0.1:8180'
`$env:SUPABASE_URL='http://127.0.0.1:54321'
`$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
`$env:SUPABASE_ANON_KEY='local-test-anon'
`$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='local-test-anon'
`$env:SUPABASE_SERVICE_ROLE_KEY='local-test-service-role'
`$env:OPENAI_API_KEY='local-test-disabled'
Set-Location -LiteralPath '$FrontendProject'
& npm.cmd run start -- -p 3200 1>> '$frontendLog' 2>> '$frontendError'
"@
    Start-EncodedPowerShell $frontendCommand $FrontendPidFile
}
Wait-Endpoint $FrontendUrl "Local test frontend"

$scenario = Invoke-RestMethod -Method Get `
    -Uri "http://127.0.0.1:3200/api/skytracker/local-test/scenario"

Write-Output "SkyTracker Local Test Environment READY"
Write-Output "Frontend: $FrontendUrl"
Write-Output "Backend: http://127.0.0.1:8180"
Write-Output "Scenario: $($scenario.scenario)"
Write-Output "Data: deterministic local fixtures"
Write-Output "Production access: blocked by configuration"
