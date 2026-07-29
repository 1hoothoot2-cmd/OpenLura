Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RuntimeDirectory = Join-Path $PSScriptRoot ".runtime\local-test"
$PidFiles = @(
    (Join-Path $RuntimeDirectory "frontend.pid"),
    (Join-Path $RuntimeDirectory "backend.pid")
)

foreach ($pidFile in $PidFiles) {
    if (-not (Test-Path $pidFile)) { continue }
    $value = (Get-Content -Raw $pidFile).Trim()
    $processId = 0
    if ([int]::TryParse($value, [ref]$processId)) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            & taskkill.exe /PID $processId /T /F *> $null
            if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
                throw "Could not stop managed local-test process $processId."
            }
        }
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

Write-Output "SkyTracker Local Test Environment STOPPED"
