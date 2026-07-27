# SkyTracker Web Master Prompt

## 1. Projectvisie

SkyTracker Web is een zelfstandig, desktop-first aircraft-trackingproduct
binnen OpenLura. Het product maakt complexe vluchtinformatie rustig,
begrijpelijk en visueel toegankelijk, met de kaart als primaire interface.

## 2. OpenLura Aviation Design System

SkyTracker Web is:

- desktop-first en aviation-first;
- premium, donker en rustig;
- opgebouwd rond cyan accenten, diepblauw en subtiele glassmorphism;
- ruim opgezet, met veel ademruimte;
- kaartgericht, met zwevende contextpanelen;
- geen dashboard, Material Design of Bootstrap-uitstraling.

## 3. Architectuur

```text
Backend
↓
Snapshot
↓
Domain
↓
Motion
↓
Presented Aircraft
↓
GeoJSON
↓
SourceWriter
↓
MapLibre
```

React beheert uitsluitend UI-state, selectie en compacte productstatus.
Aircraftmotion en framewrites draaien buiten React.

## 4. Backendregels

- De browser praat nooit rechtstreeks met aircraftproviders.
- Alle aircraftdata komt via de SkyTracker-backend.
- Contracten zijn providerneutraal.
- Provider-DTO's, credentials en providerfoutcodes bereiken de browser niet.
- Developmentdata wordt eerlijk als developmentdata gepresenteerd.

## 5. Motionregels

- Gebruik `performance.now()` als monotone tijdbron.
- Gebruik `requestAnimationFrame()` voor presentatieframes.
- Motion gebruikt gecontroleerde interpolatie.
- `ReplayClock` blijft de centrale klokabstractie.
- Motionstate en GeoJSON-framewrites blijven buiten React.
- Providerupdates zijn input voor motionplannen, geen directe teleportwrites.

## 6. MapLibre

- Eén MapLibre-mapinstantie per actieve kaart.
- Eén aircraft-GeoJSON-source.
- Geen DOM-markers voor aircraft.
- Geen source of layer per aircraft.
- Geen duplicate sources, layers of images.
- De sourcewriter is de enige eigenaar van aircraft-`setData()`.
- Selectie blijft gebaseerd op de stabiele aircraft-ID.

## 7. Codeprincipes

- Volg het Minimal Change Principle.
- Refactor uitsluitend wanneer de sprint dit aantoonbaar nodig maakt.
- Bouw geen verborgen functionaliteit of stille fallback.
- Voeg geen ongebruikte dependency, abstractie of toekomstcode toe.
- Gebruik pure, testbare functies voor domain-, mapping- en policylogica.
- Behoud bestaande geaccepteerde architectuur en gedrag.

## 8. Testing

Iedere implementatiesprint controleert minimaal, voor zover relevant:

- gerichte ESLint;
- TypeScript;
- productiebuild;
- tests en regressietests;
- `git diff --check`;
- browseracceptatie;
- desktop, tablet en mobiel;
- accessibility en reduced motion;
- console, hydration en MapLibre-waarschuwingen.

Een documentatie-only sprint voert geen onnodige build of test uit.

## 9. Product Owner

Een sprint is technisch gereed na aantoonbare geautomatiseerde en runtime-
verificatie. De sprint is pas volledig geaccepteerd na de expliciet gevraagde
Product Owner-browseracceptatie.

## 10. Verboden zonder expliciete sprintopdracht

Codex wijzigt niet zelfstandig:

- de bevroren architectuur;
- het design system of de productidentiteit;
- backend- of providercontracten;
- dependencies;
- providerintegraties;
- monetization of advertenties;
- AI-functionaliteit;
- accounts, analytics of tracking;
- productie- of cloudinfrastructuur.

Iedere toekomstige sprint leest eerst dit bestand, daarna de roadmap en
vervolgens uitsluitend het betreffende sprintbestand.
