import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050510] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.16),transparent_58%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-72 h-80 w-80 rounded-full bg-blue-700/[0.06] blur-[100px]"
      />

      <nav
        aria-label="Primary navigation"
        className="relative z-20 border-b border-white/[0.06] bg-[#050510]/88 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-[#3b82f6]/20 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.18),rgba(29,78,216,0.06)_52%,transparent_78%)]">
              <Image
                src="/openlura-logo.png"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-sm font-semibold tracking-[-0.02em] text-white/92">
              OpenLura
            </span>
          </div>

          <Link
            href="/skytracker"
            className="rounded-full px-3 py-2 text-sm font-medium text-white/64 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050510]"
          >
            SkyTracker
          </Link>
        </div>
      </nav>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8 lg:pt-24">
        <section aria-labelledby="homepage-title" className="max-w-3xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-blue-300/70">
            Specialized AI products
          </p>
          <h1
            id="homepage-title"
            className="bg-gradient-to-r from-white via-white to-white/64 bg-clip-text text-5xl font-semibold tracking-[-0.04em] text-transparent sm:text-6xl lg:text-7xl"
          >
            OpenLura
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-white/72 sm:text-2xl sm:leading-9">
            Building specialized AI products around real interests.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/48">
            OpenLura develops focused AI-powered products designed around
            specific hobbies, interests, and real-world use cases.
          </p>

          <div className="mt-8">
            <Link
              href="/skytracker"
              className="ol-interactive inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_28px_rgba(59,130,246,0.28)] hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050510]"
            >
              Explore SkyTracker
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="skytracker-title"
          className="mt-16 sm:mt-20"
        >
          <article className="ol-surface relative overflow-hidden rounded-[28px] border border-blue-400/16 bg-[linear-gradient(145deg,rgba(13,23,51,0.94),rgba(10,16,34,0.9)_54%,rgba(5,5,16,0.96))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-9 lg:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-500/10 blur-[80px]"
            />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-400/[0.07] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-300/80">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  />
                  First OpenLura product
                </div>
                <h2
                  id="skytracker-title"
                  className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-white/94 sm:text-4xl"
                >
                  SkyTracker
                </h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-white/56">
                  A modern aircraft tracking experience built for people who
                  want to explore the sky with clarity.
                </p>

                <ul className="mt-7 grid gap-3 text-sm text-white/68 sm:grid-cols-2">
                  {[
                    "Live aircraft",
                    "Smooth tracking",
                    "Detailed aircraft information",
                    "Intelligent features",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/skytracker"
                className="ol-interactive inline-flex min-h-11 w-full items-center justify-center rounded-full border border-blue-300/22 bg-blue-400/10 px-6 py-3 text-sm font-medium text-blue-100 hover:-translate-y-0.5 hover:border-blue-300/36 hover:bg-blue-400/16 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1022] sm:w-auto"
              >
                Open SkyTracker
                <span aria-hidden="true" className="ml-2">
                  →
                </span>
              </Link>
            </div>
          </article>

          <p className="mt-6 text-center text-sm text-white/34">
            More AI-powered products are currently in development.
          </p>
        </section>
      </div>

      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/privacy"
            className="text-sm text-white/38 transition-colors duration-200 hover:text-white/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050510]"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}
