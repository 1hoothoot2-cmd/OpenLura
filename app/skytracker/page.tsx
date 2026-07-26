import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductLayout } from "@/components/product/ProductLayout";
import { skyTrackerProduct } from "@/products";

export const metadata: Metadata = {
  title: "SkyTracker",
  description:
    "Discover SkyTracker, an Android aircraft tracking experience in active development by OpenLura.",
  alternates: {
    canonical: "/skytracker",
  },
  openGraph: {
    type: "website",
    url: "/skytracker",
    siteName: "OpenLura",
    title: "SkyTracker | OpenLura",
    description:
      "A focused Android aircraft tracking experience with smooth movement, aircraft identity, and flight context.",
    images: [
      {
        url: "/skytracker/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SkyTracker by OpenLura — Aircraft tracking, thoughtfully presented",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SkyTracker | OpenLura",
    description:
      "A focused Android aircraft tracking experience with smooth movement, aircraft identity, and flight context.",
    images: ["/skytracker/opengraph-image"],
  },
};

type IconName =
  | "motion"
  | "search"
  | "favorites"
  | "identity"
  | "trails"
  | "accessibility";

const features: Array<{
  icon: IconName;
  title: string;
  description: string;
}> = [
  {
    icon: "motion",
    title: "Smooth movement",
    description:
      "Aircraft positions transition fluidly between updates, preserving a clear sense of motion.",
  },
  {
    icon: "search",
    title: "Search and follow",
    description:
      "Find locally visible aircraft and keep a selected flight comfortably within view.",
  },
  {
    icon: "favorites",
    title: "Favorites and filters",
    description:
      "Save aircraft locally and refine the map by status, altitude, speed, or favorite status.",
  },
  {
    icon: "identity",
    title: "Aircraft identity",
    description:
      "Review registration, type, manufacturer, operator, and country details when available.",
  },
  {
    icon: "trails",
    title: "Flight trails",
    description:
      "Separate earlier flight context from the route observed during the current SkyTracker session.",
  },
  {
    icon: "accessibility",
    title: "Replay and accessibility",
    description:
      "Offline replay supports deterministic testing alongside TalkBack and larger text.",
  },
];

const focusPoints = [
  {
    label: "Motion",
    title: "Movement that feels continuous",
    description:
      "The map emphasizes the direction and flow of an aircraft instead of treating every update as a separate jump.",
  },
  {
    label: "Interface",
    title: "Information without map clutter",
    description:
      "Selection, aircraft details, trails, and controls are designed to remain understandable in one focused view.",
  },
  {
    label: "Context",
    title: "Useful detail when it matters",
    description:
      "Identity and flight information appear around the selected aircraft without taking over the wider map.",
  },
];

const milestones = [
  {
    eyebrow: "Current",
    title: "Android app in development",
    description:
      "Core aircraft presentation and interaction continue to be refined as one coherent Android experience.",
    state: "active",
  },
  {
    eyebrow: "Completed",
    title: "Internal device testing",
    description:
      "The current product foundation has been tested across real Android-device scenarios through Sprint 8.",
    state: "complete",
  },
  {
    eyebrow: "Next phase",
    title: "Play Store preparation",
    description:
      "Release readiness is the next planned phase. No public availability date has been announced.",
    state: "next",
  },
];

function FeatureIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    motion: (
      <>
        <path d="M4 15.5c3-6 6-8 9-5s4 2 7-3" />
        <path d="m17 6.5 3 1-1 3" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 5 5" />
        <path d="M10.5 8v5M8 10.5h5" />
      </>
    ),
    favorites: (
      <path d="m12 3 2.7 5.46 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88L12 3Z" />
    ),
    identity: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <circle cx="8" cy="11" r="2" />
        <path d="M5.5 16c.7-1.7 1.5-2.5 2.5-2.5s1.8.8 2.5 2.5M13 10h5M13 14h4" />
      </>
    ),
    trails: (
      <>
        <path d="M3 17c3-7 6-9 9-6s5 1 9-5" />
        <circle cx="3" cy="17" r="1.5" />
        <circle cx="12" cy="11" r="1.5" />
        <circle cx="21" cy="6" r="1.5" />
      </>
    ),
    accessibility: (
      <>
        <circle cx="12" cy="4.5" r="1.8" />
        <path d="M5 8.5h14M12 8.5v5M8 21l4-7.5L16 21" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {paths[name]}
    </svg>
  );
}

