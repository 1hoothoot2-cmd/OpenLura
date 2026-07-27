# SkyTracker Web L3 — Smooth Motion & Replay Harness

## Scope

L3 adds deterministic local aircraft motion. It does not add a backend,
provider traffic, polling, UI controls, trails, search, filters, favorites, or
camera following.

## Motion architecture

```text
Validated fixture aircraft
→ MotionPlan
→ ReplayClock time
→ linear interpolation
→ PresentedAircraft
→ GeoJSON FeatureCollection
→ existing AircraftMapSourceWriter
→ existing MapLibre source and layers
```

React continues to own only shell, selection, and URL state. The
`AircraftMotionRuntime` is created with the MapLibre registration and writes
motion frames directly through the existing sole sourcewriter. Aircraft are
never rendered as React or DOM markers.

## Units and plans

- Coordinates: WGS84 degrees.
- Heading: degrees, clockwise from north.
- Speed: metres per second.
- Time: monotonic milliseconds.
- Fixture target interval: 4 seconds.

Each immutable `MotionPlan` contains a start position, target position,
heading, speed, monotonic start time, and duration. At every four-second
boundary the next target is derived from the same heading and speed. There is
no random input, easing, spring behavior, or route prediction.

The target projection uses a spherical-earth forward calculation. Rendering
between two targets is deliberately linear, matching the radar-style motion
requirement.

## ReplayClock

`ReplayClock` uses `performance.now()` through an injected monotonic time
source. `play()`, `pause()`, and `currentTime()` are idempotent and exclude
paused time. This is the internal foundation for later replay controls; L3
does not expose pause or seek UI.

## Frame loop and lifecycle

The runtime uses `requestAnimationFrame()`. It:

- starts after the MapLibre source and layers are registered;
- caps GeoJSON write attempts at about 30 per second;
- pauses both the frame loop and replay clock when the document is hidden;
- resumes without a time jump when the document becomes visible;
- stops and removes listeners on map unmount.

MapLibre's existing sourcewriter still performs content fingerprint
deduplication. A frame whose rounded presentation coordinates and selection
are unchanged does not call `setData()`.

## Selection and camera

Selection remains aircraft-ID-based. A selection change is applied immediately
to the latest motion sample without recreating the map. URL state and the
selection card remain React state. The camera is never modified by motion.

## Reduced Motion

When `prefers-reduced-motion: reduce` matches, fixture motion is disabled. The
current static frame and all selection behavior remain available. A runtime
preference change pauses or resumes the replay clock and frame loop without a
position jump.

## Performance observations

The runtime processes twelve small point features and has no polling, worker,
timer interval, or React render per motion frame. The browser frame callback
runs at display cadence, while source writes are bounded to approximately 30
per second and remain subject to sourcewriter deduplication.

Runtime acceptance checks compare source coordinates across time, preserve a
selected feature, inspect console output, and exercise desktop and mobile
viewports.

## Known limitations

- Motion is straight-line fixture extrapolation, not an actual flight route.
- Heading and speed remain constant.
- Aircraft may eventually leave the initial viewport during a very long
  session.
- There is no pause, seek, speed, follow, trail, or replay UI yet.
- Reduced Motion disables movement rather than using a slower animation.

These are intentional L3 boundaries.
