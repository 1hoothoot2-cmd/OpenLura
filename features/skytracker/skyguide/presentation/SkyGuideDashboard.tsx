"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  createSkyGuideFoundationResponse,
  SKYGUIDE_ACTIONS,
  SKYGUIDE_PLACEHOLDERS,
  type SkyGuideAction,
} from "../domain/skyGuide";

const DISCOVER_ITEMS = [
  { eyebrow: "Aircraft", title: "What makes the world’s largest aircraft unique?" },
  { eyebrow: "Airports", title: "How does a major hub handle peak traffic?" },
  { eyebrow: "Routes", title: "What determines the world’s longest active flights?" },
  { eyebrow: "Weather", title: "Which conditions make flying more challenging?" },
] as const;

type AnswerState = {
  query: string;
  message: string;
  suggestion?: string;
  accepted: boolean;
  audienceMode: "beginner" | "expert";
} | null;

function ActionIcon({ icon }: { icon: SkyGuideAction["icon"] }) {
  const paths = {
    flight: <path d="m3 16 8-5V4l2-1 1 7 7-2v2l-7 4v5l3 2v1l-5-1-5 1v-1l3-2v-5l-7 3Z" />,
    airport: <><path d="M4 21h16M6 21V9l6-5 6 5v12" /><path d="M9 13h6M9 17h6" /></>,
    aircraft: <><path d="M12 3v17M4 14l8-4 8 4M8 20l4-2 4 2" /><circle cx="12" cy="3" r="1" /></>,
    location: <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    weather: <><path d="M7 17h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 11a3 3 0 0 0 1 6Z" /><path d="M9 20h6" /></>,
    camera: <><path d="M4 8h4l1.5-2h5L16 8h4v11H4Z" /><circle cx="12" cy="13.5" r="3" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none"
      stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
      {paths[icon]}
    </svg>
  );
}

export function SkyGuideDashboard() {
  const [query, setQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const answerId = useId();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % SKYGUIDE_PLACEHOLDERS.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, []);

  const submitQuestion = (event?: FormEvent) => {
    event?.preventDefault();
    const response = createSkyGuideFoundationResponse(query);
    setAnswer({ query: query.trim(), ...response });
  };

  const prepareQuestion = (question: string) => {
    setQuery(question);
    setAnswer(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030711] text-white">
      <header className="border-b border-white/[0.07] bg-[#040711]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/skytracker/live"
            className="ol-interactive inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <span aria-hidden="true" className="text-cyan-200">←</span>
            SkyTracker
          </Link>
          <span className="rounded-full border border-cyan-200/14 bg-cyan-200/[0.045] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-100/65">
            Foundation preview
          </span>
        </div>
      </header>

      <div className="relative isolate overflow-hidden">
        <div aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_38%),radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.1),transparent_34%)]" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-20">
          <section className="mx-auto max-w-3xl text-center" aria-labelledby="skyguide-heading">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/58">
              Aviation Intelligence Assistant
            </p>
            <h1 id="skyguide-heading"
              className="mt-4 text-5xl font-semibold tracking-[-0.055em] text-white/95 sm:text-7xl">
              Welcome to SkyGuide
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/48 sm:text-lg">
              Ask about aircraft, flights, airports and the wider world of aviation.
              SkyGuide keeps every answer focused on the sky.
            </p>

            <form onSubmit={submitQuestion} role="search"
              className="mt-9 flex items-center gap-2 rounded-[22px] border border-cyan-100/16 bg-[#07111d]/88 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.32),0_0_50px_rgba(34,211,238,0.05)] backdrop-blur-xl focus-within:border-cyan-200/32">
              <label htmlFor="skyguide-question" className="sr-only">Ask SkyGuide about aviation</label>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-2 h-5 w-5 shrink-0 text-cyan-100/45"
                fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" />
              </svg>
              <input ref={inputRef} id="skyguide-question" value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={SKYGUIDE_PLACEHOLDERS[placeholderIndex]}
                aria-describedby={answer ? answerId : undefined} autoComplete="off"
                className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-white/90 outline-none placeholder:text-white/30 sm:text-base" />
              <button type="submit"
                className="ol-interactive min-h-11 shrink-0 rounded-2xl bg-gradient-to-r from-cyan-300 to-blue-400 px-4 text-sm font-semibold text-[#03111a] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-5">
                Ask
              </button>
            </form>

            {answer && (
              <div id={answerId} role="status" aria-live="polite"
                className={`mt-4 rounded-2xl border px-5 py-4 text-left ${answer.accepted ? "border-cyan-200/14 bg-cyan-200/[0.045]" : "border-amber-200/14 bg-amber-200/[0.045]"}`}>
                {answer.query && <p className="text-xs font-semibold text-white/72">{answer.query}</p>}
                <p className="mt-1 text-sm leading-6 text-white/58">{answer.message}</p>
                {answer.suggestion && <p className="mt-2 text-xs text-cyan-100/55">{answer.suggestion}</p>}
              </div>
            )}
          </section>

          <section className="mt-14" aria-labelledby="smart-actions-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/48">Start here</p>
                <h2 id="smart-actions-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white/90">Smart actions</h2>
              </div>
              <p className="hidden text-xs text-white/32 sm:block">Choose an idea, then add the detail that matters.</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SKYGUIDE_ACTIONS.map((action) => (
                <button type="button" key={action.id} onClick={() => prepareQuestion(action.prompt)}
                  className="ol-interactive group flex min-h-32 items-start gap-4 rounded-[22px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-5 text-left hover:-translate-y-0.5 hover:border-cyan-200/20 hover:bg-cyan-200/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transform-none">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/13 bg-cyan-200/[0.05] text-cyan-100/72 group-hover:text-cyan-100">
                    <ActionIcon icon={action.icon} />
                  </span>
                  <span>
                    <span className="block text-base font-semibold tracking-[-0.02em] text-white/88">{action.title}</span>
                    <span className="mt-2 block text-sm leading-5 text-white/40">{action.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-16" aria-labelledby="discover-heading">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/48">Explore an idea</p>
            <h2 id="discover-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white/90">Discover</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {DISCOVER_ITEMS.map((item) => (
                <button type="button" key={item.title} onClick={() => prepareQuestion(item.title)}
                  className="ol-interactive rounded-[20px] border border-white/[0.07] bg-[#07101b]/74 p-5 text-left hover:border-cyan-200/16 hover:bg-[#091725] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100/42">{item.eyebrow}</span>
                  <span className="mt-2 block text-sm font-medium leading-6 text-white/70">{item.title}</span>
                </button>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-white/28">
              Discover topics are editorial foundation content. Live news, weather and intelligence sources are not connected yet.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
