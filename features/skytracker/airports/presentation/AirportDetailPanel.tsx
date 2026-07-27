import type { AirportDetails } from "../domain/airport";

type AirportDetailPanelProps = {
  details: AirportDetails;
  favorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onShowOnMap: () => void;
};

export function AirportDetailPanel({
  details,
  favorite,
  onClose,
  onToggleFavorite,
  onShowOnMap,
}: AirportDetailPanelProps) {
  const { airport } = details;
  const codes = [airport.iataCode, airport.icaoCode].filter(Boolean).join(" / ");

  return (
    <aside
      aria-labelledby="airport-detail-title"
      className="absolute bottom-3 left-3 z-20 max-h-[min(76vh,44rem)] w-[min(27rem,calc(100%-1.5rem))] overflow-y-auto rounded-[24px] border border-cyan-200/16 bg-[#07101b]/94 shadow-[0_22px_65px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:bottom-5 sm:left-5 lg:left-7"
    >
      <div className="relative min-h-32 overflow-hidden rounded-t-[23px] border-b border-white/[0.07] bg-[radial-gradient(circle_at_78%_20%,rgba(34,211,238,0.18),transparent_38%),linear-gradient(145deg,#0b2033,#07101b_62%)] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/54">
          Airport
        </p>
        <h2
          id="airport-detail-title"
          className="mt-3 max-w-sm text-xl font-semibold tracking-[-0.025em] text-white/94"
        >
          {airport.name}
        </h2>
        <p className="mt-2 text-sm text-white/52">
          {[details.city, countryName(airport.countryCode)]
            .filter(Boolean)
            .join(", ") || "Location unavailable"}
        </p>
        {codes && (
          <p className="mt-3 font-mono text-xs tracking-[0.12em] text-cyan-100/72">
            {codes}
          </p>
        )}
      </div>

      <div className="space-y-5 p-5">
        <section aria-labelledby="airport-information-heading">
          <h3
            id="airport-information-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38"
          >
            Airport information
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Detail label="Elevation" value={meters(details.elevationMeters)} />
            <Detail label="Timezone" value={details.timezone ?? "Not available"} />
            <Detail
              label="Coordinates"
              value={`${airport.latitudeDegrees.toFixed(4)}, ${airport.longitudeDegrees.toFixed(4)}`}
              wide
            />
          </dl>
        </section>

        <section aria-labelledby="airport-runways-heading">
          <h3
            id="airport-runways-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38"
          >
            Runways
          </h3>
          {details.runways.length === 0 ? (
            <Placeholder>Runway information is not available yet.</Placeholder>
          ) : (
            <div className="mt-3 grid gap-2">
              {details.runways.map((runway) => (
                <div
                  key={runway.designation}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2"
                >
                  <p className="text-sm font-medium text-white/82">
                    Runway {runway.designation}
                  </p>
                  <p className="mt-1 text-xs text-white/42">
                    {meters(runway.lengthMeters)} ·{" "}
                    {runway.surface ?? "Surface unknown"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="airport-traffic-heading">
          <h3
            id="airport-traffic-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38"
          >
            Live traffic
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Placeholder title="Arrivals">
              Arrival information is not available yet.
            </Placeholder>
            <Placeholder title="Departures">
              Departure information is not available yet.
            </Placeholder>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={
              favorite
                ? "Remove airport from favorites"
                : "Add airport to favorites"
            }
            onClick={onToggleFavorite}
            className="ol-interactive min-h-11 rounded-full border border-amber-200/18 bg-amber-200/[0.06] px-4 text-sm font-medium text-amber-100 hover:bg-amber-200/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {favorite ? "★ Favorite" : "☆ Add Favorite"}
          </button>
          <button
            type="button"
            onClick={onShowOnMap}
            className="ol-interactive min-h-11 rounded-full border border-cyan-200/18 bg-cyan-200/[0.08] px-4 text-sm font-medium text-cyan-50 hover:bg-cyan-200/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Show on map
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ol-interactive min-h-11 rounded-full border border-white/10 px-4 text-sm text-white/68 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Close airport
          </button>
        </div>
      </div>
    </aside>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 ${wide ? "col-span-2" : ""}`}
    >
      <dt className="text-[10px] uppercase tracking-[0.12em] text-white/34">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-white/72">{value}</dd>
    </div>
  );
}

function Placeholder({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-white/40">
      {title && <p className="mb-1 font-medium text-white/62">{title}</p>}
      <p>{children}</p>
    </div>
  );
}

function meters(value: number | null) {
  return value === null ? "Not available" : `${Math.round(value)} m`;
}

function countryName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
