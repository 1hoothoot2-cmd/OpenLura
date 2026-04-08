$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$syncRoot = Join-Path $projectRoot "openlura_gpt_sync"

if (!(Test-Path $syncRoot)) {
    New-Item -ItemType Directory -Path $syncRoot | Out-Null
}

$filesToSync = @(
    # CORE APP
    @{ Source = "app\page.tsx"; Destination = "Home_page.tsx" },
    @{ Source = "app\layout.tsx"; Destination = "layout.tsx" },
    @{ Source = "app\globals.css"; Destination = "globals.css" },
    @{ Source = "app\chat\page.tsx"; Destination = "chat_page.tsx" },
    @{ Source = "app\photo-studio\page.tsx"; Destination = "photo_studio_page.tsx" },
    
    
    # ROUTES
    @{ Source = "app\api\chat\route.ts"; Destination = "chat_route.ts" },
    @{ Source = "app\api\feedback\route.ts"; Destination = "feedback_route.ts" },
    @{ Source = "app\api\auth\route.ts"; Destination = "auth_route.ts" },
    @{ Source = "app\api\personal-state\route.ts"; Destination = "personal_state_route.ts" },
    @{ Source = "app\api\prompts\route.ts"; Destination = "prompts_route.ts" },
    @{ Source = "app\auth\callback\page.tsx"; Destination = "auth_callback_page.tsx" },
    @{ Source = "app\api\voice\route.ts"; Destination = "voice_route.ts" },
    @{ Source = "app\api\image-generate\route.ts"; Destination = "image_generate_route.ts" },
    @{ Source = "app\api\fal-upload\route.ts"; Destination = "fal_upload_route.ts" },
    @{ Source = "app\api\brain\notebooks\route.ts"; Destination = "brain_notebooks_route.ts" },
    @{ Source = "app\api\brain\documents\route.ts"; Destination = "brain_documents_route.ts" },
    @{ Source = "app\api\brain\sources\route.ts"; Destination = "brain_sources_route.ts" },
    @{ Source = "app\api\brain\notes\route.ts"; Destination = "brain_notes_route.ts" },

    # PAGES
    @{ Source = "app\analytics\page.tsx"; Destination = "analytics_page.tsx" },
    @{ Source = "app\personal-workspace\page.tsx"; Destination = "persoonlijke-omgeving_page.tsx" },
    @{ Source = "app\privacy\page.tsx"; Destination = "privacy_page.tsx" },
    @{ Source = "app\personal-dashboard\page.tsx"; Destination = "personal_dashboard_page.tsx" },
    @{ Source = "app\brain\page.tsx"; Destination = "brain_page.tsx" },
    @{ Source = "app\brain\[id]\page.tsx"; Destination = "brain_id_page.tsx" },

    # MEMORY FILES
    @{ Source = "OPENLURA_PROJECT_MEMORY.md"; Destination = "OPENLURA_PROJECT_MEMORY.md" },
    @{ Source = "OPENLURA_RULES.md"; Destination = "OPENLURA_RULES.md" },

    # AUTH
    @{ Source = "lib\auth\adminSession.ts"; Destination = "lib_auth_adminSession.ts" },
    @{ Source = "lib\auth\analyticsSession.ts"; Destination = "lib_auth_analyticsSession.ts" },
    @{ Source = "lib\auth\requestIdentity.ts"; Destination = "lib_auth_requestIdentity.ts" },

    # COMPONENTS
    @{ Source = "components\chat\Sidebar.tsx"; Destination = "components_chat_Sidebar.tsx" },

    # STRIPE
    @{ Source = "app\api\stripe\checkout\route.ts"; Destination = "stripe_checkout_route.ts" },
    @{ Source = "app\api\stripe\webhook\route.ts"; Destination = "stripe_webhook_route.ts" },
    @{ Source = "app\api\stripe\portal\route.ts"; Destination = "stripe_portal_route.ts" }
    @{ Source = "app\api\stripe\credits\route.ts"; Destination = "stripe_credits_route.ts" }
)

Write-Host ""
Write-Host "Syncing OpenLura GPT files..." -ForegroundColor Cyan

foreach ($file in $filesToSync) {
    $sourcePath = Join-Path $projectRoot $file.Source
    $destinationPath = Join-Path $syncRoot $file.Destination

    if (Test-Path -LiteralPath $sourcePath) {
        Copy-Item -LiteralPath $sourcePath $destinationPath -Force
        Write-Host "OK  $($file.Source) -> openlura_gpt_sync\$($file.Destination)" -ForegroundColor Green
    } else {
        Write-Host "MISS  $($file.Source)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done. Upload files from: $syncRoot" -ForegroundColor Cyan
Write-Host ""