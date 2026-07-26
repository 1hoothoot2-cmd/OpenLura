# SkyTracker Web L1

SkyTracker Web starts at `/skytracker/live` as a standalone, fullscreen
technical preview. The route uses a server-rendered page and metadata boundary
with one focused client component for the browser-only MapLibre lifecycle.

## Structure

- `app/skytracker/live`: route, metadata, noindex policy, and MapLibre CSS.
- `features/skytracker/map/components`: live shell, map container, controls,
  loading state, and error state.
- `features/skytracker/map/infrastructure`: provider-neutral camera and style
  configuration.

## Map foundation

- MapLibre GL JS `6.0.0`.
- Initial camera: the Netherlands and Western Europe, North Up, pitch `0`.
- Zoom range: `2` through `15`.
- One map instance per mounted viewport.
- A request-animation-frame-bounded `ResizeObserver`.
- All listeners, pending resize frames, and the map instance are removed on
  unmount.

The temporary basemap is OpenFreeMap Dark. OpenFreeMap permits commercial use,
requires attribution, and does not currently provide an SLA. MapLibre renders
the source attribution. A production tile/provider decision and availability
budget remain required before L2 is accepted for production.

## Experience

The map owns the available viewport beneath a compact product bar. Controls and
the status card float above the map. Desktop, tablet, and mobile use the same
map lifecycle with responsive spacing, `100dvh`, safe touch targets, visible
focus, and reduced-motion-aware camera transitions.

## Current limits

L1 has no aircraft domain, provider calls, backend polling, motion, markers,
search, filters, details, accounts, geolocation, or analytics additions. L2
adds the provider-neutral aircraft domain and a fixture-driven GeoJSON
rendering path without changing the map lifecycle.
