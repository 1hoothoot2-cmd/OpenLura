# SkyTracker Web L4.1 — Local Viewport Backend Integration

## Status and scope

The live map consumes the locally running provider-neutral SkyTracker backend.
The development backend currently returns deterministic data; this is not a
claim of a live provider connection or production aircraft coverage.

## Environment

Set the public, non-secret variable before starting Next.js:

```powershell
$env:NEXT_PUBLIC_SKYTRACKER_API_BASE_URL="http://localhost:8080"
npm.cmd run dev
```

The URL is normalized centrally. Missing or invalid configuration produces an
honest empty-map status. A production build rejects localhost. No `.env.local`
or credential is committed.

Start the accepted local backend with:

```powershell
docker run --rm --name skytracker-api-local -p 8080:8080 `
  -e SKYTRACKER_ENVIRONMENT=development `
  -e HOST=0.0.0.0 skytracker-api:5.5-local
```

## Client pipeline

```text
MapLibre bounds
→ bounded/precision-normalized viewport
→ GET /v1/aircraft
→ snapshot and record validation
→ provider-neutral Aircraft domain
→ ID reconciliation
→ existing AircraftMotionRuntime
→ existing presentation/GeoJSON/sourcewriter/layers
```

The client sends SI units through unchanged: metres, metres per second,
degrees and Unix epoch milliseconds. Nullable provider fields stay nullable.
Invalid individual records are rejected while valid records remain. A malformed
snapshot is rejected as a whole and the last valid snapshot remains visible.

## Viewport and scheduling

- maximum latitude span: 30 degrees;
- maximum longitude span: 60 degrees;
- antimeridian crossing is rejected locally;
- query precision: five decimal places;
- initial request: after MapLibre style, source and layers are ready;
- poll cadence: 4 seconds, scheduled only after completion;
- moveend debounce: 400 ms;
- request timeout: 8 seconds;
- one AbortController per request;
- hidden tabs pause polling and motion;
- unmount aborts and disposes all work.

Retries use 4, 8, 16 and at most 30 seconds. Success resets the backoff.
Viewport 400/413 responses do not retry unchanged bounds. Network, malformed,
502/503 and rate-limit failures retain the last accepted snapshot.

The backend documents ETag for content identity but not conditional 304.
L4.1 therefore records ETag only as client metadata and deliberately does not
send `If-None-Match`.

## Reconciliation and motion

Selection remains ID-based. Existing IDs receive a new four-second motion plan
from the currently presented position to the new backend target. New IDs start
at their received position. Missing IDs are removed; missing selected IDs also
clear the selection and query parameter. `STALE` remains present while the
backend returns it and stops at its received target rather than extrapolating
without limit.

React owns snapshot/status/selection state but never owns animation frames.
The existing ReplayClock, requestAnimationFrame loop, approximately 30 Hz
sourcewriter cadence and reduced-motion behavior remain in place.

## Status and failures

The compact overlay distinguishes configuration missing, connecting,
connected, invalid viewport and reconnecting. It never names a provider and
never claims worldwide or production data. Normal aborts are not product
errors. Problem Details bodies and internal request parameters are not shown.

## Product Owner acceptance

1. Start the local backend container.
2. Set `NEXT_PUBLIC_SKYTRACKER_API_BASE_URL=http://localhost:8080`.
3. Start OpenLura and open `/skytracker/live`.
4. Confirm exactly three backend aircraft and smooth movement.
5. Select an aircraft and verify URL state.
6. Pan/zoom and verify the request follows after moveend.
7. Stop the backend and confirm the last snapshot remains with reconnecting.
8. Restart the backend and confirm automatic recovery without page refresh.

## Remaining production gates

No direct provider request exists in the web app. A real backend-only aircraft
provider, staging URL, edge abuse protection and cloud acceptance are required
before replacing the development wording or claiming live production data.
