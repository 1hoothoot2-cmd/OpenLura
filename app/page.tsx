"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useMemo, useCallback } from "react";

function SectionFooter({
  nextHref,
  nextLabel,
}: {
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mt-auto flex flex-col items-center justify-center gap-3 pt-12">
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
  const router = useRouter();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [homeChatInput, setHomeChatInput] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  function resetLoginModal() {
    setIsLoginOpen(false);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
    setLoginLoading(false);
  }

  async function handleEmailLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "login",
          username: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      if (!res.ok) {
        setLoginError("Invalid email or password.");
        return;
      }
      router.push("/personal-dashboard");
    } catch {
      setLoginError("Something went wrong. Try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleGoogleLogin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase env vars missing");
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&apikey=${supabaseKey}`;
    window.location.href = url;
  }

  const lang = useMemo(() => {
    if (typeof navigator === "undefined") return "en";
    const raw = (navigator.language || "en").toLowerCase();
    if (raw.startsWith("pap")) return "pap";
    if (raw.startsWith("nl")) return "nl";
    if (raw.startsWith("de")) return "de";
    if (raw.startsWith("fr")) return "fr";
    if (raw.startsWith("es")) return "es";
    if (raw.startsWith("pt")) return "pt";
    if (raw.startsWith("hi")) return "hi";
    return "en";
  }, []);

  const translations = useMemo<Record<string, Record<string, string>>>(() => ({
      hero_title: {
        nl: "AI die zich aanpast aan jou, niet andersom.",
        de: "KI, die sich dir anpasst, nicht umgekehrt.",
        fr: "Une IA qui s'adapte à vous, pas l'inverse.",
        es: "IA que se adapta a ti, no al revés.",
        pap: "AI ku ta adaptá na bo, no al revés.",
        hi: "AI जो आपके अनुसार ढलती है, न कि उल्टा।",
        en: "AI that adapts to you, not the other way around.",
      },
      hero_sub: {
        nl: "OpenLura is je adaptieve AI-werkruimte. Het onthoudt nuttige context, verbetert door feedback en helpt je sneller te werken met minder ruis.",
        de: "OpenLura ist dein adaptiver KI-Arbeitsbereich. Er merkt sich nützlichen Kontext, verbessert sich durch Feedback und hilft dir, schneller zu arbeiten.",
        fr: "OpenLura est votre espace de travail IA adaptatif. Il mémorise le contexte utile, s'améliore grâce aux retours et vous aide à avancer plus vite.",
        es: "OpenLura es tu espacio de trabajo de IA adaptativo. Recuerda el contexto útil, mejora con el feedback y te ayuda a trabajar más rápido.",
        pap: "OpenLura ta bo workspace di AI adaptivo. E ta rekordá konteksto útil, ta mehora ku feedback i ta yudabo traha mas rápido.",
        hi: "OpenLura आपका अनुकूली AI कार्यक्षेत्र है। यह उपयोगी संदर्भ याद रखता है, फीडबैक से सुधरता है और आपको कम शोर के साथ तेज़ी से काम करने में मदद करता है।",
        en: "OpenLura is your adaptive AI workspace. It remembers useful context, improves through feedback, and helps you move faster with less noise.",
      },
      btn_start_chat: {
        nl: "Start chat",
        de: "Chat starten",
        fr: "Démarrer le chat",
        es: "Iniciar chat",
        pap: "Kuminsá chat",
        hi: "चैट शुरू करें",
        en: "Start chat",
      },
      btn_login: {
        nl: "Inloggen / Account aanmaken",
        de: "Anmelden / Konto erstellen",
        fr: "Se connecter / Créer un compte",
        es: "Iniciar sesión / Crear cuenta",
        pap: "Login / Krea account",
        hi: "लॉग इन / खाता बनाएं",
        en: "Log in / Create account",
      },
      btn_how_it_works: {
        nl: "Bekijk hoe het werkt",
        de: "So funktioniert es",
        fr: "Voir comment ça marche",
        es: "Ver cómo funciona",
        pap: "Mira kon e ta traha",
        hi: "यह कैसे काम करता है",
        en: "See how it works",
      },
      btn_give_feedback: {
        nl: "Geef feedback",
        de: "Feedback geben",
        fr: "Donner un avis",
        es: "Dar feedback",
        pap: "Duna feedback",
        hi: "फीडबैक दें",
        en: "Give feedback",
      },
      btn_open_chat: {
        nl: "Open chat",
        de: "Chat öffnen",
        fr: "Ouvrir le chat",
        es: "Abrir chat",
        pap: "Habri chat",
        hi: "चैट खोलें",
        en: "Open chat",
      },
      btn_back_to_top: {
        nl: "Terug naar boven",
        de: "Nach oben",
        fr: "Retour en haut",
        es: "Volver arriba",
        pap: "Bai bèk ariba",
        hi: "ऊपर जाएं",
        en: "Back to top",
      },
      cta_title: {
        nl: "Begin waar de waarde het sterkst is: de chat.",
        de: "Fang dort an, wo der Wert am stärksten ist: dem Chat.",
        fr: "Commencez là où la valeur est la plus forte : le chat.",
        es: "Empieza donde el valor es mayor: el chat.",
        pap: "Kuminsá kaminda e balor ta mas fuerte: e chat.",
        hi: "जहाँ मूल्य सबसे अधिक है वहाँ से शुरू करें: चैट।",
        en: "Start where the value is strongest: the chat.",
      },
      cta_sub: {
        nl: "Sla de ruis over, open de werkruimte en laat OpenLura je helpen denken, schrijven, plannen en sneller te bewegen.",
        de: "Überspring den Lärm, öffne den Arbeitsbereich und lass OpenLura dir beim Denken, Schreiben, Planen und schnelleren Vorankommen helfen.",
        fr: "Ignorez le bruit, ouvrez l'espace de travail et laissez OpenLura vous aider à penser, écrire, planifier et avancer plus vite.",
        es: "Salta el ruido, abre el espacio de trabajo y deja que OpenLura te ayude a pensar, escribir, planificar y moverte más rápido.",
        pap: "Skip e ruido, habri e workspace i laga OpenLura yudabo pensa, skibi, plania i muebe mas lihe.",
        hi: "शोर को छोड़ें, कार्यक्षेत्र खोलें और OpenLura को आपकी सोचने, लिखने, योजना बनाने और तेज़ी से आगे बढ़ने में मदद करने दें।",
        en: "Skip the noise, open the workspace, and let OpenLura help you think, write, plan, and move faster.",
      },
    }), []);

  const t = useCallback((key: string) => {
    return translations[key]?.[lang] ?? translations[key]?.["en"] ?? key;
  }, [translations, lang]);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackDetails, setFeedbackDetails] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function resetFeedbackModal() {
    setIsFeedbackOpen(false);
    setFeedbackSubject("");
    setFeedbackDetails("");
    setFeedbackSubmitting(false);
    setFeedbackStatus(null);
  }

  async function handleFeedbackSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const subject = feedbackSubject.trim();
    const details = feedbackDetails.trim();

    if (!subject || !details) {
      setFeedbackStatus({
        type: "error",
        message: "Please fill in both subject and details.",
      });
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackStatus(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "idea",
          message: details,
          userMessage: subject,
          source: "homepage_feedback_modal",
          learningType: "content",
          environment: "default",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error("Feedback request failed");
      }

      setFeedbackStatus({
        type: "success",
        message: "Feedback sent successfully.",
      });

      setFeedbackSubject("");
      setFeedbackDetails("");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("openlura_feedback_update"));
      }
    } catch {
      setFeedbackStatus({
        type: "error",
        message: "Something went wrong while sending feedback.",
      });
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  return (
    <main
      id="top"
      className="min-h-screen overflow-x-hidden bg-[#050510] text-white"
    >
      {/* STICKY NAV */}
      <nav className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#050510]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#3b82f6]/20 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.18),rgba(29,78,216,0.06)_52%,transparent_78%)]">
              <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
            </div>
            <span className="text-sm font-semibold tracking-[-0.02em] text-white/90">OpenLura</span>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <a href="#plans" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/58 transition-colors duration-150 hover:bg-white/[0.05] hover:text-white">Plans</a>
            <a href="#how-it-works" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/58 transition-colors duration-150 hover:bg-white/[0.05] hover:text-white">How it works</a>
            <a href="#roadmap" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/58 transition-colors duration-150 hover:bg-white/[0.05] hover:text-white">Roadmap</a>
            <a href="#changelog" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/58 transition-colors duration-150 hover:bg-white/[0.05] hover:text-white">Changelog</a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-colors duration-150 hover:border-white/16 hover:bg-white/[0.07] hover:text-white sm:inline-flex"
            >
              Log in
            </button>
            <Link
              href="/chat"
              className="inline-flex rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-4 py-1.5 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(59,130,246,0.28)] transition-[filter,box-shadow] duration-150 hover:brightness-110"
            >
              Start chat
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-4 pt-14 pb-0 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[12px] font-medium text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
              Launch offer — first month 25% off with code <span className="font-semibold">LAUNCH25</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/16 bg-emerald-400/8 px-3 py-1 text-[12px] font-medium text-emerald-300/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              Free plan available
            </div>
          </div>

          <h1 className="max-w-3xl bg-gradient-to-r from-white via-white to-white/68 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
            {t("hero_title")}
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-white/58 sm:text-lg">
            {t("hero_sub")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="group relative flex flex-col items-start rounded-[22px] border border-[#3b82f6]/24 bg-gradient-to-b from-[#0d1733] to-[#0a1022] px-6 py-6 text-left shadow-[0_8px_28px_rgba(29,78,216,0.16)] transition-[border-color,box-shadow] duration-150 hover:border-[#3b82f6]/40 hover:shadow-[0_12px_36px_rgba(29,78,216,0.22)] sm:w-72"
            >
              <span className="mb-3 inline-flex items-center rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-blue-300">
                Personal
              </span>
              <span className="text-base font-semibold text-white">Log in to your dashboard</span>
              <span className="mt-2 text-sm leading-6 text-white/46">Your workspace, history, and AI — all in one place.</span>
              <span className="mt-4 text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors duration-150">Sign in →</span>
            </button>

            <div className="flex items-center justify-center px-1">
              <span className="text-[12px] text-white/24">or</span>
            </div>

            <Link
              href="/chat"
              className="group relative flex flex-col items-start rounded-[22px] border border-white/10 bg-white/[0.03] px-6 py-6 text-left transition-[border-color,background-color] duration-150 hover:border-white/16 hover:bg-white/[0.05] sm:w-72"
            >
              <span className="mb-3 inline-flex items-center rounded-full border border-emerald-400/16 bg-emerald-400/8 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-300/80">
                Free
              </span>
              <span className="text-base font-semibold text-white">Try the chat</span>
              <span className="mt-2 text-sm leading-6 text-white/46">No account needed. Start asking, writing, and planning.</span>
              <span className="mt-4 text-sm font-medium text-white/40 group-hover:text-white/70 transition-colors duration-150">Open chat →</span>
            </Link>
          </div>

          {/* HOMEPAGE CHAT ENTRY */}
          <div className="mt-5 w-full max-w-4xl">
            <div className="flex items-center gap-2 rounded-[18px] border border-white/20 bg-white/[0.08] px-3 py-2.5 shadow-[0_0_0_1px_rgba(59,130,246,0.10),0_4px_20px_rgba(0,0,0,0.20)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-[#3b82f6]/50 focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.20),0_4px_24px_rgba(59,130,246,0.16)]">
              <input
                type="text"
                value={homeChatInput}
                onChange={(e) => setHomeChatInput(e.target.value)}
                onFocus={() => router.prefetch("/chat")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && homeChatInput.trim()) {
                    e.preventDefault();
                    router.push(`/chat?q=${encodeURIComponent(homeChatInput.trim())}`);
                  }
                }}
                placeholder={
                  lang === "nl" ? "Hoe kan ik je helpen?" :
                  lang === "hi" ? "\u092e\u0948\u0902 \u0906\u092a\u0915\u0940 \u0915\u0948\u0938\u0947 \u092e\u0926\u0926 \u0915\u0930 \u0938\u0915\u0924\u093e \u0939\u0942\u0901?" :
                  "How can I assist you?"
                }
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/32"
              />
              <button
                type="button"
                disabled={!homeChatInput.trim()}
                onClick={() => {
                  if (homeChatInput.trim()) {
                    router.push(`/chat?q=${encodeURIComponent(homeChatInput.trim())}`);
                  }
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-sm text-white shadow-[0_4px_12px_rgba(59,130,246,0.28)] transition-[transform,filter,opacity] duration-200 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {([
                lang === "nl" ? "Help me een e-mail schrijven" : "Help me write an email",
                lang === "nl" ? "Leg iets simpel uit" : "Explain something simply",
                lang === "nl" ? "Plan iets voor me" : "Plan something for me",
              ] as string[]).map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onMouseEnter={() => router.prefetch("/chat")}
                  onClick={() => {
                    router.push(`/chat?q=${encodeURIComponent(starter)}`);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/52 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color] duration-200 hover:border-[#3b82f6]/24 hover:bg-[#3b82f6]/10 hover:text-white/88 active:scale-95"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
         <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] font-medium text-white/46 transition-[background-color,border-color,color] duration-150 hover:border-amber-400/24 hover:bg-amber-400/8 hover:text-amber-200"
            >
              {t("btn_give_feedback")}
            </button>
          </div>
        </div>
          {/* PLANS */}
          <section
            id="plans"
            className="section-panel scroll-mt-20 mt-24 w-full max-w-5xl sm:mt-28"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white/92">Plans</h2>
              <p className="mt-2 text-sm text-white/46">Start free. Upgrade when ready.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">Free</div>
                    <p className="mt-1 text-sm text-white/46">Try OpenLura with no setup.</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">
                    Available now
                  </span>
                </div>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <div className="text-3xl font-semibold text-white">€0</div>
                  <div className="text-sm text-white/36">/month</div>
                </div>
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-white/40" /><p className="text-sm text-white/68">Core chat access</p></div>
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-white/40" /><p className="text-sm text-white/68">Basic usage and exploration</p></div>
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-white/40" /><p className="text-sm text-white/68">150 messages per month</p></div>
                </div>
                <Link
                  href="/chat"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/80 transition-[background-color,border-color,color] duration-150 hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
                >
                  Start for free
                </Link>
              </div>

              <div className="rounded-[24px] border border-blue-400/16 bg-gradient-to-b from-[#0d1733] to-[#0a1022] p-6 shadow-[0_18px_48px_rgba(29,78,216,0.14)] backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">Go</div>
                    <p className="mt-1 text-sm text-white/46">For consistent usage and deeper workflows.</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-300">
                    Available now
                  </span>
                </div>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <div className="text-3xl font-semibold text-white">€4,99</div>
                  <div className="text-sm text-white/36">/month</div>
                </div>
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" /><p className="text-sm text-white/78">Unlimited messages per month</p></div>
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" /><p className="text-sm text-white/78">Web search — real sources, live info</p></div>
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" /><p className="text-sm text-white/78">Personal workspace with memory</p></div>
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" /><p className="text-sm text-white/78">Image upload & analysis</p></div>
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" /><p className="text-sm text-white/78">AI that adapts to your feedback</p></div>
                  <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" /><p className="text-sm text-white/78">Photo Studio — generate & edit images with AI</p></div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
                      if (res.status === 401) { router.push("/personal-workspace"); return; }
                      const text = await res.text();
                      const data = JSON.parse(text);
                      if (data.url) window.location.href = data.url;
                    } catch (err) {
                      console.error("Stripe checkout error:", err);
                    }
                  }}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-[16px] border border-blue-400/20 bg-blue-400/10 py-3 text-sm font-medium text-blue-200 transition-[background-color,border-color,color] duration-150 hover:border-blue-400/30 hover:bg-blue-400/16 hover:text-white"
                >
                  Get started with Go
                </button>
              </div>
            </div>
            <SectionFooter nextHref="#how-it-works" nextLabel="How it works" />
          </section>

          {/* PRODUCT OVERVIEW */}
          <section
            id="how-it-works"
            className="section-panel scroll-mt-24 mt-14 w-full max-w-4xl sm:mt-16"
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
              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">
                  Learns from context
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Remembers what matters across your conversations and uses it to give sharper answers.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">
                  Improves with feedback
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Thumbs up, thumbs down — every signal shapes how OpenLura responds to you next time.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">
                  Search with real sources
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Pulls live web results when needed — with actual links, not guesses.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">
                  Image upload & analysis
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Send a photo, screenshot, or document and get a direct, useful response.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">
                  Photo Studio
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Generate and edit images with AI — directly inside your workspace.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">
                  Personal by design
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Your private workspace keeps memory, history, and AI behavior separate from everyone else.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#roadmap" nextLabel="Roadmap" />
          </section>

          {/* ROADMAP */}
          <section
            id="roadmap"
            className="section-panel scroll-mt-24 mt-14 w-full max-w-5xl sm:mt-16"
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
              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
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

              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
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

              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
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

              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Experience</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Complete
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Homepage, onboarding, and product clarity.
                </p>
              </div>

              <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Personal AI</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Complete
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Private workspace with account-bound memory, chat history, and personal AI behavior.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Expansion</div>
                  <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                    In progress
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Photo Studio live. Voice, mobile apps, and deeper personalization next.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#use-cases" nextLabel="Use cases" />
          </section>

          {/* USE CASES */}
          <section
            id="use-cases"
            className="section-panel scroll-mt-24 mt-14 w-full max-w-5xl sm:mt-16"
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
              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">Writing and rewriting</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Draft ideas faster, improve clarity, and refine content without losing your tone.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">Research support</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Break down topics, organize findings, and turn scattered notes into direction.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">Workflow thinking</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Use OpenLura to structure tasks, plan next steps, and reduce decision friction.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">Idea development</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Explore concepts, test directions, and expand rough thoughts into usable output.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">Learning as you go</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Get help understanding topics while building context over time through interaction.
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="text-sm font-medium text-white">Daily AI workspace</div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Keep one consistent place for asking, refining, planning, and moving work forward.
                </p>
              </div>
            </div>
            <SectionFooter nextHref="#changelog" nextLabel="Changelog" />
          </section>

          {/* CHANGELOG */}
          <section
            id="changelog"
            className="section-panel scroll-mt-24 mt-14 w-full max-w-5xl sm:mt-16"
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
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl ol-surface sm:p-7">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center rounded-full border border-emerald-400/16 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-300">
                      Recent progress
                    </div>

                    <h2 className="mt-4 text-xl font-semibold text-white/92">
                      Photo Studio, polish & stability
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-white/50">
                      OpenLura Phase 5 brings Photo Studio, a smoother overall UX, faster rendering, and a more complete product experience end-to-end.
                    </p>
                  </div>

                  <div className="text-sm text-white/42">
                    Phase 5
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">Photo Studio</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      Generate and edit images with AI — live inside the workspace for Go users.
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">UX improvements</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      Smoother loading states, better error handling, faster input response, and mobile fixes.
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">Go plan clarity</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      Go plan now shows all concrete features — web search, memory, image tools, and Photo Studio.
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-white">Stability</div>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      Fixed hydration issues, AdSense inline script, and nav footer link ordering.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <SectionFooter />
          </section>

          <div className="mt-20 w-full max-w-5xl sm:mt-24">
            <div className="rounded-[24px] border border-[#3b82f6]/14 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_50%),rgba(255,255,255,0.02)] p-8 sm:p-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-400/70">Ready to start</p>
              <h2 className="mt-3 text-2xl font-semibold text-white/92 sm:text-3xl">
                {t("cta_title")}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/50">
                {t("cta_sub")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/chat"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-6 text-sm font-medium text-white shadow-[0_8px_20px_rgba(59,130,246,0.28)] transition-[filter,box-shadow] duration-150 hover:brightness-110"
                >
                  {t("btn_open_chat")}
                </Link>
                <div className="rounded-[22px] border border-emerald-400/14 bg-white/[0.03] p-5 backdrop-blur-xl ol-surface">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">Personal AI</div>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    Complete
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  Private workspace with account-bound memory, chat history, and personal AI behavior.
                </p>
              </div>

              </div>
            </div>
          </div>
        </div>
                 {isLoginOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <button
              type="button"
              aria-label="Close login modal"
              onClick={resetLoginModal}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <div className="relative z-10 w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b0b17] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.50)]">
              <button
                type="button"
                aria-label="Close"
                onClick={resetLoginModal}
                className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>

              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center overflow-hidden rounded-[12px] border border-[#3b82f6]/20 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.18),rgba(29,78,216,0.06)_52%,transparent_78%)]">
                  <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
                </div>
                <h2 className="text-xl font-semibold text-white/92">Welcome to OpenLura</h2>
                <p className="mt-1.5 text-sm text-white/46">Sign in to your personal workspace</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                  if (!supabaseUrl || !supabaseKey) return;
                  const redirectTo = `${window.location.origin}/auth/callback`;
                  window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&apikey=${supabaseKey}`;
                }}
                className="flex w-full items-center justify-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-medium text-white/88 transition-[background-color,border-color] duration-150 hover:border-white/16 hover:bg-white/[0.09]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[12px] text-white/30">or</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 transition-colors duration-150 focus:border-white/20"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 transition-colors duration-150 focus:border-white/20"
                />

                {loginError && (
                  <p className="rounded-[12px] border border-rose-400/20 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-200">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-[14px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] py-3 text-sm font-medium text-white shadow-[0_8px_20px_rgba(59,130,246,0.24)] transition-[filter,opacity] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loginLoading ? "Signing in..." : "Continue with email"}
                </button>
              </form>

              <p className="mt-5 text-center text-[12px] text-white/30">
                No account yet?{" "}
                <a href="/personal-workspace" className="text-blue-400/80 hover:text-blue-300 transition-colors duration-150">
                  Create one here
                </a>
              </p>
            </div>
          </div>
        )}

        {isFeedbackOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <button
              type="button"
              aria-label="Close feedback modal"
              onClick={resetFeedbackModal}
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
                  onClick={resetFeedbackModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white"
                >
                  ×
                </button>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleFeedbackSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/88">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={feedbackSubject}
                    onChange={(e) => setFeedbackSubject(e.target.value)}
                    placeholder="Bug, feedback, or idea"
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 ol-surface transition-colors duration-200 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/88">
                    Details
                  </label>
                  <textarea
                    rows={5}
                    value={feedbackDetails}
                    onChange={(e) => setFeedbackDetails(e.target.value)}
                    placeholder="Tell us what happened or what could be improved"
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 ol-surface transition-colors duration-200 focus:border-white/20"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  {feedbackStatus ? (
                    <div
                      className={`sm:mr-auto rounded-[16px] border px-4 py-3 text-sm ${
                        feedbackStatus.type === "success"
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : "border-rose-400/20 bg-rose-400/10 text-rose-200"
                      }`}
                    >
                      {feedbackStatus.message}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={resetFeedbackModal}
                    disabled={feedbackSubmitting}
                    className="inline-flex h-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-white/78 transition-[background-color,border-color,color,opacity] duration-200 hover:border-white/14 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className="inline-flex h-11 items-center justify-center rounded-[16px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(59,130,246,0.24)] transition-[transform,filter,box-shadow,opacity] duration-200 hover:brightness-110 hover:shadow-[0_14px_32px_rgba(59,130,246,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {feedbackSubmitting ? "Sending..." : "Send feedback"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
        <div className="mt-8 pb-8 text-center">
          <a href="/privacy" className="text-[12px] text-white/30 hover:text-white/60 transition-colors duration-200">
            Privacy policy
          </a>
        </div>

        {/* AdSense — beperkt, alleen onderaan homepage */}
        <div className="w-full border-t border-white/6 py-6 flex justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", maxWidth: "728px", height: "90px" }}
            data-ad-client="ca-pub-6179971963487173"
            data-ad-slot="auto"
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>

    </main>
  );
}