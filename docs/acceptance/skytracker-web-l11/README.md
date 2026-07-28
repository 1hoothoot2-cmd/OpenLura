# SkyTracker Web L11 browser acceptance

Date: 2026-07-28

Environment:

- Frontend: `http://localhost:3000/skytracker/live`
- Backend: local SkyTracker development container
- Browser: normal Google Chrome
- Desktop viewport: 1920 × 1032 capture
- Mobile viewport: Chrome device emulation, 400 × 824
- Data: provider-neutral backend development data

## Results

- Aircraft `406a3d` resolves through the existing FlightLeg contract to
  `development-flight-1`.
- Historical Track returns `COMPLETE`, 3 points, and 1 segment.
- Switching to aircraft `4ca123` replaces the result with
  `No historical track available.`
- Deselecting removes the detail state and writes an empty track collection.
- At most one source and one layer are registered.
- No Historical Track polling or periodic refresh occurs.
- Mobile detail content remains scrollable and does not overflow horizontally.
- After clearing development hot-reload history, the successful mobile load
  produced no new application console error.

## Screenshots

- `desktop-track-status.png` — successful track status in the detail panel.
- `selected-aircraft-wide.png` — selected aircraft remains visually dominant.
- `desktop-no-track.png` — compact unavailable state after changing selection.
- `mobile-track.png` — 400 × 824 mobile selection and responsive detail panel.

## Limitation

The backend development track spans only three closely spaced points near
Amsterdam. At the initial Western Europe camera it is only a few pixels long.
This acceptance therefore proves the source/layer contract and detail status
more strongly than the visual length of the fixture route.
