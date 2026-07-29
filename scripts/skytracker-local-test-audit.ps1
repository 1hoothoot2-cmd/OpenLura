Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BaseUrl = "http://127.0.0.1:3200"
$BackendUrl = "http://127.0.0.1:8180"
$OutputDirectory = Join-Path $PSScriptRoot "..\artifacts\local-test-audit"
$checks = [System.Collections.Generic.List[object]]::new()

function Assert-NoProductionConfiguration {
    $productionUrlPattern = "(?i)(openlura\.ai|\.run\.app|opensky-network\.org|supabase\.co)"
    foreach ($name in @(
        "SKYTRACKER_API_BASE_URL",
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL"
    )) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value -and $value -match $productionUrlPattern) {
            throw "Production isolation failed: production URL detected in $name."
        }
    }
    foreach ($name in @("GOOGLE_CLOUD_PROJECT", "K_SERVICE", "VERCEL")) {
        if ([Environment]::GetEnvironmentVariable($name)) {
            throw "Production isolation failed: production runtime marker detected in $name."
        }
    }
    foreach ($name in @(
        "OPENAI_API_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENSKY_CLIENT_ID",
        "OPENSKY_CLIENT_SECRET"
    )) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value -and $value -notlike "local-test-*") {
            throw "Production isolation failed: credential detected in $name."
        }
    }
}

function Add-Check([string]$Id, [string]$Status, [string]$Summary) {
    $checks.Add([ordered]@{ id = $Id; status = $Status; summary = $Summary })
}

function Set-Scenario([string]$Scenario) {
    return Invoke-RestMethod -Method Post `
        -Uri "$BaseUrl/api/skytracker/local-test/scenario" `
        -ContentType "application/json" `
        -Body (@{ scenario = $Scenario } | ConvertTo-Json)
}

function Invoke-Aircraft([string]$Scenario) {
    Set-Scenario $Scenario | Out-Null
    try {
        $response = Invoke-WebRequest -UseBasicParsing `
            -Uri "$BaseUrl/api/skytracker/aircraft?minLat=50&minLon=3&maxLat=54&maxLon=7"
        return @{
            status = $response.StatusCode
            content = $response.Content
            headers = $response.Headers
        }
    } catch {
        if ($_.Exception.Response) {
            return @{
                status = [int]$_.Exception.Response.StatusCode
                content = $null
                headers = $_.Exception.Response.Headers
            }
        }
        throw
    }
}

Assert-NoProductionConfiguration
foreach ($value in @($BaseUrl, $BackendUrl)) {
    if ($value -notmatch "^http://(?:127\.0\.0\.1|localhost):") {
        throw "Production isolation failed: non-local URL detected."
    }
}
Add-Check "isolation-localhost" "passed" "All runtime URLs resolve to loopback."

$health = Invoke-WebRequest -UseBasicParsing -Uri "$BackendUrl/v1/health"
Add-Check "backend-health" ($(if ($health.StatusCode -eq 200) { "passed" } else { "failed" })) "Backend health HTTP $($health.StatusCode)."

$page = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/skytracker/live"
Add-Check "local-test-label" ($(if ($page.Content -match "Local / Test Data") { "passed" } else { "failed" })) "Permanent local test marker."

$normal = Invoke-Aircraft "normal"
Add-Check "aircraft-normal" ($(if ($normal.status -eq 200) { "passed" } else { "failed" })) "Deterministic aircraft HTTP $($normal.status)."

$history = Invoke-WebRequest -UseBasicParsing `
    -Uri "$BaseUrl/api/skytracker/historical-track?aircraftId=406a3d&callsign=SKY553&observedAtEpochSeconds=1700000180"
$historyBody = $history.Content | ConvertFrom-Json
Add-Check "history-present" ($(if (
    $history.StatusCode -eq 200 -and
    $historyBody.flight.aircraftId -eq "406a3d" -and
    $historyBody.track.points.Count -eq 3
) { "passed" } else { "failed" })) "Deterministic Historical Track is available for SKY553."

try {
    Invoke-WebRequest -UseBasicParsing `
        -Uri "$BaseUrl/api/skytracker/historical-track?aircraftId=484516&callsign=SKY551&observedAtEpochSeconds=1700000180" |
        Out-Null
    $missingHistoryStatus = 200
} catch {
    $missingHistoryStatus = [int]$_.Exception.Response.StatusCode
}
Add-Check "history-unavailable" ($(if ($missingHistoryStatus -eq 404) { "passed" } else { "failed" })) "Missing Historical Track remains explicit."

$empty = Invoke-Aircraft "empty"
$emptyBody = $empty.content | ConvertFrom-Json
Add-Check "aircraft-empty" ($(if ($empty.status -eq 200 -and $emptyBody.aircraft.Count -eq 0) { "passed" } else { "failed" })) "Empty snapshot is explicit."

$stale = Invoke-Aircraft "stale-cache"
Add-Check "aircraft-stale" ($(if ($stale.status -eq 200 -and $stale.headers["X-Cache-Status"] -eq "budget_stale_fallback") { "passed" } else { "failed" })) "Stale-cache provenance is explicit."

foreach ($case in @(
    @{ scenario = "timeout"; expected = 504 },
    @{ scenario = "budget-exceeded"; expected = 503 },
    @{ scenario = "provider-unavailable"; expected = 503 }
)) {
    $result = Invoke-Aircraft $case.scenario
    Add-Check "aircraft-$($case.scenario)" ($(if ($result.status -eq $case.expected) { "passed" } else { "failed" })) "HTTP $($result.status), expected $($case.expected)."
}
Set-Scenario "normal" | Out-Null

$skyGuideBody = @{
    query = "What is the METAR at EHAM?"
    context = @{
        selectedAircraft = $null
        map = $null
        flightHistory = "unavailable"
    }
} | ConvertTo-Json -Depth 5
$skyGuide = Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/skytracker/skyguide" `
    -ContentType "application/json" `
    -Body $skyGuideBody
Add-Check "skyguide-weather-fixture" ($(if ($skyGuide.sources[0].dataType -eq "weather") { "passed" } else { "failed" })) "SkyGuide used deterministic weather data."

$account = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/skytracker/account"
Add-Check "account-guest-contract" ($(if ($account.mode -eq "guest" -and -not $account.authenticated) { "passed" } else { "failed" })) "Guest contract works without external Supabase."

New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$failed = @($checks | Where-Object status -eq "failed").Count
$report = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
    totals = @{
        checks = $checks.Count
        passed = @($checks | Where-Object status -eq "passed").Count
        failed = $failed
    }
    checks = $checks
}
$report | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 `
    (Join-Path $OutputDirectory "audit-result.json")
Write-Output "Checks=$($report.totals.checks) Passed=$($report.totals.passed) Failed=$failed"
if ($failed -gt 0) { exit 1 }
