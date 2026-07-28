# SkyTracker Web L12A acceptance

Date: 2026-07-28

## Environment

- Browser: normal Google Chrome on Windows
- Frontend: `http://localhost:3000/skytracker/live`
- Backend: local Docker backend, runtime status `READY`
- Data source: local backend development snapshot
- Visible aircraft: 3
- Selected aircraft: `406a3d` / `SKY553`
- Session replay storage: in memory only

## Acceptance result

The Replay controls were exercised against locally received backend polls.
The available replay range grew from `13:40` to `18:09` while Replay was
active, which proves that live polling and recording continued in the
background.

Verified:

- Replay opens paused at `0:00`;
- slider dragging changes the central replay time without a page reload;
- seeks to `2:12`, `7:02`, and `11:52` remain stable;
- Begin returns exactly to `0:00`;
- Play starts from the selected seek position;
- Pause freezes the replay time;
- Resume continues from that position;
- Live closes the Replay controls and restores the current live state;
- selection remains `406a3d`;
- Historical Track remains a separate backend track;
- no duplicate marker, source, or layer was observed;
- after clearing the browser console, a Replay-open/Live-return cycle produced
  no new uncaught errors.

## Blocking observation

The local backend returned the same `snapshotId`, timestamp, and aircraft
coordinates in two read-only requests. The selected aircraft remained at
`50.93000 N, 3.62000 E` for all seek positions. Therefore the required proof
that seeking changes both replay time and at least one aircraft position could
not be produced honestly.

No product code was changed. The roadmap was not marked complete.

## Screenshots

- `03-slider-midpoint.png` — paused at `7:02 / 13:40`
- `04-slider-earlier.png` — paused at `2:12 / 13:40`
- `05-slider-later.png` — paused at `11:52 / 13:40`
- `06-begin.png` — Begin at `0:00 / 13:40`
- `07-play-from-seek.png` — playing from `7:04 / 13:40`
- `08-return-live.png` — current Live presentation restored

## Decision

**L12 partially accepted.**

The controls and central ReplayClock behavior are operational, but final
Product Owner acceptance remains open until the local backend supplies at
least two snapshots with a real position difference for one stable aircraft
ID, so slider-driven position changes can be observed.
