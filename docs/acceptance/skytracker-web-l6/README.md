# SkyTracker Web L6 browser acceptance

## Omgeving

- Route: `http://localhost:3000/skytracker/live`
- Browser: Codex in-app Chromium
- Backend: bestaande lokale development-backend op `http://localhost:8080`
- Dataset: drie providerneutrale backend-development-aircraft
- Viewport: 1280 × 720
- Datum: 27 juli 2026

## Bewezen gedrag

- Search opent via een toegankelijke knop en focust het zoekveld.
- Lege invoer toont geen resultatenlijst.
- Volledige en gedeeltelijke callsignmatches werken.
- Registratie en aircraft-ID zijn case-insensitive doorzoekbaar.
- Een onbekende zoekterm toont `No matching aircraft found`.
- Arrow Up, Arrow Down, Enter en Escape werken.
- Resultaatselectie sluit Search, selecteert de juiste aircraft, centreert de
  kaart op de actuele motionpositie, opent het bestaande detailpaneel en werkt
  `?aircraft=` bij.
- Follow blijft na resultaatselectie uit.
- De zoekfunctie gebruikt alleen de actuele React-snapshot; typen heeft geen
  netwerk-, sourcewrite- of motionpad.
- De resultatenlijst gebruikt listbox/option-semantiek,
  `aria-activedescendant` en een zichtbaar focuspad.
- Er traden geen JavaScript-, hydration-, duplicate-source- of
  duplicate-layerfouten op.

## Bekende observatie

De tijdelijke OpenFreeMap-basemap meldt de reeds bestaande ontbrekende
sprite-image `circle-11`. Dit staat los van Search en aircraft-rendering.

## Bewijs

- [Gedeeltelijke callsignresultaten](01-search-results.png)
- [Geen resultaten](02-no-results.png)
- [Geselecteerd resultaat en detailpaneel](03-selected-result.png)

## Open acceptatie

De Product Owner voert nog de normale Chrome-smoketest en volledige
desktop/tablet/mobilematrix uit. L6 blijft daarom technisch gereed met
acceptatie open.
