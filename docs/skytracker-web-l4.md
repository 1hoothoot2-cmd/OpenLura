# SkyTracker Web backend integration

## Request path

The browser never receives or calls the Cloud Run origin. Live aircraft use:

```text
Browser
-> GET /api/skytracker/aircraft
-> Next.js route handler
-> GET {SKYTRACKER_API_BASE_URL}/v1/aircraft
-> provider-neutral snapshot
```

`SKYTRACKER_API_BASE_URL` is server-only. It must be configured in every
deployment environment and must not use a `NEXT_PUBLIC_` prefix. Local
development uses:

```powershell
$env:SKYTRACKER_API_BASE_URL="http://localhost:8080"
npm.cmd run dev
```

The route validates and normalizes the viewport before contacting the backend,
uses a 14-second upstream timeout, preserves upstream status codes and the safe
`Content-Type`, `Cache-Control`, `ETag`, `X-Cache-Status`, and `X-Request-ID`
headers, and returns provider-neutral Problem Details for proxy failures.

Historical Track uses the same server-only base URL through its existing
same-origin route.

## Viewport and scheduling

- maximum latitude span: 30 degrees;
- maximum longitude span: 60 degrees;
- maximum viewport area: 16 square degrees;
- antimeridian crossing is rejected locally;
- query precision: five decimal places;
- initial request starts after MapLibre is ready;
- normal poll cadence: 6 minutes;
- move-end debounce: 400 milliseconds;
- request timeout: 14 seconds;
- one in-flight request at a time;
- hidden tabs pause polling and motion;
- unmount aborts and disposes all work.

Viewport changes and visibility resumes respect the remaining six-minute
interval instead of forcing an extra request. A continuously open browser
therefore schedules at most 240 normal polls in 24 hours, leaving headroom
under the backend's hard daily provider limit of 300. The backend cache and
Budget Gate remain authoritative; the proxy forwards cache diagnostics and
does not add an independent cache.

## Reconciliation and motion

The response continues through the existing provider-neutral snapshot parser,
ID reconciliation, motion runtime, presentation mapping, GeoJSON writer and
MapLibre layers. Selection, Search, Filters, Favorites, Follow, Timeline,
Historical Track and Session Replay retain their existing contracts.

## Local workflow

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\skytracker-dev-status.ps1

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\skytracker-dev-start.ps1
```

The start script writes only the server-side local backend URL to ignored
`.env.local`. It leaves backend and frontend running for Product Owner review.

## Production configuration

Configure this Vercel variable for Production:

```text
SKYTRACKER_API_BASE_URL=https://<cloud-run-service-origin>
```

Do not commit the production value and do not expose it through browser
JavaScript. After deployment, browser network inspection must show requests to
`openlura.ai/api/skytracker/aircraft`, never to `a.run.app`.
