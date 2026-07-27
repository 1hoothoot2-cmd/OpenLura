# SkyTracker Web Architecture

## Domain en backend

Het aircraftdomain bevat providerneutrale identiteit, positie, beweging,
metadata en lifecycle met expliciete units en nullability. De SkyTracker-
backend is de enige aircraftdatabron; providerdetails blijven backend-only.

## Motion

Nieuwe snapshots leveren immutable motiontargets. Bestaande aircraft bewegen
vanaf hun actuele gepresenteerde positie; nieuwe aircraft starten op hun
ontvangen positie. Motion gebruikt een monotone ReplayClock en draait buiten
React.

## Rendering, GeoJSON en SourceWriter

Domainaircraft worden gemapt naar compacte `PresentedAircraft`-records en
daarna naar deterministische GeoJSON Point-features. Eén FeatureCollection en
één sourcewriter vormen het enige productiepad naar de MapLibre-source.

## MapLibre en React

MapLibre beheert kaart, camera, hit-testing, sources en layers. Aircraft zijn
symbol layers, geen React- of DOM-markers. React beheert uitsluitend shell-,
status-, selectie- en panelstate, nooit motionframes.

## Replay

Replay gebruikt dezelfde domain-, motion-, presentation- en renderinglagen
met een deterministische snapshotbron. Replaydata is nooit stille fallback
voor een falende backend.

## Laagverantwoordelijkheden

```text
Infrastructure: configuratie, HTTP, scheduling, MapLibre-adapters
Domain: modellen, validatie, policies, reconciliation
Motion: klok, plannen en interpolatie
Presentation: labels, selectie-eigenschappen en GeoJSON
React: UI-state en toegankelijke productinteractie
```
