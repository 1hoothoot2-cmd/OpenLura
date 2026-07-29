# SkyTracker Local Test Environment

## Purpose

The Local Test Environment replaces public staging for deterministic acceptance.
It runs the existing OpenLura frontend and SkyTracker backend on loopback only.
No production Cloud Run, Supabase, OpenSky, OpenAI, or other provider is used.

## Architecture

```text
Browser (127.0.0.1:3200)
  -> Next.js same-origin routes
    -> SkyTracker fixture backend (127.0.0.1:8180)
    -> deterministic local SkyGuide provider
    -> in-memory error-scenario controller

Account contracts
  -> guest mode with loopback-only Supabase configuration
  -> no external Supabase connection
```

The backend uses its existing `development` fake aircraft provider. Airport and
aircraft data therefore follow existing provider-neutral contracts. SkyGuide
supplies deterministic airport and weather answers in-process. No alternative
production architecture is introduced.

## Start and stop

From the OpenLura repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\skytracker-local-test-start.ps1
```

Stop only the processes managed by this environment:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\skytracker-local-test-stop.ps1
```

Run the acceptance audit:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\skytracker-local-test-audit.ps1
```

## Ports

| Component | Address |
| --- | --- |
| Frontend | `http://127.0.0.1:3200` |
| Backend | `http://127.0.0.1:8180` |
| Reserved local Supabase contract address | `http://127.0.0.1:54321` |

The current environment validates guest account contracts without starting
Supabase. Port 54321 is deliberately loopback-only and reserved for a future
Supabase Local runtime.

## Fixture and error scenarios

Change the active scenario through the local-only endpoint:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:3200/api/skytracker/local-test/scenario `
  -ContentType application/json `
  -Body '{"scenario":"stale-cache"}'
```

Supported values:

- `normal`: deterministic aircraft, airport, weather, and SkyGuide fixtures;
- `empty`: valid aircraft snapshot with no aircraft;
- `stale-cache`: successful fixture snapshot marked as stale fallback;
- `timeout`: deterministic HTTP 504;
- `budget-exceeded`: deterministic HTTP 503 with Budget Gate provenance;
- `provider-unavailable`: deterministic HTTP 503.

The scenario endpoint and fixture provider require all local gates. They return
unavailable outside this environment.

## Production isolation

Fixture mode activates only when all of these conditions are true:

- `SKYTRACKER_LOCAL_TEST_MODE=enabled`;
- `NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT=local-test`;
- `SKYTRACKER_LOCAL_TEST_HOST=127.0.0.1`;
- no Vercel runtime marker;
- no Cloud Run runtime marker;
- no Google Cloud project marker.

The start script supplies only loopback URLs and non-secret local placeholder
keys. The existing production localhost rejection is bypassed only after the
complete local gate succeeds. The audit fails for non-loopback runtime URLs and
verifies the local-only scenario route before exercising fixtures.

The interface permanently displays **Local / Test Data** and labels its source
as fixture test data.

## Evidence

Machine-readable audit output is written to:

`artifacts/local-test-audit/audit-result.json`

The audit covers backend health, the permanent marker, normal and empty
aircraft snapshots, stale cache, timeout, Budget Gate, provider unavailable,
SkyGuide weather fixtures, and the guest account contract.

## Known differences from public staging

- Authentication and RLS integration are contract-tested in guest mode; a full
  Supabase Local database is not started by default.
- MapLibre's public basemap remains the existing development basemap. No
  aircraft, airport, weather, AI, account, backend, or provider production
  endpoint is used.
- Fixtures validate behavior and failure handling, not real provider latency,
  quotas, Cloud Run cold starts, CDN behavior, or Vercel edge behavior.
- SkyGuide responses are deterministic fixture responses rather than model
  quality or token-usage acceptance.
