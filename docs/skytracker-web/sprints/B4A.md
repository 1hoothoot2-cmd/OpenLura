# Sprint B4A – Production Auto-Refresh Recovery

## Runtime conclusion

The production scheduler is operational. A controlled single-tab acceptance run
proved two distinct backend snapshots six minutes apart without a page refresh.
The reported stationary presentation is classified as a motion-presentation
limitation: each new backend target is interpolated for four seconds, while the
budget-safe backend snapshot interval is six minutes. B4A does not replace that
motion model.

## Polling contract

- Production interval: 6 minutes (maximum 240 scheduled polls per continuously
  visible tab per day).
- Polls run only while the document is visible.
- Resuming a tab observes the remaining interval and cannot bypass the throttle.
- Requests never overlap and one failure schedules a bounded retry.
- Unmount disposes the timer and aborts the active request.
- Browser requests remain same-origin through `/api/skytracker/aircraft`.

## Cache and snapshot policy

Both the browser request and the Next.js proxy use `no-store`; the route is
forced dynamic. The browser never calls Cloud Run directly.

Snapshots are accepted by `generatedAt` and a content fingerprint:

- older snapshots are rejected;
- identical aircraft content is deduplicated;
- changed coordinates, heading, speed, altitude, vertical rate, lifecycle,
  ground state, metadata, or position timestamp are accepted even when IDs stay
  unchanged;
- a successful accepted snapshot reaches React state and the existing
  `AircraftMotionRuntime`, which writes the MapLibre aircraft source.

Development-only diagnostics log the request ID, generated time, aircraft count,
and acceptance reason without logging aircraft payloads. Production logging is
unchanged.

## Known limitation

Aircraft move toward each new target during the existing four-second
interpolation window and then remain stationary until the next snapshot.
Continuous budget-aware extrapolation is intentionally deferred to a separate
motion sprint.
