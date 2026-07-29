# Sprint C1 — Product Cleanup & Functional Bug Audit

Date: 2026-07-30
Branch: `staging`
Baseline: `afe46f133d5a750237cfab8dc0df2205585ea16a`

## Result

The public application surface is reduced to:

- `/`
- `/skytracker`
- `/skytracker/live`

The retained server routes are the routes used by SkyTracker accounts, aircraft,
worldwide search, historical track, local deterministic testing, memory, and
SkyGuide. Removed public and API routes return 404.

## Cleanup

Removed obsolete chat, Brain, analytics, photo studio, legacy workspace,
personal dashboard, test, Stripe, voice, image-generation, feedback, prompt,
and personal-state surfaces. Their exclusive components, data files, mirror
tree, scripts, documentation, and unused public assets were removed as well.

The shared SkyTracker account, favorites, memory, monitoring, SkyGuide,
MapLibre, motion, replay, historical-track, and local-test implementations were
retained. Supabase migrations were retained because current account and memory
features depend on them.

Unused direct dependencies `@supabase/supabase-js` and `unpdf` were removed.
Server-side Supabase access continues through the existing HTTP adapter.

## Product corrections

- Sitemap contains only the three approved public URLs.
- Robots metadata no longer promotes legacy routes.
- The obsolete personal-workspace redirect was removed.
- Public navigation and footer links to removed routes were removed.
- SkyTracker product and live-map metadata now describe the current live web
  product rather than an Android-only or foundation preview.
- The retained auth route was narrowed to lint-clean explicit types.
- Vendored generated MapLibre worker files are excluded from source linting.

## Local acceptance

- Web domain tests: 200 passed, 0 failed, 0 skipped.
- Backend tests: 108 passed, 0 failed, 0 errors, 0 skipped.
- ESLint: passed with 0 errors and 0 warnings.
- TypeScript: passed.
- Next.js production build: passed.
- `git diff --check`: passed (line-ending notices only).
- Local Test Environment audit: 11/11 scenarios passed.

The local environment was tested at desktop 1440×1000 and mobile 390×844.
Homepage, product page, Live Map, search, selection, details, filters,
SkyGuide, replay, responsive layout, and removed-route 404 behavior passed.
No browser console, hydration, CORS, or MapLibre errors were observed.

## Isolation

Acceptance used deterministic local fixtures on localhost. It did not access
production Cloud Run, production Supabase, or production providers. The active
Vercel project binding remains `open-lura`; no deployment was performed during
the destructive cleanup without the existing release gate.

## Known limitations

- `npm audit` could not reach the npm advisory endpoint from the restricted
  execution environment. No dependency auto-fix or version upgrade was made.
- Node reports its existing module-type performance warning during the
  TypeScript test runner. It does not affect test correctness.
- Production remains unchanged until the cleanup commit is explicitly released.

## Conclusion

`C1 CLEANUP ACCEPTED` for the locally validated cleanup scope.
