# Sprint B4B – Continuous Budget-Aware Aircraft Motion

## Scope

B4B extends only the client-side live motion policy. The six-minute polling
interval, same-origin Next.js proxy, Cloud Run service, backend contracts,
snapshot acceptance, MapLibre source ownership, Replay and product UI remain
unchanged.

## Two-phase live motion

### Reconciliation

Each accepted backend snapshot starts from the aircraft's currently presented
position. The runtime corrects toward the newly received provider position
using an ease-out curve. Correction duration is distance-adaptive between 1.5
and 8 seconds; a negligible discrepancy needs no correction. A single shared
runtime owns all aircraft states, so a new snapshot does not create another
animation loop.

Heading reconciliation follows the shortest normalized turn in `0..<360`.
Missing headings preserve the previous safe heading and never create `NaN`.

### Extrapolation

After reconciliation, airborne aircraft continue geodetically from the latest
provider position using heading and ground speed. Vertical speed updates only
the derived in-frame altitude. Extrapolation requires:

- a finite position timestamp;
- a finite heading;
- ground speed of at least 5 m/s;
- `onGround === false`.

There is no random movement, route prediction, timer per aircraft or network
activity in the motion layer.

## Freshness policy

- 0–120 seconds: full constant-velocity extrapolation.
- 120–240 seconds: linearly decreasing movement confidence/speed.
- At 240 seconds: movement stops and the presentation lifecycle becomes stale.

The fade integrates to at most 180 seconds of full-speed travel. Aircraft never
blindly extrapolate for the complete six-minute provider interval.

## Runtime and Replay

One `requestAnimationFrame` loop samples every live aircraft and writes at most
30 GeoJSON frames per second through the existing single sourcewriter. Hidden
documents cancel the RAF loop; visibility resume creates exactly one loop and
uses wall-clock source age for safe freshness handling. Cleanup cancels the
frame and removes listeners.

Replay explicitly selects the existing bounded interpolation path and never
uses live extrapolation.

## Budget

Motion is fully client-side. Polling remains six minutes, or at most roughly
240 scheduled polls per continuously visible tab per day. No new browser,
Cloud Run or OpenSky request is introduced by B4B.
