# SkyTracker Web Roadmap

Legenda: ✅ geaccepteerd · 🟡 technisch gereed, acceptatie open · ⬜ gepland

- ✅ L0 — Architecture
- ✅ L1 — Live App Shell
- ✅ L2 — Aircraft Rendering
- ✅ L3 — Smooth Motion
- 🟡 L4 — Local Backend Integration
- 🟡 L5 — Aircraft Details & Follow
- ⬜ L5A — Monetization Foundation
- 🟡 L6 — Search
- 🟡 L7 — Discovery & Filters
- 🟡 L8 — Airport Pages
- 🟡 L9 — Personalization (Favorites)
- 🟡 L10A — Flight Timeline
- 🟡 L10B — Replay
- 🟡 L11 — Historical Track
- 🟡 P1.1 — Global Live Map
- 🟡 P1.2 — Adaptive Global Tile Engine
- 🟡 P1.2A — Smooth Global Loading & Worldwide Aircraft Search
- 🟡 P1.3 — World Experience Polish
- 🟡 P2 — Flight Intelligence
- 🟡 P2.1 — Budget & Snapshot Optimization
- 🟡 P3.1 — SkyGuide Foundation
- ⬜ L12 — Accounts & Sync
- ⬜ L13 — Contextual AI

L4 gebruikt lokaal uitsluitend backend-developmentdata. De technische
integratie is gereed; normale Product Owner-Chromeacceptatie en specifieke
desktop/tablet/mobilecontrole blijven de sluitingscriteria.

L5 gebruikt uitsluitend `GET /v1/aircraft` en de bestaande motionpipeline.
Details en Follow zijn technisch en lokaal in de browser bewezen; definitieve
Product Owner-Chromeacceptatie en de volledige responsive matrix blijven open.

L6 doorzoekt uitsluitend de laatste geldige lokale backend-snapshot.
Callsign-, registratie- en aircraft-ID-search zijn technisch en lokaal in de
browser bewezen; definitieve Product Owner-Chromeacceptatie en de volledige
responsive matrix blijven open.

L7 filtert uitsluitend de MapLibre-presentatie van de actuele snapshot.
Domainstate, polling, selectie en motion blijven behouden; definitieve Product
Owner-Chromeacceptatie en de volledige responsive matrix blijven open.

L8 breidt de bestaande Search-ervaring uit met een lokale Airports-tab en een
Airport Detail Panel op basis van het bestaande providerneutrale
airportcontract. Browseracceptatie is technisch afgerond; expliciete Product
Owner-acceptatie blijft het sluitingscriterium.

L9 bewaart aircraft- en airportfavorieten uitsluitend lokaal via één
versioned Local Storage-repository. De Favorites-tab, detailtoggles,
refreshpersistentie en responsive browsermatrix zijn technisch bewezen;
expliciete Product Owner-acceptatie blijft het sluitingscriterium.

L10A leidt de actuele vluchtfase providerneutraal af uit de bestaande
aircraftsnapshot en toont een verticale, eerlijke tijdlijn zonder verzonnen
historische events. L10A.1 onderscheidt confirmed, current, upcoming en
unknown op basis van uitsluitend lokaal waargenomen sessiefases. Tests, live
polling en de responsive browsermatrix zijn technisch bewezen; expliciete
Product Owner-acceptatie blijft open.

L10B neemt maximaal dertig minuten providerneutrale backendsnapshots op in een
begrensde in-memory ringbuffer. Replay gebruikt `ReplayClock` en dezelfde
motionpipeline als Live, terwijl polling en recording op de achtergrond
doorgaan. Play, pause, begin, terugkeer naar Live en de responsive
browsermatrix zijn technisch bewezen; de handmatige Product Owner-controle van
de tijdslider blijft het sluitingscriterium.

L11 resolveert de interne Flight-ID via het bestaande FlightLeg-contract en
laadt daarna uitsluitend de geselecteerde Historical Track. Segmenten worden
als afzonderlijke GeoJSON-lijnen in één MapLibre-source gerenderd. Desktop,
mobiel, success en unavailable zijn technisch bewezen; expliciete Product
Owner-acceptatie blijft het sluitingscriterium.

P1.1 projecteert ieder wereldwijd kaartcentrum op een deterministisch,
begrensd 4° × 4° queryvenster. Regiowissels worden gededupliceerd,
debounced en per browsersessie begrensd; de zesminutenrefresh, proxyketen,
motionarchitectuur en backend Budget Gate blijven behouden.

P1.2 deelt de zichtbare kaart op in stabiele 4° × 4° tegels. Regionale
viewports laden alle benodigde tegels; zeer ver uitgezoomde viewports gebruiken
een eerlijke, deterministische steekproef van maximaal twaalf gebieden.
Resultaten worden begrensd hergebruikt en op aircraft-ID samengevoegd, terwijl
de status loaded/planned coverage zichtbaar maakt en het bestaande
providerbudget hard begrensd blijft.

P1.2A laadt het focusgebied onmiddellijk en vult zichtbare plus aangrenzende
gebieden daarna sequentieel en progressief. Verouderde wachtrijen worden bij
een regiowissel vervangen en de focusregio houdt een vaste refreshprioriteit.
Wereldwijde Search wordt alleen expliciet gestart, gebruikt de same-origin
Next.js-proxy en een gedeelde, gecachete backendzoekindex zonder dagelijkse
gebruikerslimiet. De technische
implementatie is lokaal gereed; productieacceptatie wacht op de afzonderlijke
Cloud Run-wijzigingsgate.

P1.3 verwijdert de standaard aircraft-footprint en normale icon-halo, behoudt
uitsluitend geselecteerde nadruk en vervangt technische backend- en tiletekst
door een compacte, gebruiksgerichte live-status. De eerste laadervaring en de
ontbrekende decoratieve OpenFreeMap-circle-sprite zijn gericht afgewerkt zonder
wijziging aan data-, motion- of tilearchitectuur.

P2 classificeert de zichtbare positie automatisch als Live, Predicted, Stale
of Lost op basis van de provider-timestamp en de bestaande extrapolatiegrenzen.
Flight History hergebruikt één Historical Track-source: een echte backendtrack
heeft voorrang en wordt uitsluitend met een nieuw werkelijk providerpunt
verlengd; zonder providertrack worden alleen tijdens de sessie ontvangen
posities getoond. FlightLeg-metadata uit de bestaande requestketen verrijkt het
detailpaneel zonder extra browserrequest of nieuw backendcontract.

P2.1 reserveert providerbudget atomisch, laat geblokkeerde aanvragen niet
doortellen en gebruikt een begrensde delayed snapshot wanneer het budget
bereikt is. Alleen het focusgebied wordt iedere zeven minuten opnieuw
gevalideerd; omliggende tegels blijven beschikbaar en worden pas opnieuw
geladen wanneer ze focus worden of na maximaal 24 uur.

P3.1 introduceert SkyGuide als geïntegreerde Aviation Intelligence Assistant
in de Live Map. Desktop toont Details links en SkyGuide rechts; mobiel gebruikt
één bottom sheet met Details- en SkyGuide-tabs. Geselecteerd aircraft,
viewport, lifecycle en Flight History worden automatisch als context
doorgegeven. Er is bewust nog geen AI-provider, geheugen, weer-, nieuws- of
zoekintegratie en geen publieke zelfstandige SkyGuide-route.
