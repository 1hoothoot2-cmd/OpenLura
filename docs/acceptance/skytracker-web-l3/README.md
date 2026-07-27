# SkyTracker Web L3 acceptance

## Environment

- Local Next.js production build
- `/skytracker/live?aircraft=d00003`
- Development fixtures only
- No backend, polling, or provider traffic

## Results

- All 12 fixture aircraft remain rendered.
- Captures taken eight seconds apart differ and show continued straight-line
  aircraft movement.
- The selected `DEV180` identity, amber marker, label, card, and URL parameter
  remain stable throughout motion.
- Desktop, tablet, and mobile captures all changed across multi-second
  observation windows without shell or selection changes.
- The camera remained unchanged.
- No visible loading, hydration, duplicate-layer, or MapLibre rendering error
  occurred.

## Performance

- Browser animation is scheduled with `requestAnimationFrame`.
- Sourcewrite attempts are capped at approximately 30 per second.
- The existing content fingerprint suppresses frames whose rounded
  presentation data did not change.
- React receives no per-frame state update.
- Twelve fixtures moved without a visible UI pause or input delay.

## Reduced Motion

The active acceptance browser did not request reduced motion. Code and
lifecycle inspection confirm that a matching
`prefers-reduced-motion: reduce` query stops the frame loop and replay clock,
while keeping the static map and selection available.

## Evidence

1. `01-desktop-motion-start.png`
2. `02-desktop-motion-later.png`
3. `03-mobile-motion.png`
4. `04-selection-during-motion.png`

The first two images are eight seconds apart.
