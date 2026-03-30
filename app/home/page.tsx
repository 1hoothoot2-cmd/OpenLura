"use client";

import Link from "next/link";
import { useState } from "react";

export default function HomePage() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  return (
    <main className="min-h-screen bg-[#050510] text-white">
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
              href="/home"
              className="inline-flex h-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-6 text-sm font-medium text-white/88 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/14 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.99]"
            >
              See how it works
            </Link>
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
              href="/home"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="text-sm font-medium text-white">How it works</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Learn how OpenLura adapts, remembers, and improves.
              </div>
            </Link>

            <Link
              href="/home"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="text-sm font-medium text-white">Use cases</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Explore what you can do with OpenLura.
              </div>
            </Link>
          </div>

          {/* PRODUCT OVERVIEW */}
          <div className="mt-16 w-full max-w-4xl">
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
          </div>

          {/* ROADMAP */}
          <div className="mt-16 w-full max-w-5xl">
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
          </div>

          {/* BUG CHANNEL */}
          <div className="mt-16 w-full max-w-4xl">
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center rounded-full border border-amber-400/16 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">
                    Feedback channel
                  </div>

                  <h2 className="mt-4 text-xl font-semibold text-white/92">
                    Found a bug or something unclear?
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Share issues, unclear behavior, or ideas to improve OpenLura.
                    Your feedback helps shape the product as it evolves.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(true)}
                  className="inline-flex h-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] px-6 text-sm font-medium text-white/88 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/14 hover:bg-white/[0.07] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.12)] active:scale-[0.99]"
                >
                  Give feedback
                </button>
              </div>
            </div>
          </div>

          {/* SYSTEM STATUS */}
          <div className="mt-16 w-full max-w-5xl">
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
          </div>

          {/* USE CASES */}
          <div className="mt-16 w-full max-w-5xl">
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
          </div>
        </div>

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