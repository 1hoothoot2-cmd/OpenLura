# SkyTracker Web Monetization Strategy

## Monetization Principles

- De kaart en aircraftinteractie blijven altijd primair.
- Advertenties zijn secundair en duidelijk gescheiden.
- Advertenties bedekken nooit aircraft, controls, selectie of statusinformatie.
- Plaatsing is responsive en veroorzaakt geen layout shift.
- Premiumgebruikers kunnen advertenties uitschakelen.
- Monetization beïnvloedt motion, rendering en providerperformance niet.

## Toekomstige componentgrens

```text
components/
  monetization/
    AdSlot.tsx
```

Deze component bestaat nog niet. Implementatie, advertentieprovider,
consentflow, privacyanalyse en premiumrechten vereisen een afzonderlijke
expliciete sprint.
