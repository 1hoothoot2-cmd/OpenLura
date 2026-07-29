# OpenLura SkyTracker

OpenLura currently exposes one focused product surface:

- `/` — OpenLura home;
- `/skytracker` — SkyTracker product information;
- `/skytracker/live` — the live aircraft map with Search, Filters, Favorites,
  Details, Motion, Replay, Historical Track, accounts, Memory and SkyGuide.

## Local test environment

Start the isolated fixture environment:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\skytracker-local-test-start.ps1
```

Run its acceptance audit:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\skytracker-local-test-audit.ps1
```

Stop only its managed processes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\skytracker-local-test-stop.ps1
```

See [the Local Test Environment documentation](docs/skytracker-web/LOCAL_TEST_ENVIRONMENT.md)
for isolation guarantees, ports, fixtures and known limitations.

## Quality checks

```powershell
npm run test:aircraft
npx tsc --noEmit --incremental false
npm run lint
npm run build
git diff --check
```

The browser never contacts an aircraft provider directly. Production aircraft
traffic uses the same-origin Next.js routes and the provider-neutral
SkyTracker backend.
