"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  SKYGUIDE_ACTIONS,
  SKYGUIDE_CONTEXT_ACTIONS,
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

type LocationRequest = {
  action: SkyGuideAction;
  manual: boolean;
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
  const [locationRequest, setLocationRequest] = useState<LocationRequest | null>(null);
  const [manualLocation, setManualLocation] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [memorySuggestionDismissed, setMemorySuggestionDismissed] = useState(false);
  const [memoryMessage, setMemoryMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const answerId = useId();

  useEffect(() => {
    const interval = window.setInterval(
      () => setPlaceholderIndex((current) => (current + 1) % SKYGUIDE_PLACEHOLDERS.length),
      7000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [conversation, isLoading]);

  const prepareQuestion = (question: string) => {
    setQuery(question);
    setActionsOpen(false);
    setLocationRequest(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const prepareAction = (action: SkyGuideAction) => {
    if (action.id === "overhead" || action.id === "spotting") {
      setLocationRequest({ action, manual: false });
      setActionsOpen(false);
      return;
    }
    prepareQuestion(action.prompt);
  };

  const requestCurrentLocation = () => {
    const action = locationRequest?.action;
    if (!action) return;
    if (!navigator.geolocation) {
      setLocationRequest({ action, manual: true });
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationLoading(false);
        prepareQuestion(
          `${action.prompt} Approximate location: ${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}.`,
        );
      },
      () => {
        setLocationLoading(false);
        setLocationRequest({ action, manual: true });
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
  };

  const useManualLocation = (event: FormEvent) => {
    event.preventDefault();
    const location = manualLocation.trim();
    const action = locationRequest?.action;
    if (!action || !location) return;
    setManualLocation("");
    prepareQuestion(`${action.prompt} Location provided by the user: ${location}.`);
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

  const acceptExpertiseSuggestion = async (expertiseLevel: "beginner" | "professional") => {
    const response = await fetch("/api/skytracker/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        expertiseLevel,
        conversationStyle: expertiseLevel === "professional" ? "technical" : "concise",
      }),
    }).catch(() => null);
    setMemoryMessage(
      response?.ok
        ? "SkyGuide will use this preference in future answers."
        : "Sign in to save this preference.",
    );
    setMemorySuggestionDismissed(true);
  };

  const contextLabel = context.selectedAircraft
    ? `Selected: ${context.selectedAircraft.callsign ?? context.selectedAircraft.registration ?? context.selectedAircraft.id.toUpperCase()}`
    : context.map
      ? `Map near ${context.map.centerLatitudeDegrees.toFixed(1)}°, ${context.map.centerLongitudeDegrees.toFixed(1)}°`
      : "Live map context";
  const hasSuccessfulInteraction = conversation.some(
    (item) => item.result.kind === "answered",
  );

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-expanded="false"
        onClick={() => setIsOpen(true)}
        className="ol-interactive flex min-h-12 w-full items-center justify-between rounded-2xl border border-cyan-100/15 bg-[#07141d]/92 px-4 py-3 text-left shadow-[0_16px_48px_rgba(0,0,0,.35)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <span aria-hidden="true">🤖</span> SkyGuide
          </span>
          <span className="block text-[10px] text-cyan-100/50">
            {hasSuccessfulInteraction ? "Continue with SkyGuide" : "Use SkyGuide Free"}
          </span>
        </span>
        <span aria-hidden="true" className="text-cyan-200/65">+</span>
      </button>
    );
  }

  const latestResult = conversation.at(-1)?.result;
  const status = latestResult?.kind === "answered"
    ? latestResult.answer.status ?? "cached"
    : latestResult
      ? "offline"
      : "ready";
  const statusPresentation = skyGuideStatusPresentation(status);
  const availableActions = context.selectedAircraft
    ? SKYGUIDE_CONTEXT_ACTIONS
    : SKYGUIDE_ACTIONS;

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
          <span className="flex items-center gap-1.5 text-[10px] text-white/48">
            <span className={`h-1.5 w-1.5 rounded-full ${statusPresentation.dotClass}`} />
            {statusPresentation.label}
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
          dir="auto"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={SKYGUIDE_PLACEHOLDERS[placeholderIndex]}
          className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-white/88 outline-none placeholder:text-white/28" />
        <button type="submit" disabled={isLoading}
          className="ol-interactive min-h-10 shrink-0 rounded-xl bg-cyan-300 px-3 text-xs font-semibold text-[#03111a] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          {isLoading ? "Asking…" : "Ask"}
        </button>
      </form>

      <div className="mt-2 min-h-5" aria-live="polite">
        {isLoading && <div role="status" className="flex items-center gap-2 text-xs text-cyan-100/58">
          <span>SkyGuide is thinking</span>
          <span aria-hidden="true" className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <span key={index}
                className="h-1 w-1 rounded-full bg-cyan-200 motion-safe:animate-pulse"
                style={{ animationDelay: `${index * 140}ms` }} />
            ))}
          </span>
        </div>}
      </div>

      {conversation.length > 0 && (
        <div id={answerId} aria-live="polite"
          className="mt-2.5 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-cyan-200/12 bg-cyan-200/[0.035] px-3 py-2.5 text-xs leading-5">
          {conversation.map((item) => (
            <article key={item.id} dir="auto" className="break-words">
              <p className="text-[10px] font-medium text-cyan-100/45">{item.question}</p>
              {item.result.kind === "answered"
                ? <SkyGuideAnswerContent answer={item.result.answer} onSuggestion={prepareQuestion} />
                : <SkyGuideErrorMessage result={item.result} />}
            </article>
          ))}
          <div ref={conversationEndRef} aria-hidden="true" />
        </div>
      )}

      {latestResult?.kind === "answered" && !memorySuggestionDismissed && (
        <section aria-label="SkyGuide Memory suggestion"
          className="mt-3 rounded-xl border border-cyan-200/12 bg-cyan-200/[0.035] p-3">
          <p className="text-xs leading-5 text-white/68">
            {latestResult.answer.audienceMode === "expert"
              ? "Would you like SkyGuide to remember that you prefer expert aviation answers?"
              : "Would you like SkyGuide to remember that you prefer compact beginner-friendly answers?"}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button"
              onClick={() => void acceptExpertiseSuggestion(
                latestResult.answer.audienceMode === "expert" ? "professional" : "beginner",
              )}
              className="min-h-9 rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-[#03111a]">
              Save preference
            </button>
            <button type="button" onClick={() => setMemorySuggestionDismissed(true)}
              className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-white/62">
              Not now
            </button>
          </div>
        </section>
      )}
      {memoryMessage && <p role="status" className="mt-2 text-xs text-cyan-100/62">{memoryMessage}</p>}

      {locationRequest && (
        <LocationConsent
          request={locationRequest}
          manualLocation={manualLocation}
          loading={locationLoading}
          onUseLocation={requestCurrentLocation}
          onManual={() => setLocationRequest({ ...locationRequest, manual: true })}
          onManualLocation={setManualLocation}
          onManualSubmit={useManualLocation}
          onSkip={() => prepareQuestion(locationRequest.action.prompt)}
          onCancel={() => setLocationRequest(null)}
        />
      )}

      <section className="mt-4">
        <button type="button" aria-expanded={actionsOpen}
          onClick={() => setActionsOpen((open) => !open)}
          className="ol-interactive flex min-h-9 w-full items-center justify-between rounded-lg px-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          Smart actions <span aria-hidden="true">{actionsOpen ? "-" : "+"}</span>
        </button>
        {actionsOpen && <div className="mt-2 grid grid-cols-2 gap-2">
          {availableActions.map((action) => (
            <button key={action.id} type="button" onClick={() => prepareAction(action)}
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
              dir="auto"
              className="ol-interactive block min-h-10 w-full break-words rounded-lg px-2 py-1.5 text-left text-xs leading-4 text-white/52 hover:bg-white/[0.04] hover:text-white/78 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
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
      <p dir="auto" className="break-words text-white/72">{answer.answer}</p>
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
          <ul className="mt-1.5 space-y-2">
            {answer.sources?.map((source) => (
              <li key={source.id}
                className="rounded-lg border border-white/[0.06] px-2 py-1.5">
                <p dir="auto" className="break-words">
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer"
                    className="text-cyan-100/60 underline decoration-cyan-100/20 underline-offset-2">
                    {source.label}
                  </a>
                ) : source.label}
                </p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-white/32">
                  {sourceTypeLabel(source.dataType)} ·{" "}
                  {formatSourceTime(source.publishedAt ?? source.retrievedAt)}
                </p>
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

function SkyGuideErrorMessage({
  result,
}: {
  result: Exclude<SkyGuideClientResult, { kind: "answered" }>;
}) {
  const rateLimited = result.kind === "rate-limited";
  return (
    <div role={rateLimited ? "alert" : "status"}
      className="mt-1.5 rounded-lg border border-amber-200/12 bg-amber-200/[0.05] px-2.5 py-2 text-amber-50/72">
      <p className="font-medium">
        {rateLimited ? "Hourly free limit reached" : "SkyGuide could not answer"}
      </p>
      <p className="mt-0.5">{result.message}</p>
    </div>
  );
}

function LocationConsent({
  request,
  manualLocation,
  loading,
  onUseLocation,
  onManual,
  onManualLocation,
  onManualSubmit,
  onSkip,
  onCancel,
}: {
  request: LocationRequest;
  manualLocation: string;
  loading: boolean;
  onUseLocation: () => void;
  onManual: () => void;
  onManualLocation: (value: string) => void;
  onManualSubmit: (event: FormEvent) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  return (
    <section aria-label="Location choice"
      className="mt-3 rounded-xl border border-cyan-200/12 bg-cyan-200/[0.035] p-3">
      <p className="text-xs leading-5 text-white/68">
        Location helps answer this question. It is requested only after you choose to share it.
      </p>
      {request.manual ? (
        <form onSubmit={onManualSubmit} className="mt-2 flex gap-1.5">
          <label htmlFor="skyguide-manual-location" className="sr-only">
            City, airport or location
          </label>
          <input id="skyguide-manual-location" dir="auto" value={manualLocation}
            onChange={(event) => onManualLocation(event.target.value)}
            placeholder="City, airport or location"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2.5 text-xs text-white outline-none focus:border-cyan-200/30" />
          <button type="submit"
            className="ol-interactive rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-[#03111a]">
            Use
          </button>
        </form>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" disabled={loading} onClick={onUseLocation}
            className="ol-interactive min-h-9 rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-[#03111a]">
            {loading ? "Requesting…" : "Use my location"}
          </button>
          <button type="button" onClick={onManual}
            className="ol-interactive min-h-9 rounded-lg border border-white/10 px-3 text-xs text-white/68">
            Enter manually
          </button>
        </div>
      )}
      <div className="mt-2 flex gap-3 text-[10px] text-white/42">
        <button type="button" onClick={onSkip}
          className="ol-interactive underline underline-offset-2">
          Continue without location
        </button>
        <button type="button" onClick={onCancel}
          className="ol-interactive underline underline-offset-2">
          Cancel
        </button>
      </div>
    </section>
  );
}

function skyGuideStatusPresentation(status: string) {
  switch (status) {
    case "live":
      return { label: "Live", dotClass: "bg-emerald-300" };
    case "cached":
      return { label: "Cached", dotClass: "bg-amber-300" };
    case "web":
      return { label: "Web", dotClass: "bg-blue-300" };
    case "offline":
      return { label: "Temporarily unavailable", dotClass: "bg-red-300" };
    default:
      return { label: "Ready", dotClass: "bg-white/55" };
  }
}

function sourceTypeLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatSourceTime(value: string | undefined) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Timestamp unavailable"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
