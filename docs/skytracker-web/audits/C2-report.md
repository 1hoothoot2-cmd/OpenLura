# Sprint C2 — Technical Bug Hunt & Hardening

Date: 2026-07-30

Branch: `codex/c2-technical-hardening`

Base: `main` at `2091dd4b8bd03ddfbc5ab90f37b77120881360aa`

## Scope and method

The audit covered `/`, `/skytracker`, `/skytracker/live`, the same-origin
SkyTracker API routes, the client motion/map lifecycle, account and SkyGuide
boundaries, and the local backend module. The implementation audit preceded
all changes. Production, Cloud Run, Supabase, Vercel and providers were not
contacted.

## Findings

| Severity | Finding | Root cause | Resolution |
| --- | --- | --- | --- |
| Blocker | The current `main` basis had no runnable Local Test Environment, although C2 requires production-isolated acceptance. | The earlier local-environment work was not part of the C1 release commit. | Restored the hard-gated local environment, deterministic aircraft/SkyGuide fixtures, scenario API, start/stop/audit scripts and permanent UI marking. |
| Major | Flight History “present” could not be exercised: every local aircraft returned unavailable. | The local fixture set contained no historical-track fixture. | Added one Replay/local-only, three-point observed track for `406a3d`; unavailable remains covered by `484516`. |
| Major | Production dependencies contained high-severity advisories. | Next.js was pinned at 16.2.1 and bundled vulnerable PostCSS/Sharp versions. | Updated Next.js and eslint-config-next to 16.2.12 and pinned safe runtime overrides (`postcss` 8.5.25, `sharp` 0.35.3). Production audit: 0 vulnerabilities. |
| Major | A real 390×844 browser rendered against a desktop-sized layout viewport. | The explicit Next.js viewport export omitted `device-width` and `initialScale`. | Added `width: "device-width"` and `initialScale: 1`; runtime HTML and the mobile Live Map were revalidated. |
| Minor | `/skytracker/live` was listed publicly but declared `noindex, nofollow`. | Route metadata contradicted the public sitemap policy. | Removed the contradictory robots override. |
| Minor | Local audit output dirtied the worktree. | Generated `/artifacts` was not ignored. | Added `/artifacts/` to `.gitignore` and ESLint global ignores. |
| Minor | Updated lint rules found a synchronous account state load from an effect. | The effect invoked a state-owning async callback directly. | Split account fetching from state ownership and added unmount-safe asynchronous reconciliation. |
| Observation | Node emits `MODULE_TYPELESS_PACKAGE_JSON` warnings for the TypeScript test files. | The package intentionally has no ESM package type while tests use native strip-types. | Left unchanged; adding package-wide ESM semantics is outside this bugfix and no functional failure occurs. |
| Observation | Full dev-tool audit retains advisories in the eslint-config plugin chain. | The only registry-proposed fix is a breaking/incompatible lint stack; forcing `brace-expansion` or ESLint 10 was proven to break lint. | No unsafe override retained. Runtime/production dependency audit is clean. |
| Observation | Legacy auth compatibility code remains present. | It supports existing account behavior. | No reproduced security or functional defect; intentionally unchanged. |

Totals: 1 Blocker, 3 Majors, 3 Minors, 3 Observations. All actionable
Blocker/Major findings and safe Minors are resolved.

## Technical audit

- MapLibre owns one map lifecycle and cleans listeners, sources, layers and the
  map instance on unmount.
- Motion state remains keyed by stable aircraft ID; implausible movement,
  antimeridian handling and tile-order changes are regression-tested.
- Polling and adaptive tile schedulers use abortable, bounded, non-overlapping
  work; local scenarios do not create provider traffic.
- Search, filters, selection, URL state, favorites, replay and historical track
  retain provider-neutral contracts.
- SkyGuide local mode is deterministic and server-side; production AI,
  weather, web search and credentials are inaccessible in local-test mode.
- Account state reconciliation now ignores completion after unmount.
- No dead public route, duplicate map source/layer, duplicate panel or duplicate
  marker defect was reproduced.

## Fixture matrix

The local audit reports `Checks=13 Passed=13 Failed=0`.

- `normal`: 3 deterministic aircraft.
- `empty`: controlled empty snapshot.
- `stale-cache`: stale snapshot and provenance.
- `timeout`: controlled 504.
- `budget-exceeded`: controlled 503.
- `provider-unavailable`: controlled 503.
- `weatherfixture`: deterministic SkyGuide weather result.
- `guest account`: deterministic local guest contract.
- selected aircraft: SKY551 and SKY553 browser selections.
- Flight History present: SKY553 / `406a3d`, 3 points, 1 segment.
- Flight History unavailable: SKY551 / `484516`, controlled 404.

## Validation

- Frontend tests: 201 passed, 0 failed, 0 skipped.
- Backend tests: 108 passed, 0 failures, 0 errors, 0 skipped.
- Repository ESLint: passed.
- TypeScript: passed (`tsc --noEmit --incremental false`).
- Next.js 16.2.12 production build: passed.
- Production dependency audit: 0 vulnerabilities.
- Local isolation audit: 13/13 passed.
- `git diff --check`: passed.
- Secret scan: no key/private-key pattern found.
- Dependency tree: declared runtime packages resolved; no production
  vulnerability remains.

## Browser acceptance

- Home and product routes load with correct headings, CTA targets and
  navigation.
- Live Map loads the local basemap and 3 aircraft with a permanent
  `Local / Test Data` status.
- Search selected SKY551; URL state, details and map selection stayed aligned.
- Favorite toggling and replay controls worked without a reload.
- SKY553 showed enriched flight context and an observed three-point track.
- Search and Filters were opened/closed repeatedly; no duplicate panel or
  horizontal overflow remained.
- Keyboard-focusable controls, semantic regions, definition lists, status
  regions and real buttons remained present.
- A 390×844 Edge capture confirmed the mobile map, controls and combined
  Details/SkyGuide bottom sheet remain usable without horizontal overflow.
- Desktop browser acceptance showed no duplicate UI, runtime alert, hydration
  failure or MapLibre failure.

## Production impact

There was no production access, provider request, deployment or cloud change.
The local-only routes and fixtures require all local-test gates and are absent
from ordinary production behavior. Release requires a separate Product Owner
gate.

## Remaining points

- The dev-only ESLint plugin dependency advisories need an upstream-compatible
  release; forcing the advertised breaking versions was rejected after local
  incompatibility was demonstrated.
- Native Node test output still contains the harmless module-type warning.

## Conclusion

`C2 TECHNICAL BUG HUNT ACCEPTED`
