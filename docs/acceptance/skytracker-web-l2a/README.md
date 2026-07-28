# SkyTracker Web L2A – Aircraft Rendering Product Owner Acceptance

## Omgeving

- normale Google Chrome met hardware-WebGL;
- aanvullende controle in Microsoft Edge;
- route: `http://localhost:3000/skytracker/live`;
- lokale frontend en providerneutrale developmentbackend;
- geen codewijzigingen.

## Resultaat

De huidige renderpipeline toont drie aircraft uit de lokale backend via de
bestaande ene GeoJSON-source en MapLibre-layers. Click-hit-testing,
ID-gebaseerde selectie, amber selected styling, details, URL-state,
deselectie via de lege kaart, `Clear selection` en remount zijn handmatig
bewezen.

De actuele developmentset bevat:

- SKY551 met heading 182°;
- SKY552 met heading 91°;
- SKY553 zonder heading.

De markers voor 91° en 182° roteren overeenkomstig de backendwaarden. Het
aircraft zonder heading blijft zichtbaar met een veilige neutrale fallback.

## Console

Een schone Microsoft Edge-console toonde geen applicatiefouten of issues.
Het bestaande Chrome-profiel bevat meerdere browserextensies en rapporteerde
door content scripts veroorzaakte generieke promise-errors. Daarnaast meldt de
OpenFreeMap-basemap een ontbrekende `circle-11` sprite; deze waarschuwing raakt
de lokale aircraftbron en aircraftlayers niet.

## Acceptatiebeperking

De L2A-opdracht verwacht de oorspronkelijke twaalf L2-fixtures met exact
0°/90°/180°/270°. Sinds L4 gebruikt de runtime bewust uitsluitend de lokale
backenddevelopmentsnapshot. `DEVELOPMENT_AIRCRAFT` bestaat alleen nog als
testfixture en er is geen runtime-fixturemodus.

Daarom zijn twaalf gelijktijdige fixturemarkers en de vier exacte cardinale
headings niet opnieuw visueel bewezen. Een fixturepad terugplaatsen zou nieuwe
runtimefunctionaliteit zijn en valt buiten deze acceptatiesprint.

## Screenshots

- `desktop-aircraft.png`
- `heading-and-selected.png`
- `deselected.png`
- `tablet.png`
- `mobile.png`

## Advies

L2 gedeeltelijk accepteren binnen de letterlijke L2A-criteria. De huidige
productrendering werkt aantoonbaar; alleen de verouderde fixture-specifieke
bewijsset ontbreekt.
