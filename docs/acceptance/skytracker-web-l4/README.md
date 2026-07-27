# SkyTracker Web L4.1 local acceptance

Date: 2026-07-27  
Web: Next.js development server on `http://localhost:3000`  
Backend: Docker image `skytracker-api:5.5-local` on port 8080  
Data: three deterministic backend development aircraft

## Proven

- backend health returns HTTP 200;
- the map requests the provider-neutral local viewport endpoint;
- exactly three backend aircraft render, with no web fixture fallback;
- motion remains smooth through the existing L3 runtime;
- ID selection, amber highlight and `?aircraft=4ca123` work;
- polling continues without overlapping requests;
- stopping the backend retains all three aircraft and the selection;
- the UI changes to `Backend temporarily unavailable`;
- restarting the backend restores `Local backend connected` without refresh;
- no direct OpenSky, SkyLink, FR24 or other aircraft-provider request exists.

The initial browser pass exposed an unbound browser timer and omitted-null DTO
normalization. Both were reproduced, minimally corrected and covered by tests.

## Evidence

- `01-desktop-connected.png` — three local backend aircraft.
- `02-desktop-selected.png` — selected backend aircraft and URL-state.
- `03-backend-disconnected.png` — retained snapshot while reconnecting.
- `04-backend-reconnected.png` — automatic recovery without refresh.

The in-app browser had a fixed 1280×720 viewport. Dedicated 1440×1000,
768×1024 and 390×844 screenshots and the Product Owner normal-Chrome test
remain the final manual acceptance gate.
