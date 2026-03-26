$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$syncRoot = Join-Path $projectRoot "openlura_gpt_sync"

if (!(Test-Path $syncRoot)) {
    New-Item -ItemType Directory -Path $syncRoot | Out-Null
}

$filesToSync = @(
    # CORE APP
    @{ Source = "app\page.tsx"; Destination = "app_page.tsx" },

    # ROUTES
    @{ Source = "app\api\chat\route.ts"; Destination = "chat_route.ts" },
    @{ Source = "app\api\feedback\route.ts"; Destination = "feedback_route.ts" },
    @{ Source = "app\api\auth\route.ts"; Destination = "auth_route.ts" },
    @{ Source = "app\api\personal-state\route.ts"; Destination = "personal_state_route.ts" },

    # PAGES
    @{ Source = "app\analytics\page.tsx"; Destination = "analytics_page.tsx" },
    @{ Source = "app\persoonlijke-omgeving\page.tsx"; Destination = "persoonlijke-omgeving_page.tsx" },

    # MEMORY FILES
    @{ Source = "OPENLURA_PROJECT_MEMORY.md"; Destination = "OPENLURA_PROJECT_MEMORY.md" },
    @{ Source = "OPENLURA_RULES.md"; Destination = "OPENLURA_RULES.md" }
)

Write-Host ""
Write-Host "Syncing OpenLura GPT files..." -ForegroundColor Cyan

foreach ($file in $filesToSync) {
    $sourcePath = Join-Path $projectRoot $file.Source
    $destinationPath = Join-Path $syncRoot $file.Destination

    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath $destinationPath -Force
        Write-Host "OK  $($file.Source) -> openlura_gpt_sync\$($file.Destination)" -ForegroundColor Green
    } else {
        Write-Host "MISS  $($file.Source)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done. Upload files from: $syncRoot" -ForegroundColor Cyan
Write-Host ""