# SkyTracker Web L8 browser acceptance

## Environment

- Route: `http://localhost:3000/skytracker/live`
- Backend: existing local SkyTracker development backend
- Browser: in-app Chromium browser
- Desktop: 1280 × 720
- Tablet: 768 × 1024
- Mobile: 390 × 844
- Airport dataset: deterministic local development index

## Results

- Aircraft and Airports tabs are keyboard-accessible.
- Schiphol is found by `Schiphol`, `Amsterdam`, `EHAM` and `AMS`.
- Search matching is case-insensitive and deterministic.
- Airport selection opens one Airport Detail Panel.
- Name, ICAO, IATA, city, country and coordinates are displayed.
- Elevation, timezone, runways, arrivals and departures use honest
  not-available placeholders because the current backend contract does not
  provide them.
- `Show on map` centers on Schiphol, stops Follow and preserves the existing
  aircraft selection and URL-state.
- Existing Aircraft Search remains operational.
- Escape closes Search.
- Desktop, tablet and mobile have no horizontal document overflow.
- No JavaScript, hydration or L8 MapLibre errors were observed.

## Browser finding

The existing OpenFreeMap style logs a missing `circle-11` sprite warning on
map startup. This predates L8 and does not affect Airport Search or Airport
Details.

## Screenshots

- `01-airport-search-desktop.png`
- `02-airport-detail-desktop.png`
- `03-airport-detail-tablet.png`
- `04-airport-detail-mobile.png`
