# SkyTracker Web L2

L2 adds a static, provider-neutral aircraft rendering path to the L1 map. It
does not fetch, poll, animate, extrapolate, or persist aircraft.

## Aircraft domain

`Aircraft` uses a branded, normalized `AircraftId`; fixtures use fictional
ICAO24-shaped identifiers, never callsigns, as identity. Coordinates and
heading use degrees, altitude uses metres, ground speed uses metres per second,
and position time uses epoch milliseconds. Callsign, registration, heading,
altitude, and speed are explicitly nullable.

The snapshot validator rejects empty or duplicate IDs, out-of-range or
non-finite coordinates/headings, invalid timestamps, and non-finite optional
numbers. Rejected records do not crash the valid remainder of a snapshot.

## Fixtures and presentation

Twelve deterministic development aircraft cover Western Europe. They include
the four cardinal headings, a missing heading, an on-ground aircraft, missing
registrations/callsigns, and several categories. They are fictional and remain
local.

The pure presentation mapper produces coordinates, a normalized rotation,
compact labels, on-ground state, and ID-based selection. Missing heading uses
rotation `0` plus `heading_known=false`; it never reaches MapLibre as `NaN`.

## GeoJSON and MapLibre

The feature factory produces one deterministic `FeatureCollection<Point>`.
Feature IDs are stable aircraft IDs. Properties contain only the renderer
contract: ID, rotation, heading availability, display label, selection, and
on-ground state.

MapLibre owns one GeoJSON source:

- normal cyan aircraft symbol layer;
- subtle normal footprint layer for a stable touch target;
- amber selected glow layer;
- amber selected aircraft symbol layer;
- selected-only label layer.

The aircraft image is generated locally into an SDF canvas image. No DOM marker
or external image URL exists. Map click hit-testing queries only the two
aircraft symbol layers, deduplicates feature hits by ID, and treats an empty-map
click as deselection.

## Source ownership and deduplication

`AircraftMapSourceWriter` is the only `setData` owner. It writes only after the
style, image, source, and layers are installed. A compact deterministic
fingerprint over ordered render properties suppresses content-identical writes.
L2 has only twelve points; the linear fingerprint is bounded. L3 should retain
the ownership contract while replacing or incrementally calculating the
fingerprint for motion frames.

Expected writes:

- one initial fixture write;
- one write for a real selection change;
- no write for an equal presentation state.

All listeners and the writer are disposed before the L1 map instance is
removed.

## L2A.1 initial source write recovery

The production symptom was a healthy basemap and a twelve-aircraft React
snapshot without visible MapLibre aircraft. The sourcewriter registered its
source with the initial collection, then immediately committed that
collection's fingerprint and counted a write without calling
`GeoJSONSource.setData()`. A later attempt with identical content was therefore
deduplicated even though no real sourcewriter write had occurred.

The writer now registers an empty GeoJSON source and immediately attempts the
normal write path. It commits the candidate fingerprint and increments its
write count only after `setData()` has been invoked. If the source is not yet
available, the attempt remains uncommitted and the same collection can be
retried. Remounting creates a fresh writer; disposal rejects all later writes.

Regression coverage proves deferred first write, one retry with identical
content, post-success deduplication, one selection-content update, and disposed
writer behavior. No timeout, polling, retry loop, debug layer, or diagnostic
overlay was added. Final visual acceptance remains a Product Owner check in a
normal Chrome browser.

## L2B render pipeline verification

The remaining invisible-aircraft defect was outside the aircraft data path.
Next/Turbopack emitted MapLibre GL JS 6's ESM worker with a hashed filename,
while the worker retained its relative import of
`./maplibre-gl-shared.mjs`. Only a hashed shared module existed in the build;
the required relative URL returned HTTP 404. The worker therefore never
completed GeoJSON processing: source and layers existed, but
`querySourceFeatures()` returned zero and the map did not reach idle.

SkyTracker now serves the unmodified, version-matched MapLibre worker and shared
module at stable same-origin URLs under `public/maplibre`. The live map calls
`setWorkerUrl()` before constructing MapLibre. No provider, polling, or second
aircraft source was added.

The temporary pipeline probe measured 12 fixtures, 12 validated records, 12
presented records, and 12 GeoJSON points. Before the fix it measured zero source
features, zero debug-circle features, zero symbol features, and no idle event.
After the fix, at 1440×1000, it measured 12 debug circles, 11 normal symbols,
one selected symbol, all 12 unique aircraft IDs, and `idle=true`. The temporary
circle layer, overlay, counters, diagnostic retry, and feature-query listeners
were removed before the final build.

## Selection and URL

React stores only the selected aircraft ID. Selection rewrites the same
FeatureCollection and appears in a compact accessible card. `?aircraft=<id>`
is read on initial navigation and updated with `history.replaceState`, retaining
other query parameters without a reload. Invalid IDs yield no selection.

## Performance and limits

There is no per-aircraft React component, DOM marker, timer, worker, polling,
clustering, backend request, or motion loop. Only the selected ID changes React
state. Labels are selected-only to avoid map clutter.

L2 is fixture-only. It has no alternative accessible aircraft list, detailed
panel, live provider, interpolation, trails, search, filters, favorites, follow,
or accounts. L3 can add a deterministic replay clock and smooth motion above
the same domain/presentation/sourcewriter boundary without adding a second
source owner.