function AircraftMarker({
  className,
  rotation,
  selected = false,
}: {
  className: string;
  rotation: number;
  selected?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`absolute flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm ${
        selected
          ? "border-amber-200/70 bg-amber-300/12 text-amber-100 shadow-[0_0_0_4px_rgba(251,191,36,0.08),0_0_24px_rgba(251,191,36,0.24)]"
          : "border-cyan-100/30 bg-[#06131e]/85 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
      } ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M12 2.5c.55 0 1 .45 1 1v6.25l6.5 4v1.75l-6.5-2v4.25l2 1.5V21l-3-1-3 1v-1.75l2-1.5V13.5l-6.5 2v-1.75l6.5-4V3.5c0-.55.45-1 1-1Z" />
      </svg>
    </span>
  );
}

function ProductPreview() {
  return (
    <div
      aria-label="Development preview of the SkyTracker Android interface"
      className="relative mx-auto w-full max-w-[620px] lg:translate-x-4"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-12 rounded-full bg-cyan-400/[0.07] blur-[90px]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-5 top-16 h-32 w-32 rounded-full border border-cyan-200/10 bg-cyan-300/[0.025]"
      />

      <div className="relative rounded-[38px] border border-white/14 bg-[linear-gradient(145deg,rgba(29,42,59,0.96),rgba(5,10,18,0.98)_42%,rgba(5,8,15,1))] p-[7px] shadow-[0_44px_100px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-[9px]">
        <div className="flex h-7 items-center justify-center">
          <span className="h-1.5 w-14 rounded-full bg-white/12" />
        </div>

        <div className="relative min-h-[480px] overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#07141f] sm:min-h-[540px]">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(92,164,178,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(92,164,178,0.1)_1px,transparent_1px)] [background-size:44px_44px]"
          />
          <div
            aria-hidden="true"
            className="absolute -left-24 top-10 h-72 w-[430px] rotate-[-10deg] rounded-[48%] border-[22px] border-[#0c2a35]/70"
          />
          <div
            aria-hidden="true"
            className="absolute -right-28 -top-12 h-96 w-96 rounded-[44%] bg-[radial-gradient(circle_at_45%_45%,rgba(18,65,72,0.75),rgba(8,38,47,0.72)_52%,transparent_72%)]"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-[#06111b] to-transparent"
          />

          <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/20 bg-[#04101a]/82 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-50/76 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Development preview
            </span>
            <span className="rounded-full border border-white/10 bg-[#04101a]/82 px-3 py-1.5 text-[9px] font-medium text-white/50 backdrop-blur">
              Android
            </span>
          </div>

          <svg
            aria-hidden="true"
            viewBox="0 0 520 290"
            preserveAspectRatio="none"
            className="absolute inset-x-5 top-24 h-56 w-[calc(100%-2.5rem)] overflow-visible"
          >
            <defs>
              <linearGradient id="historicTrail" x1="0" x2="1">
                <stop offset="0%" stopColor="rgba(96,165,250,0.08)" />
                <stop offset="100%" stopColor="rgba(96,165,250,0.48)" />
              </linearGradient>
              <linearGradient id="sessionTrail" x1="0" x2="1">
                <stop offset="0%" stopColor="rgba(34,211,238,0.45)" />
                <stop offset="100%" stopColor="rgba(103,232,249,0.95)" />
              </linearGradient>
            </defs>
            <path
              d="M8 250 C 72 235, 92 175, 160 185 S 250 225, 302 165"
              fill="none"
              stroke="url(#historicTrail)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M302 165 C 346 120, 356 72, 420 60 S 470 78, 512 38"
              fill="none"
              stroke="url(#sessionTrail)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M8 250 C 72 235, 92 175, 160 185 S 250 225, 302 165"
              fill="none"
              stroke="rgba(147,197,253,0.55)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="5 7"
            />
          </svg>

          <AircraftMarker className="left-[14%] top-[38%]" rotation={26} />
          <AircraftMarker className="right-[15%] top-[27%]" rotation={68} />
          <AircraftMarker
            className="right-[34%] top-[42%]"
            rotation={42}
            selected
          />

          <div className="absolute right-4 top-[39%] flex flex-col gap-2">
            {["+", "−", "⌖"].map((control) => (
              <span
                aria-hidden="true"
                key={control}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#06131e]/80 text-sm text-white/58 shadow-lg backdrop-blur"
              >
                {control}
              </span>
            ))}
          </div>

          <div className="absolute inset-x-3 bottom-3 rounded-[22px] border border-white/12 bg-[linear-gradient(145deg,rgba(9,24,37,0.96),rgba(5,14,24,0.98))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[330px] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-200/54">
                  Selected aircraft
                </p>
                <p className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-white/92">
                  Demonstration
                </p>
                <p className="mt-1 text-[11px] text-white/38">
                  Example interface data
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2.5 py-1 text-[9px] font-medium text-emerald-100/70">
                <span className="h-1 w-1 rounded-full bg-emerald-300" />
                Moving
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3.5">
              {[
                ["Identity", "Available"],
                ["Trail", "Session"],
                ["Mode", "Follow"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[8px] uppercase tracking-[0.12em] text-white/30">
                    {label}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-white/66">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex h-7 items-center justify-center">
          <span className="h-1 w-20 rounded-full bg-white/14" />
        </div>
      </div>

      <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-white/10 bg-[#09121f]/88 px-4 py-3 shadow-2xl backdrop-blur-xl sm:block">
        <p className="text-[9px] uppercase tracking-[0.16em] text-white/34">
          Presentation
        </p>
        <p className="mt-1 text-xs font-medium text-white/76">
          Selected-only detail
        </p>
      </div>
    </div>
  );
}

export default function SkyTrackerPage() {
  return (
    <ProductLayout product={skyTrackerProduct}>

      <section
        aria-labelledby="skytracker-heading"
        className="relative overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[880px] bg-[radial-gradient(circle_at_73%_13%,rgba(34,211,238,0.13),transparent_35%),radial-gradient(circle_at_25%_8%,rgba(37,99,235,0.16),transparent_39%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/18 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[8%] top-24 h-72 w-72 rounded-full border border-blue-200/[0.035]"
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-16 px-4 pb-24 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-20 lg:px-8 lg:pb-32 lg:pt-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/18 bg-amber-200/[0.055] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-amber-100/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.55)]"
              />
              Android app in development
            </div>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/58">
              Aircraft tracking, thoughtfully presented
            </p>
            <h1
              id="skytracker-heading"
              className="mt-4 bg-gradient-to-br from-white via-white to-cyan-100/58 bg-clip-text text-6xl font-semibold leading-[0.96] tracking-[-0.06em] text-transparent sm:text-7xl lg:text-[5.3rem]"
            >
              SkyTracker
            </h1>
            <p className="mt-7 max-w-xl text-xl leading-8 tracking-[-0.02em] text-white/72 sm:text-2xl sm:leading-9">
              A modern aircraft tracking experience built for people who want
              to explore the sky with clarity.
            </p>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/43">
              Follow smooth aircraft movement, inspect useful details, and
              understand recent flight context in one focused Android
              interface.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#status"
                className="ol-interactive inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-sm font-semibold text-[#03111a] shadow-[0_14px_38px_rgba(34,211,238,0.2)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:brightness-110 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04050c]"
              >
                Follow development
                <span aria-hidden="true" className="ml-2">
                  ↓
                </span>
              </a>
              <Link
                href="/"
                className="ol-interactive inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] px-6 py-3 text-sm font-medium text-white/68 motion-safe:hover:-translate-y-0.5 hover:border-white/22 hover:bg-white/[0.06] hover:text-white motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04050c]"
              >
                Back to OpenLura
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-white/[0.07] pt-6">
              {[
                ["Platform", "Android"],
                ["Stage", "Internal"],
                ["Access", "Not public"],
              ].map(([term, detail]) => (
                <div key={term}>
                  <dt className="text-[9px] uppercase tracking-[0.15em] text-white/28">
                    {term}
                  </dt>
                  <dd className="mt-1.5 text-xs font-medium text-white/62">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section
        aria-labelledby="features-heading"
        className="relative border-y border-white/[0.06] bg-white/[0.012]"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/52">
                Current product foundation
              </p>
              <h2
                id="features-heading"
                className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white/94 sm:text-5xl"
              >
                Designed around the aircraft experience
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-white/42 lg:justify-self-end">
              Each part of SkyTracker supports the same goal: make aircraft
              movement and context easy to understand without overwhelming the
              map.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group rounded-[24px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[transform,border-color,background-color,box-shadow] duration-200 motion-safe:hover:-translate-y-1 hover:border-cyan-200/15 hover:bg-cyan-200/[0.025] hover:shadow-[0_18px_50px_rgba(0,0,0,0.18)] motion-reduce:transition-none sm:p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/12 bg-cyan-200/[0.045] text-cyan-100/64 transition-colors group-hover:border-cyan-200/22 group-hover:text-cyan-100">
                  <FeatureIcon name={feature.icon} />
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-[-0.025em] text-white/88">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/43">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="why-heading" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 top-8 h-96 w-96 rounded-full bg-blue-500/[0.05] blur-[100px]"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.68fr_1.32fr] lg:gap-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/52">
                Product focus
              </p>
              <h2
                id="why-heading"
                className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white/94 sm:text-5xl"
              >
                Why SkyTracker?
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-white/43">
                Aircraft data becomes more useful when motion, identity, and
                context are presented as one calm, coherent experience.
              </p>
            </div>

            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {focusPoints.map((point, index) => (
                <article
                  key={point.label}
                  className="grid gap-4 py-7 sm:grid-cols-[80px_0.7fr_1fr] sm:items-start sm:gap-7"
                >
                  <p className="font-mono text-xs text-cyan-100/35">
                    0{index + 1}
                  </p>
                  <h3 className="text-lg font-semibold leading-6 tracking-[-0.025em] text-white/82">
                    {point.title}
                  </h3>
                  <p className="text-sm leading-6 text-white/40">
                    {point.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="status"
        aria-labelledby="status-heading"
        className="scroll-mt-6 border-y border-white/[0.06] bg-[linear-gradient(180deg,rgba(13,22,39,0.52),rgba(5,7,15,0.82))]"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:px-8 lg:py-28">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/52">
              Development status
            </p>
            <h2
              id="status-heading"
              className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.045em] text-white/94 sm:text-5xl"
            >
              Built carefully, tested honestly
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/43">
              SkyTracker remains in active Android development. The current
              experience is not yet available as a public download, and there
              is no web version.
            </p>
            <a
              href="#openlura"
              className="mt-7 inline-flex min-h-11 items-center rounded-full border border-white/10 px-5 text-sm font-medium text-white/58 transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none"
            >
              About OpenLura
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </a>
          </div>

          <ol className="relative space-y-4 before:absolute before:bottom-8 before:left-[19px] before:top-8 before:w-px before:bg-gradient-to-b before:from-cyan-300/45 before:via-blue-300/18 before:to-transparent">
            {milestones.map((milestone) => (
              <li
                key={milestone.title}
                className="relative grid grid-cols-[40px_1fr] gap-4 rounded-[24px] border border-white/[0.075] bg-[#080d18]/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:gap-6 sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className={`relative z-10 mt-1 flex h-10 w-10 items-center justify-center rounded-full border ${
                    milestone.state === "active"
                      ? "border-cyan-200/35 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                      : milestone.state === "complete"
                        ? "border-emerald-200/25 bg-emerald-300/[0.07]"
                        : "border-white/12 bg-white/[0.035]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      milestone.state === "active"
                        ? "bg-cyan-200"
                        : milestone.state === "complete"
                          ? "bg-emerald-200/80"
                          : "bg-white/28"
                    }`}
                  />
                </span>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/32">
                    {milestone.eyebrow}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white/86">
                    {milestone.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/41">
                    {milestone.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="openlura"
        aria-labelledby="openlura-heading"
        className="scroll-mt-6"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative overflow-hidden rounded-[30px] border border-blue-200/12 bg-[linear-gradient(135deg,rgba(15,30,55,0.82),rgba(7,12,24,0.94)_56%,rgba(5,7,15,0.98))] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.25)] sm:p-10 lg:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-cyan-400/[0.08] blur-[80px]"
            />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-end">
              <div>
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[13px] border border-blue-300/16 bg-blue-300/[0.05]">
                  <Image
                    src="/openlura-logo.png"
                    alt=""
                    width={44}
                    height={44}
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/52">
                  Part of OpenLura
                </p>
                <h2
                  id="openlura-heading"
                  className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-white/92 sm:text-4xl"
                >
                  The first specialized product within OpenLura
                </h2>
              </div>
              <div>
                <p className="text-base leading-7 text-white/46">
                  Every OpenLura product uses technology designed around its
                  own domain. SkyTracker applies that approach to the details,
                  movement, and interaction patterns of aircraft tracking.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/"
                    className="ol-interactive inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#07101b] motion-safe:hover:-translate-y-0.5 hover:bg-cyan-50 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1529]"
                  >
                    Back to OpenLura
                  </Link>
                  <Link
                    href="/privacy"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 px-6 text-sm font-medium text-white/58 transition-colors hover:border-white/22 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 motion-reduce:transition-none"
                  >
                    Privacy and data
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </ProductLayout>
  );
}
