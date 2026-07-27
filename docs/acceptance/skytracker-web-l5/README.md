# SkyTracker Web L5 browser acceptance

## Omgeving

- Route: `http://localhost:3000/skytracker/live`
- Browser: Codex in-app Chromium, normale lokale webserver
- Backend: bestaande lokale development-backend op `http://localhost:8080`
- Dataset: drie providerneutrale backend-development-aircraft
- Viewport: 1280 × 720
- Datum: 27 juli 2026

## Bewezen gedrag

- Een MapLibre-aircraft is via hit-testing geselecteerd.
- De URL-selectie gebruikt `?aircraft=4ca123`.
- Het detailpaneel toont callsign, registratie, categorie, hoogte,
  grondsnelheid, verticale snelheid, heading, latitude, longitude en
  Fresh/Stale-lifecycle in SI-eenheden.
- Selectie en detailpaneel bleven behouden tijdens meerdere backendpolls.
- Follow centreerde de bewegende geselecteerde aircraft met behoud van zoom
  en bearing.
- De Follow-knop schakelde tussen `Follow aircraft` en `Stop following`.
- Handmatig slepen van de kaart stopte Follow zonder cameragevecht.
- De detailweergave gebruikt een gelabelde `aside`, een definition list en een
  echte button met `aria-pressed`.
- Er traden geen JavaScript-, hydration-, duplicate-source- of
  duplicate-layerfouten op.

## Bekende observatie

De tijdelijke OpenFreeMap-basemap meldt de reeds bestaande ontbrekende
sprite-image `circle-11`. Dit raakt de aircraftsource, aircraftlayers,
detailweergave en Follow niet.

## Bewijs

- [Aircraft details](01-aircraft-details.png)
- [Follow actief](02-follow-active.png)
- [Follow gestopt](03-follow-stopped.png)

## Open acceptatie

De Product Owner voert nog een normale Chrome-smoketest en de volledige
desktop/tablet/mobilematrix uit. Daarmee blijft L5 technisch gereed met
acceptatie open.
