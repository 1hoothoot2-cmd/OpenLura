"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  SKYGUIDE_ACTIONS,
  SKYGUIDE_PLACEHOLDERS,
  type SkyGuideAction,
  type SkyGuideContext,
} from "../domain/skyGuide";
import type { SkyGuideAnswer } from "../application/skyGuideAssistant";
import {
  askSkyGuide,
  type SkyGuideClientResult,
} from "../infrastructure/skyGuideClient";

const DISCOVER_ITEMS = [
  "What makes the world’s largest aircraft unique?",
  "How does a major hub handle peak traffic?",
  "What determines the world’s longest active flights?",
  "Which conditions make flying more challenging?",
] as const;

type SkyGuidePanelProps = {
  context: SkyGuideContext;
};

type ConversationItem = {
  id: number;
  question: string;
  result: SkyGuideClientResult;
};

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
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"
      fill="none" stroke="currentColor" strokeWidth="1.55"
      strokeLinecap="round" strokeLinejoin="round">
      {paths[icon]}
    </svg>
  );
}

export function SkyGuidePanel({ context }: SkyGuidePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const answerId = useId();

  useEffect(() => {
    const interval = window.setInterval(
      () => setPlaceholderIndex((current) => (current + 1) % SKYGUIDE_PLACEHOLDERS.length),
      7000,
    );
    return () => window.clearInterval(interval);
  }, []);

  const prepareQuestion = (question: string) => {
    setQuery(question);
    setActionsOpen(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submitQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    const submittedQuery = query.trim();
    if (!submittedQuery) return;
    setIsLoading(true);
    const nextResult = await askSkyGuide(submittedQuery, context);
    setConversation((items) => [
      ...items,
      { id: Date.now(), question: submittedQuery, result: nextResult },
    ].slice(-12));
    setQuery("");
    setIsLoading(false);
  };

  const contextLabel = context.selectedAircraft
    ? `Selected: ${context.selectedAircraft.callsign ?? context.selectedAircraft.registration ?? context.selectedAircraft.id.toUpperCase()}`
    : context.map
      ? `Map near ${context.map.centerLatitudeDegrees.toFixed(1)}°, ${context.map.centerLongitudeDegrees.toFixed(1)}°`
      : "Live map context";

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-expanded="false"
        onClick={() => setIsOpen(true)}
        className="ol-interactive flex min-h-12 w-full items-center justify-between rounded-2xl border border-cyan-100/15 bg-[#07141d]/92 px-4 py-3 text-left shadow-[0_16px_48px_rgba(0,0,0,.35)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <span>
          <span className="block text-sm font-semibold text-white/90">SkyGuide</span>
          <span className="block text-[10px] text-cyan-100/50">
            {conversation.length > 0 ? "Continue with SkyGuide" : "Use SkyGuide Free"}
          </span>
        </span>
        <span aria-hidden="true" className="text-cyan-200/65">+</span>
      </button>
    );
  }

  const latestStatus = [...conversation].reverse().find(
    (item) => item.result.kind === "answered",
  );
  const status = latestStatus?.result.kind === "answered"
    ? latestStatus.result.answer.status ?? "cached"
    : conversation.length > 0
      ? "offline"
      : "ready";

  return (
    <div className="text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/48">
          Aviation Intelligence Assistant
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-white/92">
          SkyGuide
        </h2>
        <p className="mt-1 text-xs text-white/38">{contextLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] capitalize text-white/45">
            <span className={`h-1.5 w-1.5 rounded-full ${status === "offline" ? "bg-amber-300" : status === "web" ? "bg-blue-300" : "bg-cyan-300"}`} />
            {status}
          </span>
          <button type="button" onClick={() => setIsOpen(false)}
            aria-label="Collapse SkyGuide"
            className="ol-interactive min-h-9 min-w-9 rounded-lg text-white/45 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            &minus;
          </button>
        </div>
      </div>

      <form onSubmit={submitQuestion} role="search"
        className="mt-4 flex items-center gap-1.5 rounded-2xl border border-cyan-100/15 bg-black/20 p-1.5 focus-within:border-cyan-200/30">
        <label htmlFor={`skyguide-question-${answerId}`} className="sr-only">
          Ask SkyGuide about aviation
        </label>
        <input ref={inputRef} id={`skyguide-question-${answerId}`} value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={SKYGUIDE_PLACEHOLDERS[placeholderIndex]}
          className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-white/88 outline-none placeholder:text-white/28" />
        <button type="submit" disabled={isLoading}
          className="ol-interactive min-h-10 shrink-0 rounded-xl bg-cyan-300 px-3 text-xs font-semibold text-[#03111a] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          {isLoading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {isLoading && (
        <p role="status" aria-live="polite" className="mt-2.5 text-xs text-cyan-100/55">
          SkyGuide is considering the available aviation context…
        </p>
      )}

      {conversation.length > 0 && (
        <div id={answerId} aria-live="polite"
          className="mt-2.5 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-cyan-200/12 bg-cyan-200/[0.035] px-3 py-2.5 text-xs leading-5">
          {conversation.map((item) => (
            <article key={item.id}>
              <p className="text-[10px] font-medium text-cyan-100/45">{item.question}</p>
              {item.result.kind === "answered"
                ? <SkyGuideAnswerContent answer={item.result.answer} onSuggestion={prepareQuestion} />
                : <p className="text-amber-50/68">{item.result.message}</p>}
            </article>
          ))}
        </div>
      )}

      <section className="mt-4">
        <button type="button" aria-expanded={actionsOpen}
          onClick={() => setActionsOpen((open) => !open)}
          className="ol-interactive flex min-h-9 w-full items-center justify-between rounded-lg px-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          Smart actions <span aria-hidden="true">{actionsOpen ? "-" : "+"}</span>
        </button>
        {actionsOpen && <div className="mt-2 grid grid-cols-2 gap-2">
          {SKYGUIDE_ACTIONS.map((action) => (
            <button key={action.id} type="button" onClick={() => prepareQuestion(action.prompt)}
              className="ol-interactive flex min-h-14 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 text-left hover:border-cyan-200/16 hover:bg-cyan-200/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <span className="text-cyan-100/58"><ActionIcon icon={action.icon} /></span>
              <span className="text-[11px] font-medium leading-4 text-white/67">{action.title}</span>
            </button>
          ))}
        </div>}
      </section>

      <section className="mt-4 border-t border-white/[0.07] pt-3"
        aria-labelledby={`skyguide-discover-${answerId}`}>
        <h3 id={`skyguide-discover-${answerId}`}
          className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/34">
          Discover
        </h3>
        <div className="mt-1.5 space-y-1">
          {DISCOVER_ITEMS.map((item) => (
            <button key={item} type="button" onClick={() => prepareQuestion(item)}
              className="ol-interactive block min-h-10 w-full rounded-lg px-2 py-1.5 text-left text-xs leading-4 text-white/52 hover:bg-white/[0.04] hover:text-white/78 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              {item}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SkyGuideAnswerContent({
  answer,
  onSuggestion,
}: {
  answer: SkyGuideAnswer;
  onSuggestion: (suggestion: string) => void;
}) {
  return (
    <>
      <p className="text-white/72">{answer.answer}</p>
      {(answer.facts.length > 0 || answer.likelyExplanation.length > 0 || answer.unknown.length > 0) && (
        <details className="mt-2">
          <summary className="ol-interactive cursor-pointer text-cyan-100/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            More explanation
          </summary>
          <AnswerSection title="Facts" items={answer.facts} />
          <AnswerSection title="Likely explanation" items={answer.likelyExplanation} />
          <AnswerSection title="Unknown" items={answer.unknown} />
        </details>
      )}
      {(answer.sources?.length ?? 0) > 0 && (
        <details className="mt-2">
          <summary className="ol-interactive cursor-pointer text-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            Sources
          </summary>
          <ul className="mt-1 space-y-1">
            {answer.sources?.map((source) => (
              <li key={source.id}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer"
                    className="text-cyan-100/60 underline decoration-cyan-100/20 underline-offset-2">
                    {source.label}
                  </a>
                ) : source.label}
              </li>
            ))}
          </ul>
        </details>
      )}
      {answer.suggestions.length > 0 && (
        <div className="mt-3 border-t border-white/[0.07] pt-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Continue exploring
          </p>
          <div className="mt-1 space-y-1">
            {answer.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                className="ol-interactive block min-h-9 w-full rounded-lg px-2 text-left text-xs text-cyan-100/58 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AnswerSection({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-2" aria-label={title}>
      <h3 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
        {title}
      </h3>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </section>
  );
}
