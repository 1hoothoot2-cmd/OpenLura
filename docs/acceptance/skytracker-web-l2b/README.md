# SkyTracker Web L2B acceptance

## Environment

- Local Next.js production build
- MapLibre GL JS 6.0.0
- Normal Google Chrome plus controlled browser verification
- Desktop verification at 1440 × 1000
- Development fixture data only

## Pipeline evidence

| Step | Before fix | After fix |
| --- | --- | --- |
| Fixtures | 12 | 12 |
| Validated | 12 | 12 |
| Presented | 12 | 12 |
| GeoJSON points | 12 | 12 |
| Source exists | yes | yes |
| Sourcewriter writes | 1 | 1 |
| Aircraft layers | 5 | 5 |
| Image | 64 × 64, 998 alpha pixels | unchanged |
| Source features | 0 | 15 tile-local results / 12 unique IDs |
| Debug circles at 1440 × 1000 | 0 | 12 |
| Normal symbols | 0 | 11 |
| Selected symbols | 0 | 1 |
| Map idle | no | yes |

`querySourceFeatures()` may contain tile-boundary duplicates. Unique aircraft
identity and rendered desktop results both contain all twelve fixture IDs.

## Root cause

The MapLibre 6 ESM worker emitted by Next/Turbopack imported the non-hashed
relative file `maplibre-gl-shared.mjs`, while the build emitted only a hashed
shared module. The worker dependency returned HTTP 404 and GeoJSON processing
never completed.

## Fix

The official, version-matched MapLibre worker and shared module are served
locally at stable same-origin paths. `SkyTrackerLiveMap` configures that worker
URL before creating the map.

## Evidence

- `01-circle-layer-diagnosis.png`: temporary unfiltered circle layer proving
  source and worker recovery. The layer is absent from final product code.
- `02-final-production.png`: final clean production rendering.
- `03-selected-aircraft.png`: amber selected marker and selection card.
- `04-missing-heading.png`: selected `NOHDG` fixture using the neutral heading
  fallback.

## Final cleanup

The temporary circle layer, diagnostics overlay, counters, direct retry,
source/rendered feature queries, and diagnostic event listeners were removed.
