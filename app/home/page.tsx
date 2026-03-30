"use client";

import Link from "next/link";
import { useState } from "react";

const chapterLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#system-status", label: "System status" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#why-openlura", label: "Why OpenLura" },
  { href: "#plans", label: "Plans" },
  { href: "#security", label: "Security" },
  { href: "#account-flow", label: "Account flow" },
  { href: "#changelog", label: "Changelog" },
];

function SectionFooter({
  nextHref,
  nextLabel,
}: {
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-3 pt-8">
      {nextHref && nextLabel ? (
        <a
          href={nextHref}
          className="inline-flex items-center justify-center rounded-full border border-[#3b82f6]/18 bg-[#3b82f6]/10 px-5 py-2 text-sm font-medium text-blue-200 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-[#60a5fa]/30 hover:bg-[#3b82f6]/14 hover:text-white hover:shadow-[0_14px_28px_rgba(59,130,246,0.16)]"
        >
          Continue to {nextLabel}
        </a>
      ) : null}

      <a
        href="#top"
        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-white/58 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_10px_22px_rgba(0,0,0,0.12)]"
      >
        Back to top
      </a>
    </div>
  );
}

export default function HomePage() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  return (
    <main
      id="top"
      className="min-h-screen overflow-x-hidden bg-[#050510] text-white"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="w-full">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/50">
            OpenLura
          </div>

          <h1 className="mt-6 max-w-4xl bg-gradient-to-r from-white via-white to-white/68 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
            AI that learns how you work.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
            OpenLura is your adaptive AI workspace. It remembers useful context,
            improves through feedback, and helps you move faster with less noise.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
           <Link
  href="/chat"
  className="inline-flex h-12 items-center justify-center rounded-[18px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-6 text-sm font-medium text-white shadow-[0_12px_28px_rgba(59,130,246,0.24)] ol-interactive transition-[transform,filter,box-shadow] duration-200 hover:brightness-110 hover:shadow-[0_14px_32px_rgba(59,130,246,0.28)] active:scale-[0.99]"
>
  Start chat
</Link>

            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-6 text-sm font-medium text-white/88 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-[#3b82f6]/30 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.99]"
            >
              See how it works
            </Link>
          </div>

          <div className="mt-8 flex flex-col items-start gap-3">
            <div className="flex flex-wrap gap-2">
              {chapterLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/62 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-[#3b82f6]/26 hover:bg-[#3b82f6]/10 hover:text-white hover:shadow-[0_10px_24px_rgba(59,130,246,0.14)]"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/56 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-amber-400/26 hover:bg-amber-400/10 hover:text-amber-200 hover:shadow-[0_10px_24px_rgba(251,191,36,0.12)]"
            >
              Give feedback
            </button>
          </div>
        </div>

                    <div className="mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
            <Link
              href="/chat"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="text-sm font-medium text-white">Start chat</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Open the core assistant workspace.
              </div>
            </Link>

            <Link
              href="#how-it-works"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-[#3b82f6]/24 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(59,130,246,0.10)]"
            >
              <div className="text-sm font-medium text-white">How it works</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Learn how OpenLura adapts, remembers, and improves.
              </div>
            </Link>

            <Link
              href="#use-cases"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-[#3b82f6]/24 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(59,130,246,0.10)]"
            >
              <div className="text-sm font-medium text-white">Use cases</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Explore what you can do with OpenLura.
              </div>
            </Link>
          </div>

          <div className="mt-16 h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* PRODUCT OVERVIEW */}
          <section
            id="how-it-works"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-4xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                How OpenLura works
              </h2>
              <p className="mt-2 text-sm text-white/50">
                Built to adapt, remember, and improve over time.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">
                  Learns from context
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Understands your conversations and builds useful context over time.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">
                  Improves with feedback
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Uses your feedback to continuously refine how it responds.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">
                  Personal by design
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Adapts to your style, preferences, and workflows.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#roadmap" nextLabel="Roadmap" />
          </section>

          {/* ROADMAP */}
          <section
            id="roadmap"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                Where OpenLura is going
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Built in phases, with clarity, privacy, and product quality first.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Foundation</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Complete
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Core chat, system architecture, and learning base.
                </p>
              </div>

              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Smarter AI</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Complete
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Memory, feedback loops, and continuous improvement.
                </p>
              </div>

              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Secure by Design</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Complete
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Private environments, data isolation, and protection.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Experience</div>
                  <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                    In progress
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Homepage, onboarding, and product clarity.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Personal AI</div>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/60">
                    Coming next
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Private AI environments tailored to each user.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Expansion</div>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/60">
                    Future
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Voice, image tools, and mobile apps.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#system-status" nextLabel="System status" />
          </section>

          {/* SYSTEM STATUS */}
          <section
            id="system-status"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                System status
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                A simple view of current product readiness across core OpenLura flows.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Chat workspace</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Operational
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Core chat access and primary assistant flow are available.
                </p>
              </div>

              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Learning systems</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Operational
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Context, feedback foundations, and adaptive behavior are in place.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Feedback intake</div>
                  <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                    In progress
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Feedback entry is live in the interface and backend wiring comes next.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#use-cases" nextLabel="Use cases" />
          </section>

          {/* USE CASES */}
          <section
            id="use-cases"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                Use cases
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Practical ways to use OpenLura across everyday work and thinking.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Writing and rewriting</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Draft ideas faster, improve clarity, and refine content without losing your tone.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Research support</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Break down topics, organize findings, and turn scattered notes into direction.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Workflow thinking</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Use OpenLura to structure tasks, plan next steps, and reduce decision friction.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Idea development</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Explore concepts, test directions, and expand rough thoughts into usable output.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Learning as you go</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Get help understanding topics while building context over time through interaction.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Daily AI workspace</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Keep one consistent place for asking, refining, planning, and moving work forward.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#why-openlura" nextLabel="Why OpenLura" />
          </section>

          {/* WHY OPENLURA */}
          <section
            id="why-openlura"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                Why OpenLura
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Built for clarity, continuity, and a more useful AI experience over time.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Less noise</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Focused help without unnecessary complexity or distracting product clutter.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Context that carries forward</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Conversations become more useful as context builds across continued use.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Improves through feedback</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Feedback helps shape a sharper, more aligned experience over time.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Designed for real work</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Made to support thinking, writing, planning, and everyday execution.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#plans" nextLabel="Plans" />
          </section>

          {/* PLANS */}
          <section
            id="plans"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                Plans
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Start simple with Free or move deeper with Go as OpenLura evolves.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">Free</div>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      A simple starting point for exploring the core OpenLura experience.
                    </p>
                  </div>

                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/60">
                    Available now
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-white/50" />
                    <p className="text-sm leading-6 text-white/72">
                      Core chat access
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-white/50" />
                    <p className="text-sm leading-6 text-white/72">
                      Basic usage and product exploration
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-white/50" />
                    <p className="text-sm leading-6 text-white/72">
                      Clean starting flow with no extra setup
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-white/50" />
                    <p className="text-sm leading-6 text-white/72">
                      Good for getting familiar with OpenLura
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-blue-400/16 bg-gradient-to-b from-[#0d1733] to-[#0a1022] p-6 shadow-[0_18px_40px_rgba(29,78,216,0.12)] backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">Go</div>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Built for more consistent usage, deeper workflows, and a stronger product experience over time.
                    </p>
                  </div>

                  <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-blue-300">
                    Evolving
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-300" />
                    <p className="text-sm leading-6 text-white/78">
                      More capable overall experience
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-300" />
                    <p className="text-sm leading-6 text-white/78">
                      Better depth for repeat usage and ongoing work
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-300" />
                    <p className="text-sm leading-6 text-white/78">
                      Expanded product value as features continue to grow
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-300" />
                    <p className="text-sm leading-6 text-white/78">
                      Designed for users who want more from OpenLura over time
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <SectionFooter nextHref="#security" nextLabel="Security" />
          </section>

          {/* SECURITY */}
          <section
            id="security"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                Security
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Built with privacy, separation, and responsible product design in mind.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Private by default</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Core product flows are designed to keep user interactions scoped and protected.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Separated environments</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Clear boundaries help keep users, data, and product contexts properly separated.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Access-aware design</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Sensitive flows are approached with controlled access and product safety in mind.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">Security-first foundation</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Protection is built into the product foundation rather than added later.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#account-flow" nextLabel="Account flow" />
          </section>

          {/* ACCOUNT FLOW */}
          <section
            id="account-flow"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                Account flow
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                A simple path from getting started to using OpenLura with more continuity over time.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-sm font-medium text-white/78">
                  1
                </div>
                <div className="text-sm font-medium text-white">Start</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  OpenLura is easy to try and explore from the first visit.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-sm font-medium text-white/78">
                  2
                </div>
                <div className="text-sm font-medium text-white">Create your account</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Set up access when you want a more consistent experience over time.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-sm font-medium text-white/78">
                  3
                </div>
                <div className="text-sm font-medium text-white">Keep your flow going</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Return to the same workspace and continue with more continuity.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-sm font-medium text-white/78">
                  4
                </div>
                <div className="text-sm font-medium text-white">Grow over time</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  As OpenLura evolves, the experience becomes more useful and more connected.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#changelog" nextLabel="Changelog" />
          </section>

          {/* CHANGELOG */}
          <section
            id="changelog"
            className="section-panel scroll-mt-24 mt-16 w-full max-w-5xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                Changelog
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                A simple view of recent product progress as OpenLura continues to evolve.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center rounded-full border border-emerald-400/16 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-300">
                      Recent progress
                    </div>

                    <h2 className="mt-4 text-xl font-semibold text-white/92">
                      Homepage structure expanded
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-white/50">
                      OpenLura now includes a more complete homepage flow focused on clarity, trust, and product direction.
                    </p>
                  </div>

                  <div className="text-sm text-white/42">
                    Phase 4.4
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">Homepage flow</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      Hero, quick actions, and supporting product sections now work as one narrative.
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">Roadmap visibility</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      Users can now see where OpenLura is heading without extra navigation.
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">Feedback entry</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      A dedicated feedback modal improves product input without sending users into chat.
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">Trust layers</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      Plans, security, system status, and account flow now add clearer product confidence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <SectionFooter />
          </section>

          <div className="mt-20 w-full max-w-5xl">
            <div className="overflow-hidden rounded-[28px] border border-[#3b82f6]/14 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_38%),rgba(255,255,255,0.03)] p-6 shadow-[0_20px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center rounded-full border border-[#3b82f6]/18 bg-[#3b82f6]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300">
                    Ready to try OpenLura
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold text-white/95 sm:text-3xl">
                    Start where the value is strongest: the chat.
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-white/58 sm:text-base">
                    Skip the noise, open the workspace, and let OpenLura help you think,
                    write, plan, and move faster.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/chat"
                    className="inline-flex h-12 items-center justify-center rounded-[18px] bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] px-6 text-sm font-medium text-white shadow-[0_14px_34px_rgba(59,130,246,0.28)] ol-interactive transition-[transform,filter,box-shadow] duration-200 hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_18px_40px_rgba(59,130,246,0.34)] active:scale-[0.99]"
                  >
                    Open chat
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsFeedbackOpen(true)}
                    className="inline-flex h-12 items-center justify-center rounded-[18px] border border-amber-400/16 bg-amber-400/10 px-6 text-sm font-medium text-amber-200 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-amber-400/24 hover:bg-amber-400/14 hover:text-amber-100 hover:shadow-[0_10px_24px_rgba(251,191,36,0.12)] active:scale-[0.99]"
                  >
                    Give feedback
                  </button>

                  <a
                    href="#top"
                    className="inline-flex h-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-6 text-sm font-medium text-white/86 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/14 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.10)] active:scale-[0.99]"
                  >
                    Back to top
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          html {
            scroll-behavior: smooth;
            scroll-snap-type: y proximity;
          }

          .section-panel {
            position: relative;
            min-height: 88vh;
            scroll-snap-align: start;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding-top: 3.5rem;
            padding-bottom: 3.5rem;
          }

          .section-panel::before {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 1px;
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(255, 255, 255, 0.08) 20%,
              rgba(59, 130, 246, 0.18) 50%,
              rgba(255, 255, 255, 0.08) 80%,
              transparent 100%
            );
          }

          .section-panel:target {
            animation: openluraSectionFocus 560ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          .section-panel:target::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: 28px;
            pointer-events: none;
            box-shadow:
              inset 0 0 0 1px rgba(59, 130, 246, 0.14),
              0 0 0 1px rgba(59, 130, 246, 0.08),
              0 30px 80px rgba(59, 130, 246, 0.10);
          }

          @keyframes openluraSectionFocus {
            0% {
              opacity: 0.6;
              transform: translateY(28px) scale(0.985);
              filter: saturate(0.88);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: saturate(1);
            }
          }

          @media (max-width: 767px) {
            html {
              scroll-snap-type: none;
            }

            .section-panel {
              min-height: auto;
              padding-top: 0.5rem;
              padding-bottom: 0.5rem;
            }

            .section-panel:target::after {
              display: none;
            }
          }

          * {
            scrollbar-width: thin;
            scrollbar-color: #3b82f6 rgba(255, 255, 255, 0.08);
          }

          *::-webkit-scrollbar {
            width: 10px;
          }

          *::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
          }

          *::-webkit-scrollbar-thumb {
            border-radius: 999px;
            border: 2px solid rgba(5, 5, 16, 0.9);
            background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 100%);
            box-shadow:
              0 0 0 1px rgba(59, 130, 246, 0.18),
              0 0 18px rgba(59, 130, 246, 0.22);
          }

          *::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 100%);
            box-shadow:
              0 0 0 1px rgba(59, 130, 246, 0.24),
              0 0 22px rgba(59, 130, 246, 0.28);
          }
        `}</style>

        {isFeedbackOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <button
              type="button"
              aria-label="Close feedback modal"
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            <div className="relative z-10 w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0b0b17] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border border-amber-400/16 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">
                    Feedback
                  </div>

                  <h2 className="mt-4 text-xl font-semibold text-white/92">
                    Help improve OpenLura
                  </h2>

                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/50">
                    Share bugs, confusing behavior, or product ideas.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white"
                >
                  ×
                </button>
              </div>

              <form className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/88">
                    Subject
                  </label>
                  <input
                    type="text"
                    placeholder="Bug, feedback, or idea"
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 transition-colors duration-200 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/88">
                    Details
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Tell us what happened or what could be improved"
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 transition-colors duration-200 focus:border-white/20"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-white/78 transition-[background-color,border-color,color] duration-200 hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-[16px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(59,130,246,0.24)] transition-[transform,filter,box-shadow] duration-200 hover:brightness-110 hover:shadow-[0_14px_32px_rgba(59,130,246,0.28)] active:scale-[0.99]"
                  >
                    Send feedback
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </main>
  );
}