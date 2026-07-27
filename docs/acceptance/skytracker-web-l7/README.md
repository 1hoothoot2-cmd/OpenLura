# SkyTracker Web L7 browser acceptance

## Omgeving

- Route: `http://localhost:3000/skytracker/live`
- Browser: Codex in-app Chromium
- Backend: bestaande lokale development-backend op `http://localhost:8080`
- Dataset: drie providerneutrale backend-development-aircraft
- Viewport: 1280 × 720
- Datum: 27 juli 2026

## Bewezen gedrag

- Het filterpaneel opent compact en focust de eerste filteroptie.
- Aircraft Type, Lifecycle, Altitude en Speed gebruiken toegankelijke
  `aria-pressed`-knoppen.
- Keuzes binnen groepen combineren met OR en groepen onderling met AND.
- Passenger, Cargo, Fresh, High en Stationary zijn afzonderlijk gevalideerd.
- Cargo + Fresh + High leverde deterministisch één zichtbaar aircraft.
- Stationary leverde veilig nul zichtbare aircraft.
- Actieve-filterbadge, zichtbaar-aantal en Reset werken.
- Escape sluit het paneel en herstelt focus naar de filterknop.
- Filters bleven actief tijdens meerdere nieuwe backendpolls.
- Search bleef bruikbaar met actieve filters.
- Een geselecteerde Cargo-aircraft bleef geselecteerd en behield details,
  URL-state en actieve Follow nadat Passenger het marker verborgen had.
- Reset bracht alle markers onmiddellijk terug zonder motionreset.
- Filteren gebruikt uitsluitend MapLibre-layerfilters; alle aircraft blijven
  in de ene source, domainstate en motionruntime aanwezig.
- Er traden geen JavaScript-, hydration-, duplicate-source- of
  duplicate-layerfouten op.

## Filtergrenzen

- Low: onder 3.000 m.
- Medium: 3.000–8.000 m inclusief.
- High: boven 8.000 m.
- Stationary: onder 1 m/s.
- Slow: 1–150 m/s.
- Cruise: vanaf 150 m/s.

## Bekende observatie

De tijdelijke OpenFreeMap-basemap meldt de reeds bestaande ontbrekende
sprite-image `circle-11`. Dit staat los van aircraftfilters.

## Bewijs

- [Gecombineerde filters](01-combined-filters.png)
- [Verborgen selectie met actieve Follow](02-hidden-selection-follow.png)
- [Nul zichtbare aircraft](03-zero-visible.png)

## Open acceptatie

De Product Owner voert nog de normale Chrome-smoketest en volledige
desktop/tablet/mobilematrix uit. L7 blijft daarom technisch gereed met
acceptatie open.
