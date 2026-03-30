function isPersonalEnvironmentRequest(req: Request) {
  return req.headers.get("x-openlura-personal-env") === "true";
}
import OpenAI from "openai";
import {
  requireOpenLuraIdentity,
  resolveOpenLuraRequestIdentity,
} from "@/lib/auth/requestIdentity";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const personalStateTable =
  process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

function getGlobalFeedbackSnapshot(input: OpenLuraFeedbackRow[]) {
  return Array.isArray(input) ? [...input] : [];
}

const responseCache = new Map<
  string,
  { text: string; sources: { title: string; url: string }[]; timestamp: number }
>();
const RESPONSE_CACHE_TTL_MS = 1000 * 60 * 10;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

function cleanupRateLimitStore() {
  const now = Date.now();

  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

async function checkRateLimit(req: Request) {
  cleanupRateLimitStore();

  const ip = getRequestIp(req);
  const identity = await resolveOpenLuraRequestIdentity(req);
  const userKey = identity?.userId || "anon";
  const rateLimitKey = `${ip}:${userKey}`;
  const now = Date.now();
  const existing = rateLimitStore.get(rateLimitKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(rateLimitKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  rateLimitStore.set(rateLimitKey, existing);

  return {
    allowed: true,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - existing.count),
    resetAt: existing.resetAt,
  };
}

function detectCasualStyleMismatch(input: {
  userMessage: string;
  aiText: string;
}) {
  const userText = (input.userMessage || "").toLowerCase().trim();
  const aiText = (input.aiText || "").trim();
  const aiLower = aiText.toLowerCase();

  const isCasualUserPrompt =
    /(\b(en jij|wat zou jij|zou jij|denk je|vind je|haha|hihi|lol|gezellig|leuke vraag|flirty|cute|crush|date)\b|\?)/i.test(
      userText
    ) && userText.length <= 240;

  if (!isCasualUserPrompt) return false;

  const paragraphCount = aiText
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  const heavySignals = [
    "contextueel",
    "nuance",
    "nuances",
    "persoonlijkheid",
    "spontaan",
    "menselijker",
    "natuurlijker",
    "inspelen op",
    "serieus",
    "diepgang",
    "reflectie",
  ];

  const heavySignalCount = heavySignals.filter((signal) =>
    aiLower.includes(signal)
  ).length;

  return (
    aiText.length > 420 ||
    paragraphCount >= 3 ||
    heavySignalCount >= 2
  );
}

function detectAutoDebugSignals(input: {
  userMessage?: string;
  aiText?: string;
  image?: string | null;
  usedWebSearch: boolean;
  sources: { title: string; url: string }[];
  isCasualChatRequest: boolean;
  isSimpleImageAnalysis: boolean;
  responseVariant: string;
  routeType: "fast_text" | "fast_image" | "search" | "default";
}) {
  const userText = (input.userMessage || "").toLowerCase().trim();
  const aiText = (input.aiText || "").trim();

  const signals: {
    type: string;
    confidence: "low" | "medium" | "high";
    message: string;
    learningType: "style" | "content";
  }[] = [];

  const likelySearchIntent =
    /restaurant|cafe|coffee|koffie|location|locatie|where|waar|address|adres|opening|open|review|route|travel|venue|place|plek|business|bedrijf|hotel|map|maps|near|dichtbij|best|beste|news|nieuws|welke plek|which place|waar is dit|where is this|welk restaurant|which restaurant|vind locatie|find location|zoek locatie|search location/i.test(
      userText
    );

  if (
    input.isCasualChatRequest &&
    detectCasualStyleMismatch({
      userMessage: input.userMessage || "",
      aiText,
    })
  ) {
    signals.push({
      type: "casual_mismatch",
      confidence: "high",
      message: "Casual prompt likely answered too formally or too long.",
      learningType: "style",
    });
  }

  if (
    likelySearchIntent &&
    !input.usedWebSearch &&
    !input.isSimpleImageAnalysis
  ) {
    signals.push({
      type: "possible_search_miss",
      confidence: "medium",
      message: "Prompt looked search-dependent but web search did not run.",
      learningType: "content",
    });
  }

  if (
    input.usedWebSearch &&
    (!Array.isArray(input.sources) || input.sources.length === 0)
  ) {
    signals.push({
      type: "weak_source_support",
      confidence: "high",
      message: "Web search route ran but no sources were attached.",
      learningType: "content",
    });
  }

  if (
    input.image &&
    !input.isSimpleImageAnalysis &&
    aiText &&
    !/image|afbeelding|foto|plaatje|screenshot|visual|visueel|see|visible|shows|laat zien|ik zie/i.test(
      aiText.toLowerCase()
    )
  ) {
    signals.push({
      type: "possible_image_context_miss",
      confidence: "medium",
      message: "Image was attached but the reply may not reference visual context clearly.",
      learningType: "content",
    });
  }

  if (
    input.isSimpleImageAnalysis &&
    aiText.length > 500
  ) {
    signals.push({
      type: "too_verbose_for_image_route",
      confidence: "medium",
      message: "Simple image analysis reply may be too long for the route.",
      learningType: "style",
    });
  }

  return signals.map((signal) => ({
    ...signal,
    source: `auto_debug_${signal.type}`,
    variant: input.responseVariant,
    routeType: input.routeType,
  }));
}

function buildCacheKey(input: {
  message: string;
  personalMemory?: string;
  learningScope?: string;
  isPersonalEnvironment?: boolean;
  personalUserId?: string | null;
}) {
  const memoryFingerprint = (input.personalMemory || "")
    .trim()
    .toLowerCase()
    .slice(0, 200);

  return JSON.stringify({
    message: input.message.trim().toLowerCase(),
    personalMemoryFingerprint: memoryFingerprint,
    learningScope: (input.learningScope || "global").trim().toLowerCase(),
    isPersonalEnvironment: input.isPersonalEnvironment === true,
    personalUserId:
      input.isPersonalEnvironment === true
        ? String(input.personalUserId || "").trim()
        : "",
  });
}

function applyFeedbackWeighting(input: {
  personal: any[];
  global: any[];
}) {
  const PERSONAL_MULTIPLIER = 2.2;
  const PERSONAL_NEGATIVE_MULTIPLIER = 2.8;

  const normalize = (items: any[], multiplier: number) =>
    items.map((item) => {
      const baseWeight =
        item.type === "down" || item.type === "improve"
          ? PERSONAL_NEGATIVE_MULTIPLIER
          : multiplier;

      return {
        ...item,
        _weightedScore: baseWeight,
      };
    });

  const weightedPersonal = normalize(input.personal, PERSONAL_MULTIPLIER);
  const weightedGlobal = normalize(input.global, 1);

  return [...weightedPersonal, ...weightedGlobal];
}

function buildStyleLearningSignals(input: {
  shorter: number;
  clearer: number;
  structure: number;
  vague: number;
  context: number;
  casual: number;
}) {
  return {
    shorter: input.shorter,
    clearer: input.clearer,
    structure: input.structure,
    vague: input.vague,
    context: input.context,
    casual: input.casual,
  };
}

function buildActiveLearningRules(input: {
  learningConfidence: {
    shorter: string;
    clearer: string;
    structure: string;
    vague: string;
    context: string;
    casual: string;
  };
  cappedLearningStrength: {
    shorter: number;
    clearer: number;
    structure: number;
    vague: number;
    context: number;
    casual: number;
  };
}) {
  const isActive = (strength: number, confidence: string) =>
    confidence === "High" || (confidence === "Medium" && strength >= 3);

  const isSoft = (strength: number, confidence: string) =>
    !isActive(strength, confidence) &&
    (confidence === "Medium" || (confidence === "Low" && strength >= 1));

  return {
    shorter: isActive(
      input.cappedLearningStrength.shorter,
      input.learningConfidence.shorter
    ),
    clearer: isActive(
      input.cappedLearningStrength.clearer,
      input.learningConfidence.clearer
    ),
    structured: isActive(
      input.cappedLearningStrength.structure,
      input.learningConfidence.structure
    ),
    moreConcrete: isActive(
      input.cappedLearningStrength.vague,
      input.learningConfidence.vague
    ),
    moreContext: isActive(
      input.cappedLearningStrength.context,
      input.learningConfidence.context
    ),
    casualTone: isActive(
      input.cappedLearningStrength.casual,
      input.learningConfidence.casual
    ),
    soft: {
      shorter: isSoft(
        input.cappedLearningStrength.shorter,
        input.learningConfidence.shorter
      ),
      clearer: isSoft(
        input.cappedLearningStrength.clearer,
        input.learningConfidence.clearer
      ),
      structured: isSoft(
        input.cappedLearningStrength.structure,
        input.learningConfidence.structure
      ),
      moreConcrete: isSoft(
        input.cappedLearningStrength.vague,
        input.learningConfidence.vague
      ),
      moreContext: isSoft(
        input.cappedLearningStrength.context,
        input.learningConfidence.context
      ),
      casualTone: isSoft(
        input.cappedLearningStrength.casual,
        input.learningConfidence.casual
      ),
    },
  };
}

function buildResponseStyleProfile(input: {
  isCasualChatRequest: boolean;
  shouldUseWebSearch: boolean;
  isSimpleImageAnalysis: boolean;
  learningConfidence: {
    shorter: string;
    clearer: string;
    structure: string;
    vague: string;
    context: string;
    casual: string;
  };
  cappedLearningStrength: {
    shorter: number;
    clearer: number;
    structure: number;
    vague: number;
    context: number;
    casual: number;
  };
  activeLearningRules: {
    shorter: boolean;
    clearer: boolean;
    structured: boolean;
    moreConcrete: boolean;
    moreContext: boolean;
    casualTone: boolean;
    soft: {
      shorter: boolean;
      clearer: boolean;
      structured: boolean;
      moreConcrete: boolean;
      moreContext: boolean;
      casualTone: boolean;
    };
  };
}) {
  const tone =
    input.isCasualChatRequest
      ? input.activeLearningRules.casualTone
        ? "casual_light"
        : "casual_balanced"
      : input.shouldUseWebSearch
      ? "practical_grounded"
      : input.isSimpleImageAnalysis
      ? "visual_direct"
      : "default_premium";

  const brevity =
    input.activeLearningRules.shorter
      ? "tight"
      : input.activeLearningRules.soft.shorter ||
        input.isCasualChatRequest ||
        input.isSimpleImageAnalysis
      ? "compact"
      : "balanced";

  const structure =
    input.shouldUseWebSearch
      ? "shortlist"
      : input.activeLearningRules.structured
      ? "structured"
      : input.activeLearningRules.soft.structured || input.isCasualChatRequest
      ? "minimal"
      : "balanced";

  const clarity =
    input.activeLearningRules.clearer || input.activeLearningRules.moreConcrete
      ? "high"
      : input.activeLearningRules.soft.clearer ||
        input.activeLearningRules.soft.moreConcrete
      ? "elevated"
      : "normal";

  const depth =
    input.activeLearningRules.moreContext &&
    !input.isCasualChatRequest &&
    !input.isSimpleImageAnalysis
      ? "expanded"
      : input.activeLearningRules.soft.moreContext &&
        !input.isCasualChatRequest &&
        !input.isSimpleImageAnalysis
      ? "standard_plus"
      : "standard";

  return {
    tone,
    brevity,
    structure,
    clarity,
    depth,
    confidenceSummary: {
      shorter: input.learningConfidence.shorter,
      clearer: input.learningConfidence.clearer,
      structure: input.learningConfidence.structure,
      vague: input.learningConfidence.vague,
      context: input.learningConfidence.context,
      casual: input.learningConfidence.casual,
    },
  };
}

function buildSharedStyleInstructionBlock(input: {
  responseStyleProfile: {
    tone: string;
    brevity: string;
    structure: string;
    clarity: string;
    depth: string;
  };
  cappedLearningStrength: {
    shorter: number;
    clearer: number;
    structure: number;
    vague: number;
    context: number;
    casual: number;
  };
  activeLearningRules: {
    shorter: boolean;
    clearer: boolean;
    structured: boolean;
    moreConcrete: boolean;
    moreContext: boolean;
    casualTone: boolean;
    soft: {
      shorter: boolean;
      clearer: boolean;
      structured: boolean;
      moreConcrete: boolean;
      moreContext: boolean;
      casualTone: boolean;
    };
  };
}) {
  return `Response style profile:
- tone: ${input.responseStyleProfile.tone}
- brevity: ${input.responseStyleProfile.brevity}
- structure: ${input.responseStyleProfile.structure}
- clarity: ${input.responseStyleProfile.clarity}
- depth: ${input.responseStyleProfile.depth}

Active learning rules:
- shorter replies: ${input.activeLearningRules.shorter ? "strong" : input.activeLearningRules.soft.shorter ? "light" : "off"}
- clearer wording: ${input.activeLearningRules.clearer ? "strong" : input.activeLearningRules.soft.clearer ? "light" : "off"}
- better structure: ${input.activeLearningRules.structured ? "strong" : input.activeLearningRules.soft.structured ? "light" : "off"}
- more concrete answers: ${input.activeLearningRules.moreConcrete ? "strong" : input.activeLearningRules.soft.moreConcrete ? "light" : "off"}
- more context: ${input.activeLearningRules.moreContext ? "strong" : input.activeLearningRules.soft.moreContext ? "light" : "off"}
- casual natural tone: ${input.activeLearningRules.casualTone ? "strong" : input.activeLearningRules.soft.casualTone ? "light" : "off"}

Style pressure:
- shorter: ${input.cappedLearningStrength.shorter}
- clearer: ${input.cappedLearningStrength.clearer}
- structure: ${input.cappedLearningStrength.structure}
- vague reduction: ${input.cappedLearningStrength.vague}
- more context: ${input.cappedLearningStrength.context}
- casual tone: ${input.cappedLearningStrength.casual}`;
}

function buildContentLearningState(input: {
  responsePreferenceContext: string;
  hasMixedResponseFeedback: boolean;
  bestResponsePreference?: {
    response: string;
    score: number;
    up: number;
    down: number;
  };
}) {
  const bestResponseScore = input.bestResponsePreference?.score || 0;

  return {
    responsePreferenceContext: input.responsePreferenceContext,
    hasMixedResponseFeedback: input.hasMixedResponseFeedback,
    bestResponsePreference: input.bestResponsePreference || null,
    hasContentPreference: !!input.bestResponsePreference,
    shouldApplyContentPreference:
      !!input.bestResponsePreference &&
      !input.hasMixedResponseFeedback &&
      bestResponseScore >= 2,
    shouldOnlyUseContentAsHint:
      !!input.bestResponsePreference &&
      (input.hasMixedResponseFeedback || bestResponseScore < 2),
  };
}

function buildSuccessfulResponseReuse(input: {
  bestResponsePreference?: {
    response: string;
    score: number;
    up: number;
    down: number;
  } | null;
  hasMixedResponseFeedback: boolean;
}) {
  const reusableWinner =
    !!input.bestResponsePreference &&
    !input.hasMixedResponseFeedback &&
    (input.bestResponsePreference?.score || 0) >= 2;

  return {
    reusableWinner,
    winnerText: reusableWinner ? input.bestResponsePreference?.response || "" : "",
    winnerScore: input.bestResponsePreference?.score || 0,
    winnerUp: input.bestResponsePreference?.up || 0,
    winnerDown: input.bestResponsePreference?.down || 0,
  };
}

function shouldBypassFastTextPath(input: {
  isCasualChatRequest: boolean;
  casualSignalStrength: number;
  hasContentPreference: boolean;
  hasMixedResponseFeedback: boolean;
  bestResponsePreferenceScore: number;
  shouldApplyContentPreference?: boolean;
}) {
  const casualNeedsLearnedBehavior =
    input.isCasualChatRequest && input.casualSignalStrength >= 2;

  const strongExactMessagePreference =
    input.shouldApplyContentPreference ??
    (
      input.hasContentPreference &&
      !input.hasMixedResponseFeedback &&
      input.bestResponsePreferenceScore >= 2
    );

  return casualNeedsLearnedBehavior || strongExactMessagePreference;
}

function shouldUseAdaptiveSpeedMode(input: {
  shouldUseFastTextPath: boolean;
  isCasualChatRequest: boolean;
  casualSignalStrength: number;
  hasContentPreference: boolean;
  hasMixedResponseFeedback: boolean;
  bestResponsePreferenceScore: number;
  shouldApplyContentPreference?: boolean;
}) {
  if (input.hasMixedResponseFeedback) return false;

  if (
    input.shouldApplyContentPreference ??
    (input.hasContentPreference && input.bestResponsePreferenceScore >= 2)
  ) {
    return false;
  }

  if (input.isCasualChatRequest && input.casualSignalStrength >= 2) {
    return true;
  }

  return input.shouldUseFastTextPath;
}

function isRefinementInstruction(text?: string) {
  const normalized = (text || "").toLowerCase().trim();

  return /^(en )?(nu )?(nog )?(korter|kort|duidelijker|simpeler|meer concreet|concreter|anders|anders verwoorden|opnieuw maar korter|maak korter|maak het korter|korter graag|duidelijker graag|simpel(er)? graag|meer context|minder tekst|alleen het aantal|nu alleen het aantal|gewoon het aantal|alleen de naam|alleen de namen|alleen kort|alleen de conclusie)([.!?])?$/.test(
    normalized
  );
}

function isConversationDependentFollowUp(text?: string) {
  const normalized = (text || "").toLowerCase().trim();

  if (!normalized) return false;
  if (isRefinementInstruction(normalized)) return true;

  return /^(en )?(nu )?(nog )?(alleen|gewoon|dus|oke|oké|prima|helder|dan|welke dan|waarom|hoezo|en welke|en wat|en voor|alleen het|alleen de|geef alleen|noem alleen|kan het korter|kan je het anders verwoorden|kun je het anders verwoorden)(\b|[.!?])/.test(
    normalized
  );
}

function classifyOpenLuraRoute(input: {
  message?: string;
  image?: string | null;
}) {
  const normalizedMessage = (input.message || "").toLowerCase().trim();

  const isSimpleImageAnalysis =
    !!input.image &&
    (!normalizedMessage ||
      /^(wat is dit|what is this|beschrijf dit|describe this|analyseer dit|analyze this|wat zie je|what do you see|wie is dit|who is this)$/i.test(
        normalizedMessage
      ));

  const shouldUseWebSearch =
    !isSimpleImageAnalysis &&
    (!input.image ||
      /restaurant|cafe|coffee|koffie|location|locatie|where|waar|address|adres|opening|open|review|route|travel|venue|place|plek|business|bedrijf|hotel|map|maps|near|dichtbij|best|beste|news|nieuws|welke plek|which place|waar is dit|where is this|welk restaurant|which restaurant|vind locatie|find location|zoek locatie|search location/i.test(
        normalizedMessage
      ));

  const isCasualChatRequest =
    !input.image &&
    !shouldUseWebSearch &&
    /(\?|\b(hoi|hey|haha|hahah|lol|leuk|gezellig|denk je|vind je|zou jij|wat zou jij|en jij|persoonlijk|flirty|date|crush|lief|cute|grappig)\b)/i.test(
      normalizedMessage
    );

  const shouldForceFastCompactOutput =
    isSimpleImageAnalysis ||
    shouldUseWebSearch ||
    isCasualChatRequest ||
    normalizedMessage.length <= 40;

  const shouldUseFastTextPath =
    !input.image &&
    !shouldUseWebSearch &&
    !isRefinementInstruction(normalizedMessage) &&
    !!normalizedMessage &&
    normalizedMessage.length <= 120;

  return {
    normalizedMessage,
    isSimpleImageAnalysis,
    shouldUseWebSearch,
    isSearchStyleRequest: shouldUseWebSearch,
    isCasualChatRequest,
    shouldForceFastCompactOutput,
    shouldUseFastTextPath,
  };
}

type OpenLuraFeedbackRow = {
  type?: string | null;
  message?: string | null;
  userMessage?: string | null;
  source?: string | null;
  learningType?: string | null;
  learningLayer?: "global" | "personal" | "user";
  userScope?: "admin" | "guest" | "personal" | "user" | null;
  user_id?: string | null;
  environment?: "default" | "personal" | string | null;
  timestamp?: string | number | null;
  weight?: number;
  _personalRuntime?: boolean;
};

type OpenLuraUsageStats = {
  requestCount?: number;
  personalRequestCount?: number;
  imageRequestCount?: number;
  webSearchCount?: number;
  lastRequestAt?: string | null;
  periodKey?: string | null;
  tier?: "free" | "pro" | "admin";
};

type OpenLuraPersonalStateStyleProfile = {
  preferredBrevity?: "tight" | "compact" | "balanced";
  preferredClarity?: "high" | "elevated" | "normal";
  preferredStructure?: "minimal" | "structured" | "balanced";
  preferredDepth?: "concise" | "standard" | "expanded";
  preferredTone?:
    | "casual_light"
    | "casual_balanced"
    | "default_premium"
    | "practical_grounded"
    | "visual_direct";
  hardRules?: string[];
  avoidPatterns?: string[];
  memoryDirectives?: string[];
  updatedAt?: string;
};

type OpenLuraPersonalStateRow = {
  key?: unknown;
  chats?: unknown;
  memory?: unknown;
  feedback?: unknown;
  learning_feedback?: unknown;
  personal_feedback?: unknown;
  personalMemory?: unknown;
  profile_memory?: unknown;
  state?: {
    memory?: unknown;
  } | null;
  style_profile?: unknown;
  usage_stats?: unknown;
};

type OpenLuraPersonalState = {
  userId: string | null;
  memory: string;
  feedback: OpenLuraFeedbackRow[];
  styleProfile: OpenLuraPersonalStateStyleProfile | null;
  usageStats: OpenLuraUsageStats | null;
  raw: OpenLuraPersonalStateRow | null;
};

type OpenLuraPersonalRuntimeContext = {
  personalEnvRequested: boolean;
  isPersonalEnvironment: boolean;
  personalUserId: string | null;
  personalState: OpenLuraPersonalState;
  personalFeedbackRows: OpenLuraFeedbackRow[];
  resolvedPersonalMemory: string;
  learningScope: string;
  accessToken: string | null;
};

type OpenLuraPersonalOverrideProfile = {
  active: boolean;
  preferredBrevity: "tight" | "compact" | "balanced";
  preferredClarity: "high" | "elevated" | "normal";
  preferredStructure: "minimal" | "structured" | "balanced";
  preferredDepth: "concise" | "standard" | "expanded";
  preferredTone:
    | "casual_light"
    | "casual_balanced"
    | "default_premium"
    | "practical_grounded"
    | "visual_direct";
  hardRules: string[];
  avoidPatterns: string[];
  memoryDirectives: string[];
};

async function resolveVerifiedPersonalRuntimeIdentity(req: Request) {
  const softIdentity = await resolveOpenLuraRequestIdentity(req);

  if (!softIdentity.isAuthenticated || !softIdentity.userId || !softIdentity.accessToken) {
    return {
      isAuthenticated: false,
      userId: null,
      accessToken: null,
    };
  }

  const hardIdentity = await requireOpenLuraIdentity(req);

  if (!hardIdentity.ok) {
    return {
      isAuthenticated: false,
      userId: null,
      accessToken: null,
    };
  }

  return {
    isAuthenticated: true,
    userId: hardIdentity.identity.userId,
    accessToken: hardIdentity.identity.accessToken,
  };
}

function normalizePersonalMemoryValue(value: any): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item?.text === "string") return item.text.trim();
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text.trim();

    if (Array.isArray(value.items)) {
      return value.items
        .map((item: any) => {
          if (typeof item === "string") return item.trim();
          if (typeof item?.text === "string") return item.text.trim();
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
  }

  return "";
}

function updateMemoryWeightsFromFeedback(input: {
  memoryItems: { text: string; weight: number }[];
  feedback: any[];
}) {
  const BOOST = 0.35;
  const STRONG_BOOST = 0.6;
  const DECAY = 0.05;

  return input.memoryItems.map((item) => {
    let weight = item.weight;

    for (const f of input.feedback) {
      const text = `${f.userMessage || ""} ${f.message || ""}`.toLowerCase();

      if (!text.includes(item.text.toLowerCase())) continue;

      if (f.type === "up") {
        weight += BOOST;
      }

      if (f.type === "down" || f.type === "improve") {
        weight -= STRONG_BOOST;
      }
    }

    // decay (altijd licht omlaag tenzij boosted)
    weight -= DECAY;

    return {
      text: item.text,
      weight: Math.max(0, Math.min(weight, 3)),
    };
  });
}

function extractWeightedPersonalMemoryItems(value: any) {
  const normalizeItem = (item: any) => {
    if (typeof item === "string") {
      const raw = item.trim();
      if (!raw) return null;

      const priorityMatch = raw.match(/^\d+\.\s*\[(high|medium|light)\]\s*(.+)$/i);
      const priority = priorityMatch?.[1]?.toLowerCase() || null;
      const text = (priorityMatch?.[2] || raw).trim();

      const inferredWeight =
        priority === "high" ? 1.8 : priority === "medium" ? 1.1 : 0.5;

      return text ? { text, weight: inferredWeight } : null;
    }

    if (item && typeof item === "object") {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) return null;

      const rawWeight =
        typeof item.weight === "number" && Number.isFinite(item.weight)
          ? item.weight
          : 0.5;

      return {
        text,
        weight: Math.max(0, Math.min(rawWeight, 3)),
      };
    }

    return null;
  };

  if (Array.isArray(value)) {
    return value
      .map(normalizeItem)
      .filter(Boolean) as { text: string; weight: number }[];
  }

  if (value && typeof value === "object" && Array.isArray(value.items)) {
    return value.items
      .map(normalizeItem)
      .filter(Boolean) as { text: string; weight: number }[];
  }

  const normalized = normalizePersonalMemoryValue(value);
  return normalized ? [{ text: normalized, weight: 0.5 }] : [];
}

function buildWeightedPersonalMemoryBlock(...values: any[]) {
  const merged = cleanupWeightedMemoryItems(
    values.flatMap((value) => extractWeightedPersonalMemoryItems(value)),
    {
      minWeight: 0.35,
      maxItems: 6,
    }
  );

  return merged
    .map((item, index) => {
      const priority =
        item.weight >= 1.5
          ? "high"
          : item.weight >= 0.9
          ? "medium"
          : "light";

      return `${index + 1}. [${priority}] ${item.text}`;
    })
    .join("\n");
}

function normalizeMemoryComparisonText(text: string) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/^\d+\.\s*\[(high|medium|light)\]\s*/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function getMemoryTokenSignature(text: string) {
  return normalizeMemoryComparisonText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .slice(0, 8)
    .sort()
    .join("|");
}

function cleanupWeightedMemoryItems(
  items: { text: string; weight: number }[],
  options?: {
    minWeight?: number;
    maxItems?: number;
  }
) {
  const minWeight = options?.minWeight ?? 0.35;
  const maxItems = options?.maxItems ?? 6;

  const merged = items.reduce((acc: { text: string; weight: number }[], item) => {
    const normalizedText = normalizeMemoryComparisonText(item.text);
    const signature = getMemoryTokenSignature(item.text);

    const existing = acc.find((entry) => {
      const existingNormalizedText = normalizeMemoryComparisonText(entry.text);
      const existingSignature = getMemoryTokenSignature(entry.text);

      return (
        existingNormalizedText === normalizedText ||
        (signature && existingSignature && existingSignature === signature)
      );
    });

    if (existing) {
      existing.weight = Math.max(existing.weight, item.weight);

      if (normalizeMemoryComparisonText(item.text).length >
          normalizeMemoryComparisonText(existing.text).length) {
        existing.text = item.text;
      }

      return acc;
    }

    acc.push({
      text: item.text.trim(),
      weight: Math.max(0, Math.min(item.weight, 3)),
    });

    return acc;
  }, []);

  return merged
    .filter((item) => item.text && item.weight >= minWeight)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxItems);
}

function doesFeedbackMatchMemoryItem(feedback: any, memoryText: string) {
  const feedbackText = `${feedback?.userMessage || ""} ${feedback?.message || ""}`
    .toLowerCase()
    .trim();
  const normalizedMemoryText = String(memoryText || "").toLowerCase().trim();

  if (!feedbackText || !normalizedMemoryText) return false;
  if (feedbackText.includes(normalizedMemoryText)) return true;

  const memoryTokens = normalizedMemoryText
    .split(/[^a-z0-9à-ÿ]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .slice(0, 8);

  if (memoryTokens.length === 0) return false;

  const matchedTokenCount = memoryTokens.filter((token) =>
    feedbackText.includes(token)
  ).length;

  return matchedTokenCount >= Math.min(2, memoryTokens.length);
}

function rebalancePersonalMemoryFromFeedback(input: {
  personalMemory?: string;
  feedbackRows?: any[];
}) {
  const memoryItems = extractWeightedPersonalMemoryItems(input.personalMemory || "");
  const feedbackRows = Array.isArray(input.feedbackRows) ? input.feedbackRows : [];

  if (memoryItems.length === 0) {
    return String(input.personalMemory || "").trim();
  }

  const adjustedItems = memoryItems.map((item) => {
    let nextWeight = item.weight;

    for (const feedback of feedbackRows) {
      if (!doesFeedbackMatchMemoryItem(feedback, item.text)) continue;

      if (feedback?.type === "up") {
        nextWeight += 0.2;
      }

      if (feedback?.type === "down") {
        nextWeight -= 0.3;
      }

      if (feedback?.type === "improve") {
        nextWeight -= 0.2;
      }
    }

    return {
      text: item.text,
      weight: Math.max(0.2, Math.min(nextWeight, 3)),
    };
  });

  const cleanedItems = cleanupWeightedMemoryItems(adjustedItems, {
    minWeight: 0.35,
    maxItems: 6,
  });

  return buildWeightedPersonalMemoryBlock(cleanedItems);
}

function getUsagePeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function resolveUsageTier(input: {
  userScope?: "admin" | "guest" | "personal";
  existingUsageStats?: OpenLuraUsageStats | null;
}) {
  if (input.userScope === "admin") return "admin";
  if (input.existingUsageStats?.tier === "pro") return "pro";
  return "free";
}

function buildUpdatedUsageStats(input: {
  existingUsageStats?: OpenLuraUsageStats | null;
  isPersonalEnvironment: boolean;
  usedWebSearch: boolean;
  usedImage: boolean;
  userScope?: "admin" | "guest" | "personal";
}) {
  const now = new Date();
  const periodKey = getUsagePeriodKey(now);
  const existing = input.existingUsageStats || null;
  const shouldReset = existing?.periodKey !== periodKey;

  const base: OpenLuraUsageStats = shouldReset
    ? {
        requestCount: 0,
        personalRequestCount: 0,
        imageRequestCount: 0,
        webSearchCount: 0,
        lastRequestAt: null,
        periodKey,
        tier: resolveUsageTier({
          userScope: input.userScope,
          existingUsageStats: existing,
        }),
      }
    : {
        requestCount: existing?.requestCount || 0,
        personalRequestCount: existing?.personalRequestCount || 0,
        imageRequestCount: existing?.imageRequestCount || 0,
        webSearchCount: existing?.webSearchCount || 0,
        lastRequestAt: existing?.lastRequestAt || null,
        periodKey,
        tier: resolveUsageTier({
          userScope: input.userScope,
          existingUsageStats: existing,
        }),
      };

  return {
    ...base,
    requestCount: (base.requestCount || 0) + 1,
    personalRequestCount:
      (base.personalRequestCount || 0) + (input.isPersonalEnvironment ? 1 : 0),
    imageRequestCount:
      (base.imageRequestCount || 0) + (input.usedImage ? 1 : 0),
    webSearchCount:
      (base.webSearchCount || 0) + (input.usedWebSearch ? 1 : 0),
    lastRequestAt: now.toISOString(),
  } satisfies OpenLuraUsageStats;
}

function getUsageLimitSnapshot(input: {
  usageStats?: OpenLuraUsageStats | null;
}) {
  const tier = input.usageStats?.tier || "free";

  const limits =
    tier === "admin"
      ? { monthlyRequests: Infinity, monthlyWebSearches: Infinity }
      : tier === "pro"
      ? { monthlyRequests: 5000, monthlyWebSearches: 1500 }
      : { monthlyRequests: 500, monthlyWebSearches: 150 };

  const requestCount = input.usageStats?.requestCount || 0;
  const webSearchCount = input.usageStats?.webSearchCount || 0;

  return {
    tier,
    requestCount,
    webSearchCount,
    monthlyRequests: limits.monthlyRequests,
    monthlyWebSearches: limits.monthlyWebSearches,
    requestsRemaining:
      limits.monthlyRequests === Infinity
        ? Infinity
        : Math.max(0, limits.monthlyRequests - requestCount),
    webSearchesRemaining:
      limits.monthlyWebSearches === Infinity
        ? Infinity
        : Math.max(0, limits.monthlyWebSearches - webSearchCount),
    exceeded:
      (limits.monthlyRequests !== Infinity &&
        requestCount >= limits.monthlyRequests) ||
      (limits.monthlyWebSearches !== Infinity &&
        webSearchCount >= limits.monthlyWebSearches),
  };
}

function buildUsageHeaders(usageLimitSnapshot: {
  tier: string;
  requestCount: number;
  monthlyRequests: number;
  exceeded: boolean;
}) {
  return {
    "X-OpenLura-Usage-Tier": String(usageLimitSnapshot.tier),
    "X-OpenLura-Usage-Exceeded": usageLimitSnapshot.exceeded ? "true" : "false",
    "X-OpenLura-Usage-Used": String(usageLimitSnapshot.requestCount || 0),
    "X-OpenLura-Usage-Limit":
      usageLimitSnapshot.monthlyRequests === Infinity
        ? "0"
        : String(usageLimitSnapshot.monthlyRequests || 0),
  };
}

async function persistSupabasePersonalMemory(input: {
  userId: string;
  accessToken: string;
  memory: string;
  styleProfile?: OpenLuraPersonalStateStyleProfile | null;
  usageStats?: OpenLuraUsageStats | null;
  existingState?: any;
}) {
  if (!input.userId || !input.accessToken) {
    return false;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("OpenLura personal memory persist skipped: missing Supabase config");
    return false;
  }

  const existingState =
    input.existingState && typeof input.existingState === "object"
      ? input.existingState
      : {};

  const existingChats = Array.isArray(existingState.chats) ? existingState.chats : [];
  const memoryItems = extractWeightedPersonalMemoryItems(input.memory);

  const payload = {
    user_id: input.userId,
    chats: existingChats,
    memory: memoryItems,
    style_profile: input.styleProfile || existingState.style_profile || null,
    usage_stats: input.usageStats || existingState.usage_stats || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("apikey", supabaseAnonKey);
    headers.set("Authorization", `Bearer ${input.accessToken}`);
    headers.set("Prefer", "resolution=merge-duplicates,return=minimal");

    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/${personalStateTable}?on_conflict=user_id`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!upsertRes.ok) {
      console.error("OpenLura personal memory persist failed:", {
        status: upsertRes.status,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("OpenLura personal memory persist error:", toSafeErrorMeta(error));
    return false;
  }
}

async function fetchSupabasePersonalState(
  userId: string | null = null,
  accessToken: string | null = null
) {
  const resolvedUserId = userId ?? null;

  if (!resolvedUserId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
    return {
      userId: resolvedUserId,
      memory: "",
      feedback: [],
      styleProfile: null,
      usageStats: null,
      raw: null,
    } satisfies OpenLuraPersonalState;
  }

  const query =
    `select=memory,style_profile,usage_stats,updated_at` +
    `&user_id=eq.${encodeURIComponent(resolvedUserId)}` +
    `&limit=1`;

  try {
    const headers = new Headers();
    headers.set("apikey", supabaseAnonKey);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");

    const res = await fetch(`${supabaseUrl}/rest/v1/${personalStateTable}?${query}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("OpenLura personal state fetch failed:", {
        status: res.status,
      });

      return {
        userId: resolvedUserId,
        memory: "",
        feedback: [],
        styleProfile: null,
        usageStats: null,
        raw: null,
      } satisfies OpenLuraPersonalState;
    }

    const rows: unknown = await res.json();
    const row =
      Array.isArray(rows) && rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null
        ? (rows[0] as OpenLuraPersonalStateRow)
        : null;

    const memoryText =
      row
        ? buildWeightedPersonalMemoryBlock(row.memory) || ""
        : "";

    return {
      userId: resolvedUserId,
      memory: memoryText,
      feedback: [],
      styleProfile:
        row?.style_profile && typeof row.style_profile === "object"
          ? row.style_profile
          : null,
      usageStats:
        row?.usage_stats && typeof row.usage_stats === "object"
          ? row.usage_stats
          : null,
      raw: row,
    } satisfies OpenLuraPersonalState;
  } catch (error) {
    console.error("OpenLura personal state fetch failed:", toSafeErrorMeta(error));

    return {
      userId: resolvedUserId,
      memory: "",
      feedback: [],
      styleProfile: null,
      usageStats: null,
      raw: null,
    } satisfies OpenLuraPersonalState;
  }
}

function mergeLearningFeedbackLayers(input: {
  globalFeedbackSnapshot: OpenLuraFeedbackRow[];
  personalFeedback: OpenLuraFeedbackRow[];
  userFeedback?: OpenLuraFeedbackRow[];
}) {
  const normalizeLayerRows = (
    rows: OpenLuraFeedbackRow[],
    layer: "global" | "personal" | "user"
  ) =>
    rows.map((item) => ({
      ...item,
      userScope:
        layer === "user"
          ? "user"
          : layer === "personal"
          ? "personal"
          : item.userScope || "guest",
      weight:
        (typeof item.weight === "number" && Number.isFinite(item.weight)
          ? item.weight
          : 1) *
        (layer === "user" ? 2.4 : layer === "personal" ? 1.75 : 1),
      source:
        item.source ||
        (layer === "user"
          ? "user_runtime"
          : layer === "personal"
          ? "personal_runtime"
          : "global_runtime"),
      learningLayer: layer,
      timestamp: item.timestamp || new Date().toISOString(),
    }));

  return [
    ...normalizeLayerRows(input.globalFeedbackSnapshot, "global"),
    ...normalizeLayerRows(input.personalFeedback, "personal"),
    ...normalizeLayerRows(input.userFeedback || [], "user"),
  ];
}

function buildPersonalOverrideProfile(input: {
  isPersonalEnvironment: boolean;
  personalFeedbackRows: OpenLuraFeedbackRow[];
  personalMemory?: string;
}) {
  const normalizedMemory = String(input.personalMemory || "").trim();

  const weightedCount = (pattern: RegExp) =>
    Math.round(
      input.personalFeedbackRows.reduce((sum, item) => {
        const learningType = inferFeedbackLearningType(item);
        if (learningType !== "style") return sum;

        const text = `${item.userMessage || ""} ${item.message || ""}`.toLowerCase();
        const weight =
          typeof item.weight === "number" && Number.isFinite(item.weight)
            ? item.weight
            : 1;

        return pattern.test(text) ? sum + weight : sum;
      }, 0)
    );

  const shorter = weightedCount(/korter|te lang|too long|shorter/);
  const clearer = weightedCount(/duidelijker|onduidelijk|clearer|unclear/);
  const structure = weightedCount(/andere structuur|structuur|structure/);
  const vague = weightedCount(/te vaag|vaag|vague|concreet|concreter/);
  const context = weightedCount(/meer context|te oppervlakkig|more context|more depth/);
  const casual = weightedCount(/te serieus|te formeel|menselijker|spontaner|luchtiger|more natural|too formal|too long for chat/);

  const memoryDirectives = normalizedMemory
    ? normalizedMemory
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const hardRules = [
    shorter >= 2 && "Keep replies shorter and remove filler aggressively.",
    clearer >= 2 && "Use simpler wording and make the answer easier to follow.",
    vague >= 2 && "Be concrete and specific. Avoid generic wording.",
    structure >= 2 && "Use cleaner structure and clearer flow.",
    context >= 2 && shorter < 2 && "Add a bit more why/context when useful.",
    casual >= 2 && "In casual chat, sound lighter, warmer, and less formal.",
    input.personalFeedbackRows.length > 0 &&
      "When personal feedback conflicts with global patterns, follow personal feedback first unless the current user request clearly asks otherwise.",
  ].filter(Boolean) as string[];

  const avoidPatterns = [
    shorter >= 2 && "long answers",
    clearer >= 2 && "unclear explanations",
    vague >= 2 && "vague wording",
    structure >= 2 && "messy structure",
    casual >= 2 && "formal essay tone",
  ].filter(Boolean) as string[];

  return {
    active:
      input.isPersonalEnvironment &&
      (input.personalFeedbackRows.length > 0 || memoryDirectives.length > 0),
    preferredBrevity: shorter >= 2 ? "tight" : shorter >= 1 ? "compact" : "balanced",
    preferredClarity: clearer >= 2 || vague >= 2 ? "high" : clearer >= 1 ? "elevated" : "normal",
    preferredStructure: structure >= 2 ? "structured" : casual >= 2 || shorter >= 2 ? "minimal" : "balanced",
    preferredDepth: context >= 2 && shorter === 0 ? "expanded" : shorter >= 2 ? "concise" : "standard",
    preferredTone:
      casual >= 2
        ? "casual_light"
        : context >= 2
        ? "default_premium"
        : "casual_balanced",
    hardRules,
    avoidPatterns,
    memoryDirectives,
  } satisfies OpenLuraPersonalOverrideProfile;
}

type OpenLuraResolvedRuntimeInstructionProfile = {
  tone: string;
  brevity: string;
  structure: string;
  clarity: string;
  depth: string;
  priorityOrder: string;
  hardRules: string[];
  softRules: string[];
  avoidPatterns: string[];
  memoryDirectives: string[];
};

function buildResolvedRuntimeInstructionProfile(input: {
  isPersonalEnvironment: boolean;
  baseProfile: {
    tone: string;
    brevity: string;
    structure: string;
    clarity: string;
    depth: string;
  };
  persistedStyleProfile?: OpenLuraPersonalStateStyleProfile | null;
  personalOverrideProfile: OpenLuraPersonalOverrideProfile;
  activeLearningRulesText: string;
}) {
  const personal = input.personalOverrideProfile;
  const persisted = input.persistedStyleProfile || null;
  const usePersonal = input.isPersonalEnvironment && personal.active;

  return {
    tone: usePersonal
      ? personal.preferredTone
      : persisted?.preferredTone || input.baseProfile.tone,
    brevity: usePersonal
      ? personal.preferredBrevity
      : persisted?.preferredBrevity || input.baseProfile.brevity,
    structure: usePersonal
      ? personal.preferredStructure
      : persisted?.preferredStructure || input.baseProfile.structure,
    clarity: usePersonal
      ? personal.preferredClarity
      : persisted?.preferredClarity || input.baseProfile.clarity,
    depth: usePersonal
      ? personal.preferredDepth
      : persisted?.preferredDepth || input.baseProfile.depth,
    priorityOrder: usePersonal
      ? "user > personal > global > default"
      : "user > global > default",
    hardRules: usePersonal ? personal.hardRules : [],
    softRules: input.activeLearningRulesText
      ? input.activeLearningRulesText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [],
    avoidPatterns: usePersonal ? personal.avoidPatterns : [],
    memoryDirectives: usePersonal ? personal.memoryDirectives : [],
  } satisfies OpenLuraResolvedRuntimeInstructionProfile;
}

function buildRuntimeOverrideInstructionBlock(
  profile: OpenLuraResolvedRuntimeInstructionProfile
) {
  return `Resolved runtime override profile:
- tone: ${profile.tone}
- brevity: ${profile.brevity}
- structure: ${profile.structure}
- clarity: ${profile.clarity}
- depth: ${profile.depth}
- priority order: ${profile.priorityOrder}

Hard override rules:
${profile.hardRules.map((rule) => `- ${rule}`).join("\n") || "- none"}

Avoid patterns:
${profile.avoidPatterns.map((rule) => `- ${rule}`).join("\n") || "- none"}

Personal memory directives:
${profile.memoryDirectives.map((rule) => `- ${rule}`).join("\n") || "- none"}

Soft global rules:
${profile.softRules.map((rule) => `- ${rule.replace(/^- /, "")}`).join("\n") || "- none"}`;
}

async function resolvePersonalRuntimeContext(input: {
  req: Request;
  memory?: string;
}) {
  const personalEnvRequested = isPersonalEnvironmentRequest(input.req);
  const identity = personalEnvRequested
    ? await resolveVerifiedPersonalRuntimeIdentity(input.req)
    : {
        isAuthenticated: false,
        userId: null,
        accessToken: null,
      };

  const personalUserId = identity.userId;
  const accessToken = identity.accessToken;
  const hasAuthenticatedPersonalUser = identity.isAuthenticated;

  const personalState =
    personalEnvRequested && hasAuthenticatedPersonalUser && personalUserId && accessToken
      ? await fetchSupabasePersonalState(personalUserId, accessToken)
      : ({
          userId: null,
          memory: "",
          feedback: [],
          styleProfile: null,
          usageStats: null,
          raw: null,
        } satisfies OpenLuraPersonalState);

  const personalFeedbackRows: OpenLuraFeedbackRow[] =
    personalEnvRequested && hasAuthenticatedPersonalUser && personalUserId && accessToken
      ? await getPersonalFeedbackRows(personalUserId, accessToken)
      : [];

  const isPersonalEnvironment =
    personalEnvRequested && hasAuthenticatedPersonalUser && !!personalUserId && !!accessToken;

  const resolvedPersonalMemory = isPersonalEnvironment
    ? personalState.memory || ""
    : String(input.memory || "").trim();

  const learningScope = isPersonalEnvironment ? "personal" : "global";

  return {
    personalEnvRequested,
    isPersonalEnvironment,
    personalUserId,
    personalState,
    personalFeedbackRows,
    resolvedPersonalMemory,
    learningScope,
    accessToken,
  } satisfies OpenLuraPersonalRuntimeContext;
}

async function fetchSupabaseGlobalFeedbackRows(
  query: string,
  errorLabel: string
): Promise<OpenLuraFeedbackRow[]> {
  if (!supabaseUrl || !supabaseServiceRoleKey) return [];

  const normalizedQuery = String(query || "");

  if (
    normalizedQuery.includes("user_id=eq.") ||
    normalizedQuery.includes("user_id=not.is.null")
  ) {
    console.error(`${errorLabel} blocked unsafe global feedback query`);
    return [];
  }

  // 🔒 FORCE user_id isolation (no injection possible)
const enforcedFilter = "user_id=is.null";

let safeQuery = normalizedQuery;

// remove any existing user_id filters (hard strip)
safeQuery = safeQuery.replace(/user_id=[^&]*/gi, "");

// clean double &&
safeQuery = safeQuery.replace(/&&+/g, "&").replace(/^&|&$/g, "");

// append enforced filter
safeQuery = safeQuery
  ? `${safeQuery}&${enforcedFilter}`
  : enforcedFilter;

  try {
    const headers = new Headers();
    headers.set("apikey", supabaseServiceRoleKey);
    headers.set("Authorization", `Bearer ${supabaseServiceRoleKey}`);
    headers.set("Accept", "application/json");

    const res = await fetch(`${supabaseUrl}/rest/v1/openlura_feedback?${safeQuery}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();

      const isSchemaMismatch =
        res.status === 400 &&
        (
          errorText.includes("PGRST204") ||
          errorText.includes("42703") ||
          errorText.toLowerCase().includes("column") ||
          errorText.toLowerCase().includes("could not find the")
        );

      if (!isSchemaMismatch) {
        logSafeError(errorLabel, new Error(errorText), {
          status: res.status,
        });
      }

      return [];
    }

    const rows: unknown = await res.json();
    return Array.isArray(rows) ? (rows as OpenLuraFeedbackRow[]) : [];
  } catch (error) {
    logSafeError(errorLabel, error);
    return [];
  }
}

async function fetchSupabasePersonalFeedbackRows(input: {
  userId: string;
  accessToken: string;
  limit?: number;
}): Promise<OpenLuraFeedbackRow[]> {
  if (!input.userId || !input.accessToken) return [];
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const limit = Math.min(Math.max(input.limit || 60, 1), 100);

  const query =
    `select=type,message,userMessage,source,learningType,userScope,environment,weight,timestamp,user_id` +
    `&user_id=eq.${encodeURIComponent(input.userId)}` +
    `&order=timestamp.desc` +
    `&limit=${limit}`;

  try {
    const headers = new Headers();
    headers.set("apikey", supabaseAnonKey);
    headers.set("Authorization", `Bearer ${input.accessToken}`);
    headers.set("Accept", "application/json");

    const res = await fetch(`${supabaseUrl}/rest/v1/openlura_feedback?${query}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();

      const isSchemaMismatch =
        res.status === 400 &&
        (
          errorText.includes("PGRST204") ||
          errorText.includes("42703") ||
          errorText.toLowerCase().includes("column") ||
          errorText.toLowerCase().includes("could not find the")
        );

      if (!isSchemaMismatch) {
        logSafeError("OpenLura personal feedback fetch failed:", new Error(errorText), {
          status: res.status,
          userId: input.userId,
        });
      }

      return [];
    }

    const rows: unknown = await res.json();
    return Array.isArray(rows) ? (rows as OpenLuraFeedbackRow[]) : [];
  } catch (error) {
    logSafeError("OpenLura personal feedback fetch failed:", error, {
      userId: input.userId,
    });
    return [];
  }
}

async function getRecentServerFeedback() {
  const primary = await fetchSupabaseGlobalFeedbackRows(
    "select=type,message,userMessage,source,timestamp,user_id&user_id=is.null&order=timestamp.desc&limit=30",
    "OpenLura server feedback fetch failed:"
  );

  if (primary.length > 0) return primary;

  return fetchSupabaseGlobalFeedbackRows(
    "select=type,message,userMessage,source,timestamp&user_id=is.null&order=timestamp.desc&limit=30",
    "OpenLura server feedback fallback fetch failed:"
  );
}

async function getPersonalFeedbackRows(
  userId?: string | null,
  accessToken?: string | null
) {
  if (!userId || !accessToken) return [];

  return fetchSupabasePersonalFeedbackRows({
    userId,
    accessToken,
    limit: 60,
  });
}

function buildAutoDebugSignature(input: {
  userMessage?: string;
  signalSource: string;
  learningType: "style" | "content";
  confidence: "low" | "medium" | "high";
}) {
  return JSON.stringify({
    userMessage: (input.userMessage || "").trim().toLowerCase(),
    signalSource: input.signalSource,
    learningType: input.learningType,
    confidence: input.confidence,
  });
}

function normalizeFeedbackUserScope(
  value: unknown
): "admin" | "guest" | "personal" | "user" | null {
  return value === "admin" ||
    value === "guest" ||
    value === "personal" ||
    value === "user"
    ? value
    : null;
}

function getUserScopeFromRequest(input: {
  isPersonalEnvironment?: boolean;
  hasAdminSession?: boolean;
}): "admin" | "guest" | "personal" {
  if (input.isPersonalEnvironment) {
    return "personal";
  }

  return input.hasAdminSession ? "admin" : "guest";
}

async function storeAutoDebugSignals(input: {
  userMessage?: string;
  signals: {
    type: string;
    confidence: "low" | "medium" | "high";
    message: string;
    learningType: "style" | "content";
    source: string;
    variant: string;
    routeType: "fast_text" | "fast_image" | "search" | "default";
  }[];
}) {
  if (!supabaseUrl || !supabaseServiceRoleKey || input.signals.length === 0) {
    return;
  }

  const recentRows = await fetchSupabaseGlobalFeedbackRows( 
    "select=type,message,userMessage,source,timestamp,user_id&type=eq.auto_debug&user_id=is.null&order=timestamp.desc&limit=50",
    "OpenLura recent auto debug fetch failed:"
  );

  const recentSignatures = new Set(
    recentRows.map((item) =>
      buildAutoDebugSignature({
        userMessage: item.userMessage || "",
        signalSource: String(item.source || "").split("__route_")[0],
        learningType: inferFeedbackLearningType(item),
        confidence:
          (String(item.message || "")
            .toLowerCase()
            .match(/^\[(high|medium|low)\]/)?.[1] as
            | "low"
            | "medium"
            | "high"
            | undefined) || "low",
      })
    )
  );

  const rows = input.signals
    .filter((signal) => {
      const signature = buildAutoDebugSignature({
        userMessage: input.userMessage,
        signalSource: signal.source,
        learningType: signal.learningType,
        confidence: signal.confidence,
      });

      return !recentSignatures.has(signature);
    })
    .map((signal) => ({
      chatId: null,
      msgIndex: null,
      type: "auto_debug",
      message: `[${signal.confidence}] ${signal.message}`,
      userMessage: input.userMessage || null,
      source: `${signal.source}__route_${signal.routeType}__variant_${signal.variant}`,
      learningType: signal.learningType,
      userScope: "guest",
      environment: "default",
      workflowKey: null,
      workflowStatus: null,
      user_id: null,
      timestamp: new Date().toISOString(),
    } satisfies Record<string, unknown>));

  if (
    rows.length === 0 ||
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    return;
  }

  try {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("apikey", supabaseServiceRoleKey);
    headers.set("Authorization", `Bearer ${supabaseServiceRoleKey}`);
    headers.set("Prefer", "return=minimal");

    const res = await fetch(`${supabaseUrl}/rest/v1/openlura_feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(rows),
      cache: "no-store",
    });

    if (res.ok) {
      return;
    }

    const errorText = await res.text();

    const isSchemaMismatch =
      res.status === 400 &&
      (
        errorText.includes("PGRST204") ||
        errorText.includes("42703") ||
        errorText.toLowerCase().includes("column") ||
        errorText.toLowerCase().includes("could not find the")
      );

    if (!isSchemaMismatch) {
      console.error("Auto debug signal save failed:", {
        status: res.status,
        ...toSafeErrorMeta(new Error(errorText)),
      });
      return;
    }

    const fallbackRows = rows.map((row) => ({
      chatId: row.chatId,
      msgIndex: row.msgIndex,
      type: row.type,
      message: row.message,
      userMessage: row.userMessage,
      source: row.source,
      learningType: row.learningType,
      userScope: row.userScope,
      environment: row.environment,
      workflowKey: row.workflowKey,
      workflowStatus: row.workflowStatus,
      user_id: null,
      timestamp: row.timestamp,
    }));

    const fallbackHeaders = new Headers();
    fallbackHeaders.set("Content-Type", "application/json");
    fallbackHeaders.set("apikey", supabaseServiceRoleKey);
    fallbackHeaders.set("Authorization", `Bearer ${supabaseServiceRoleKey}`);
    fallbackHeaders.set("Prefer", "return=minimal");

    const fallbackRes = await fetch(`${supabaseUrl}/rest/v1/openlura_feedback`, {
      method: "POST",
      headers: fallbackHeaders,
      body: JSON.stringify(fallbackRows),
      cache: "no-store",
    });

    if (!fallbackRes.ok) {
      const fallbackErrorText = await fallbackRes.text();

      console.error("Auto debug signal fallback save failed:", {
        status: fallbackRes.status,
        ...toSafeErrorMeta(new Error(fallbackErrorText)),
      });
    }
  } catch (error) {
    console.error("Auto debug signal save error:", toSafeErrorMeta(error));
  }
}

function inferFeedbackLearningType(item: {
  learningType?: string | null;
  message?: string | null;
  userMessage?: string | null;
}) {
  if (item.learningType === "style" || item.learningType === "content") {
    return item.learningType;
  }

  const text = `${item.userMessage || ""} ${item.message || ""}`.toLowerCase();

  const isStyleSignal = /korter|te lang|too long|shorter|duidelijker|onduidelijk|clearer|unclear|andere structuur|structuur|structure|te vaag|vaag|vague|meer context|te oppervlakkig|more context|more depth|te serieus|te formeel|korter en natuurlijker|menselijker|spontaner|luchtiger|more natural|too formal|too long for chat/.test(
    text
  );

  return isStyleSignal ? "style" : "content";
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSafeErrorMeta(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: "Unknown error",
  };
}

function logSafeError(label: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(label, {
    ...extra,
    ...toSafeErrorMeta(error),
  });
}
type ChatRequestBody = {
  message: string;
  image: string | null;
  memory: string;
  location: unknown;
  feedback: {
    likes?: number;
    dislikes?: number;
    issues?: unknown;
    recentIssues?: unknown;
  } | null;
  recentMessages: { role: "user" | "ai"; content: string }[];
};

const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_MESSAGE_LENGTH = 12000;
const MAX_MEMORY_LENGTH = 12000;
const MAX_IMAGE_URL_LENGTH = 20000;
const MAX_RECENT_MESSAGES = 12;
const MAX_RECENT_MESSAGE_LENGTH = 4000;
async function readJsonBodyWithinLimit(req: Request, maxBytes: number) {
  const rawText = await req.text();
  const rawBytes = Buffer.byteLength(rawText, "utf8");

  if (rawBytes > maxBytes) {
    return {
      ok: false as const,
      reason: "too_large" as const,
      body: null,
    };
  }

  try {
    return {
      ok: true as const,
      reason: null,
      body: JSON.parse(rawText) as unknown,
    };
  } catch {
    return {
      ok: false as const,
      reason: "invalid_json" as const,
      body: null,
    };
  }
}

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeOptionalNullableString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeRecentMessages(
  value: unknown
): { role: "user" | "ai"; content: string }[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => isPlainObject(item))
    .map((item) => {
      const role = item.role === "user" || item.role === "ai" ? item.role : null;
      const content = normalizeOptionalString(item.content, MAX_RECENT_MESSAGE_LENGTH);

      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
    .slice(-MAX_RECENT_MESSAGES) as { role: "user" | "ai"; content: string }[];
}

function parseChatRequestBody(body: unknown): ChatRequestBody | null {
  if (!isPlainObject(body)) {
    return null;
  }

  return {
    message: normalizeOptionalString(body.message, MAX_MESSAGE_LENGTH),
    image: normalizeOptionalNullableString(body.image, MAX_IMAGE_URL_LENGTH),
    memory: normalizeOptionalString(body.memory, MAX_MEMORY_LENGTH),
    location: body.location ?? null,
    feedback: isPlainObject(body.feedback)
      ? {
          likes:
            typeof body.feedback.likes === "number" && Number.isFinite(body.feedback.likes)
              ? body.feedback.likes
              : 0,
          dislikes:
            typeof body.feedback.dislikes === "number" &&
            Number.isFinite(body.feedback.dislikes)
              ? body.feedback.dislikes
              : 0,
          issues: body.feedback.issues,
          recentIssues: body.feedback.recentIssues,
        }
      : null,
    recentMessages: normalizeRecentMessages(body.recentMessages),
  };
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildNoStoreTextHeaders(extra?: Record<string, string>) {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    ...(extra ?? {}),
  };
}
function buildRateLimitHeaders(rateLimit: {
  remaining: number;
}) {
  return {
    "X-OpenLura-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-OpenLura-RateLimit-Remaining": String(Math.max(0, rateLimit.remaining)),
  };
}

export async function POST(req: Request) {
  const rateLimit = await checkRateLimit(req);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    );

    return new Response("Too many requests", {
      status: 429,
      headers: buildNoStoreTextHeaders({
        "Retry-After": String(retryAfterSeconds),
        "X-OpenLura-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
        "X-OpenLura-RateLimit-Remaining": "0",
      }),
    });
  }

  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;

  if (
    contentLength !== null &&
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BYTES
  ) {
    return new Response("Request body too large", {
      status: 413,
      headers: buildNoStoreTextHeaders({
        ...buildRateLimitHeaders(rateLimit),
      }),
    });
  }

  const parsedBody = await readJsonBodyWithinLimit(req, MAX_REQUEST_BYTES);

  if (!parsedBody.ok) {
    return new Response(
      parsedBody.reason === "too_large"
        ? "Request body too large"
        : "Invalid request body",
      {
        status: parsedBody.reason === "too_large" ? 413 : 400,
        headers: buildNoStoreTextHeaders({
        ...buildRateLimitHeaders(rateLimit),
      }),
      }
    );
  }

  const body = parseChatRequestBody(parsedBody.body);

  if (!body) {
    return new Response("Invalid request body", {
      status: 400,
      headers: buildNoStoreTextHeaders({
        ...buildRateLimitHeaders(rateLimit),
      }),
    });
  }

  const {
    message,
    image,
    memory,
    location,
    feedback,
    recentMessages,
  } = body;

  if (!message && !image) {
    return new Response("Empty request", {
      status: 400,
      headers: buildNoStoreTextHeaders({
        ...buildRateLimitHeaders(rateLimit),
      }),
    });
  }

  const hasAdminSession = false;

  const {
    personalEnvRequested,
    isPersonalEnvironment,
    personalUserId,
    personalState,
    personalFeedbackRows,
    resolvedPersonalMemory,
    learningScope,
    accessToken,
  } = await resolvePersonalRuntimeContext({
    req,
    memory,
  });

  if (personalEnvRequested && !isPersonalEnvironment) {
    return new Response("Unauthorized", {
      status: 401,
      headers: buildNoStoreTextHeaders({
        ...buildRateLimitHeaders(rateLimit),
      }),
    });
  }

  if (isPersonalEnvironment && !personalUserId) {
    return new Response("Unauthorized", {
      status: 401,
      headers: buildNoStoreTextHeaders({
        ...buildRateLimitHeaders(rateLimit),
      }),
    });
  }

  if (!personalUserId && learningScope === "personal") {
    return new Response("Unauthorized", {
      status: 401,
      headers: buildNoStoreTextHeaders({
        ...buildRateLimitHeaders(rateLimit),
      }),
    });
  }

  const userScope = getUserScopeFromRequest({
    isPersonalEnvironment,
    hasAdminSession,
  });

  const serverFeedback = await getRecentServerFeedback();

    const normalizedServerFeedback: OpenLuraFeedbackRow[] = serverFeedback
  .filter((item: any) => !item.user_id)
  .map((item: any) => ({
    type: item.type,
    message: item.message,
    userMessage: item.userMessage,
    source: item.source,
    learningType: inferFeedbackLearningType(item),
    userScope: normalizeFeedbackUserScope(item.userScope) || "guest",
    user_id: item.user_id ?? null,
    weight: item.userScope === "admin" ? 1.35 : 1,
    timestamp: item.timestamp,
  }));

  const normalizedPersonalFeedbackRows: OpenLuraFeedbackRow[] = personalFeedbackRows.map(
  (item: any) => ({
    type: item.type,
    message: item.message,
    userMessage: item.userMessage,
    source: item.source || "personal_feedback_runtime",
    learningType:
      item.learningType === "style" || item.learningType === "content"
        ? item.learningType
        : inferFeedbackLearningType(item),
    userScope: normalizeFeedbackUserScope(item.userScope) || "personal",
    user_id: item.user_id ?? personalUserId ?? null,
    environment: item.environment ?? "personal",
    weight:
      typeof item.weight === "number" && Number.isFinite(item.weight)
        ? item.weight
        : 1.5,
    timestamp: item.timestamp,
    _personalRuntime: true,
  })
);

    const clientFeedback = feedback
    ? [
        {
          type: "up",
          message,
          userMessage: "",
          learningType: "content",
          timestamp: Date.now(),
          weight: feedback.likes || 0,
        },
        {
          type: "down",
          message: Array.isArray(feedback.issues)
            ? feedback.issues.map((item) => String(item)).join(" | ")
            : "",
          userMessage: Array.isArray(feedback.recentIssues)
            ? feedback.recentIssues.map((item) => String(item)).join(" | ")
            : "",
          learningType: inferFeedbackLearningType({
            message: Array.isArray(feedback.issues)
              ? feedback.issues.map((item) => String(item)).join(" | ")
              : "",
            userMessage: Array.isArray(feedback.recentIssues)
              ? feedback.recentIssues.map((item) => String(item)).join(" | ")
              : "",
          }),
          timestamp: Date.now(),
          weight: feedback.dislikes || 0,
        },
      ].filter(
        (item: any) =>
          (item.type === "up" && item.weight > 0) ||
          (item.type === "down" &&
            (item.weight > 0 || item.message || item.userMessage))
      )
    : [];

                const globalLearningFeedback = normalizedServerFeedback.filter(
    (item: any) =>
      !item.user_id &&
      (
        item.type === "up" ||
        item.type === "down" ||
        item.type === "improve" ||
        item.source === "idea_feedback_learning"
      )
  );

    const currentGlobalFeedbackSnapshot =
      getGlobalFeedbackSnapshot(globalLearningFeedback);

 const normalizedPersonalStateFeedback: OpenLuraFeedbackRow[] = (
  Array.isArray(personalState.feedback) ? personalState.feedback : []
).map((item: any) => ({
  type: item.type,
  message: item.message,
  userMessage: item.userMessage,
  source: item.source || "personal_state_runtime",
  learningType: inferFeedbackLearningType(item),
  userScope: "personal",
  user_id: item.user_id ?? personalUserId ?? null,
  weight:
    typeof item.weight === "number" && Number.isFinite(item.weight)
      ? item.weight
      : 1.25,
  timestamp: item.timestamp,
}));

  const userRuntimeFeedback = clientFeedback.map((item: any) => ({
    ...item,
    source: item.source || "request_runtime_feedback",
    userScope: "user",
    user_id: personalUserId ?? null,
    weight:
      typeof item.weight === "number" && Number.isFinite(item.weight)
        ? Math.max(item.weight, 1)
        : 1,
  }));

  const personalLearningFeedback = [
    ...normalizedPersonalFeedbackRows,
    ...normalizedPersonalStateFeedback,
  ];

  const effectiveFeedback = mergeLearningFeedbackLayers({
    globalFeedbackSnapshot: globalLearningFeedback,
    personalFeedback: isPersonalEnvironment ? personalLearningFeedback : [],
    userFeedback: userRuntimeFeedback,
  });

  const personalLayer = isPersonalEnvironment ? personalLearningFeedback : [];
  const userLayer: OpenLuraFeedbackRow[] = userRuntimeFeedback;

  const runtimePersonalMemory = rebalancePersonalMemoryFromFeedback({
    personalMemory: resolvedPersonalMemory,
    feedbackRows: [...personalLayer, ...userLayer],
  });

  const shouldPersistRuntimeMemory =
    isPersonalEnvironment &&
    !!personalUserId &&
    !!runtimePersonalMemory.trim() &&
    runtimePersonalMemory.trim() !== String(resolvedPersonalMemory || "").trim();

  const shouldPersistUsageStats =
    isPersonalEnvironment &&
    !!personalUserId;

  const feedbackLikes = globalLearningFeedback.filter(
    (f: any) => f.type === "up"
  ).length;

  const feedbackDislikes = globalLearningFeedback.filter(
    (f: any) => f.type === "down"
  ).length;

    const feedbackRecentIssues = globalLearningFeedback
    .filter(
      (f: any) => f.type === "down" || f.source === "idea_feedback_learning"
    )
    .map((f: any) => f.userMessage || f.message)
    .filter(Boolean)
    .slice(0, 5);

  const personalRecentIssues = personalLearningFeedback
    .filter(
      (f: any) => f.type === "down" || f.source === "idea_feedback_learning"
    )
    .map((f: any) => f.userMessage || f.message)
    .filter(Boolean)
    .slice(0, 5);

    const feedbackContext =
    globalLearningFeedback.length > 0
      ? `
Likes: ${feedbackLikes}
Dislikes: ${feedbackDislikes}

Recent global issues:
${feedbackRecentIssues.join("\n") || "none"}
`
      : "none";

  const personalFeedbackContext =
    personalLearningFeedback.length > 0
      ? `
Personal issues from this user/session:
${personalRecentIssues.join("\n") || "none"}
`
      : "none";

  const normalizePromptText = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[!?.,]+$/g, "")
      .replace(/\s+/g, " ");

  const hasRecentConversationContext =
    Array.isArray(recentMessages) &&
    recentMessages.some(
      (msg: any) =>
        msg &&
        (msg.role === "user" || msg.role === "ai") &&
        typeof msg.content === "string" &&
        msg.content.trim()
    );

  const recentConversationTranscript = Array.isArray(recentMessages)
    ? recentMessages
        .filter(
          (msg: any) =>
            msg &&
            (msg.role === "user" || msg.role === "ai") &&
            typeof msg.content === "string" &&
            msg.content.trim()
        )
        .slice(-6)
        .map(
          (msg: any) =>
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content.trim()}`
        )
        .join("\n\n")
    : "none";

  const normalizedMessage = normalizePromptText(message || "");

  const shouldReuseExactMessagePreference =
    !!normalizedMessage && !isRefinementInstruction(normalizedMessage);

  const matchingGlobalResponses = shouldReuseExactMessagePreference
    ? effectiveFeedback.filter((f: any) => {
        const promptText = normalizePromptText(f.userMessage || "");
        return promptText === normalizedMessage && !!(f.message || "").trim();
      })
    : [];

  const groupedResponsePreferences = matchingGlobalResponses.reduce(
    (acc: any, item: any) => {
      const responseText = String(item.message || "").trim();
      if (!responseText) return acc;

      if (!acc[responseText]) {
        acc[responseText] = {
          response: responseText,
          up: 0,
          down: 0,
          userUp: 0,
          userDown: 0,
          personalUp: 0,
          personalDown: 0,
        };
      }

      const weight =
        typeof item.weight === "number" && Number.isFinite(item.weight)
          ? item.weight
          : 1;

      if (item.type === "up") {
        acc[responseText].up += weight;

        if (item.learningLayer === "user") {
          acc[responseText].userUp = (acc[responseText].userUp || 0) + weight;
        }

        if (item.learningLayer === "personal") {
          acc[responseText].personalUp += weight;
        }
      }

      if (item.type === "down") {
        acc[responseText].down += weight;

        if (item.learningLayer === "user") {
          acc[responseText].userDown = (acc[responseText].userDown || 0) + weight;
        }

        if (item.learningLayer === "personal") {
          acc[responseText].personalDown += weight;
        }
      }

      return acc;
    },
    {}
  );

  const rankedResponsePreferences = Object.values(groupedResponsePreferences)
    .map((item: any) => ({
      ...item,
      score: item.up - item.down,
      total: item.up + item.down,
      userScore: (item.userUp || 0) - (item.userDown || 0),
      personalScore: item.personalUp - item.personalDown,
    }))
    .sort((a: any, b: any) => {
      if (b.userScore !== a.userScore) return b.userScore - a.userScore;
      if (b.personalScore !== a.personalScore) return b.personalScore - a.personalScore;
      if ((b.userUp || 0) !== (a.userUp || 0)) return (b.userUp || 0) - (a.userUp || 0);
      if (b.score !== a.score) return b.score - a.score;
      if (b.personalUp !== a.personalUp) return b.personalUp - a.personalUp;
      if (b.up !== a.up) return b.up - a.up;
      return b.total - a.total;
    });

  const bestPersonalResponsePreference = rankedResponsePreferences.find(
  (item: any) => (item.personalUp || 0) > 0 || (item.personalDown || 0) > 0
);

const bestResponsePreference =
  bestPersonalResponsePreference || rankedResponsePreferences[0];
  const hasMixedResponseFeedback =
    rankedResponsePreferences.some((item: any) => item.up > 0) &&
    rankedResponsePreferences.some((item: any) => item.down > 0);

  const responsePreferenceContext = bestResponsePreference
    ? `
Best known response for this exact user message:
${bestResponsePreference.response}

Score: ${bestResponsePreference.score}
Positive votes: ${bestResponsePreference.up}
Negative votes: ${bestResponsePreference.down}
Mixed feedback exists: ${hasMixedResponseFeedback ? "yes" : "no"}
`
    : "none";

  const contentLearningState = buildContentLearningState({
    responsePreferenceContext,
    hasMixedResponseFeedback,
    bestResponsePreference,
  });

  const successfulResponseReuse = buildSuccessfulResponseReuse({
    bestResponsePreference: contentLearningState.bestResponsePreference,
    hasMixedResponseFeedback: contentLearningState.hasMixedResponseFeedback,
  });

    const completedFeedback = normalizedServerFeedback.filter(
    (f: any) =>
      f.type === "workflow_status" &&
      f.source === "analytics_workflow" &&
      f.message === "klaar"
  );

  const negativeFeedbackTexts = effectiveFeedback
    .filter((f: any) => f.type === "down" || f.type === "improve")
    .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
    .join(" ");

    const detectedFeedbackPatterns = [
    {
      label: "Users prefer shorter answers",
      active:
        negativeFeedbackTexts.includes("korter") ||
        negativeFeedbackTexts.includes("te lang") ||
        negativeFeedbackTexts.includes("too long") ||
        negativeFeedbackTexts.includes("shorter"),
    },
    {
      label: "Users want clearer explanations",
      active:
        negativeFeedbackTexts.includes("duidelijker") ||
        negativeFeedbackTexts.includes("onduidelijk") ||
        negativeFeedbackTexts.includes("clearer") ||
        negativeFeedbackTexts.includes("unclear"),
    },
    {
      label: "Users want more depth or context",
      active:
        negativeFeedbackTexts.includes("meer context") ||
        negativeFeedbackTexts.includes("te oppervlakkig") ||
        negativeFeedbackTexts.includes("more context") ||
        negativeFeedbackTexts.includes("more depth"),
    },
    {
      label: "Users want a different structure",
      active:
        negativeFeedbackTexts.includes("andere structuur") ||
        negativeFeedbackTexts.includes("structuur") ||
        negativeFeedbackTexts.includes("structure"),
    },
    {
      label: "Users dislike vague answers",
      active:
        negativeFeedbackTexts.includes("te vaag") ||
        negativeFeedbackTexts.includes("vaag") ||
        negativeFeedbackTexts.includes("vague"),
    },
  ]
    .filter((item) => item.active)
    .map((item) => `- ${item.label}`)
    .join("\n");

          const getDecayWeight = (timestamp: string | number | undefined) => {
    if (!timestamp) return 0.4;

    const time = new Date(timestamp).getTime();
    if (Number.isNaN(time)) return 0.4;

    const ageDays = (Date.now() - time) / (1000 * 60 * 60 * 24);

    if (ageDays <= 3) return 1;
    if (ageDays <= 7) return 0.85;
    if (ageDays <= 14) return 0.7;
    if (ageDays <= 30) return 0.5;
    return 0.25;
  };

    const getPersonalFeedbackBoost = (f: any) => {
  const isPersonal =
    f?.userScope === "personal" ||
    f?.environment === "personal" ||
    f?._personalRuntime === true;

  if (!isPersonal) return 1;

  if (f?.type === "down" || f?.type === "improve") {
    return 2.8;
  }

  if (f?.type === "up") {
    return 1.6;
  }

  return 2.2;
};

const getWeightedSignalCount = (items: any[], pattern: RegExp) => {
  return Math.round(
    items.reduce((sum: number, f: any) => {
      const learningType = inferFeedbackLearningType(f);

      if (learningType !== "style") {
        return sum;
      }

      const text = `${f.userMessage || ""} ${f.message || ""}`.toLowerCase();
      const baseWeight =
        typeof f.weight === "number" && Number.isFinite(f.weight) ? f.weight : 1;
      const personalBoost = getPersonalFeedbackBoost(f);

      return pattern.test(text)
        ? sum + getDecayWeight(f.timestamp) * baseWeight * personalBoost
        : sum;
    }, 0)
  );
};

  const getFeedbackSignals = (items: any[]) => ({
    shorter: getWeightedSignalCount(items, /korter|te lang|too long|shorter/),
    clearer: getWeightedSignalCount(items, /duidelijker|onduidelijk|clearer|unclear/),
    structure: getWeightedSignalCount(items, /andere structuur|structuur|structure/),
    vague: getWeightedSignalCount(items, /te vaag|vaag|vague/),
    context: getWeightedSignalCount(items, /meer context|te oppervlakkig|more context|more depth/),
    casual: getWeightedSignalCount(items, /te lang voor chat|te serieus|te formeel|korter en natuurlijker|menselijker|spontaner|luchtiger|more natural|too formal|too long for chat/),
  });

      const getSignalConfidence = (count: number) => {
    if (count >= 6) return "High";
    if (count >= 3) return "Medium";
    if (count >= 1) return "Low";
    return "None";
  };

  const personalEffectiveFeedback = effectiveFeedback.filter(
    (f: any) =>
      f?.userScope === "personal" ||
      f?.environment === "personal" ||
      f?._personalRuntime === true
  );

  const globalEffectiveFeedback = effectiveFeedback.filter(
    (f: any) =>
      f?.userScope !== "personal" &&
      f?.environment !== "personal" &&
      f?._personalRuntime !== true
  );

  const feedbackSignals = getFeedbackSignals(effectiveFeedback);
  const personalFeedbackSignals = getFeedbackSignals(personalEffectiveFeedback);
  const globalFeedbackSnapshotSignals = getFeedbackSignals(globalEffectiveFeedback);

  const styleLearningSignals = buildStyleLearningSignals({
    shorter: feedbackSignals.shorter,
    clearer: feedbackSignals.clearer,
    structure: feedbackSignals.structure,
    vague: feedbackSignals.vague,
    context: feedbackSignals.context,
    casual: feedbackSignals.casual,
  });

  const shorterCount = styleLearningSignals.shorter;
  const clearerCount = styleLearningSignals.clearer;
  const structureCount = styleLearningSignals.structure;
  const vagueCount = styleLearningSignals.vague;
  const contextCount = styleLearningSignals.context;
  const casualCount = styleLearningSignals.casual;

  const learningConfidence = {
    shorter: getSignalConfidence(shorterCount),
    clearer: getSignalConfidence(clearerCount),
    structure: getSignalConfidence(structureCount),
    vague: getSignalConfidence(vagueCount),
    context: getSignalConfidence(contextCount),
    casual: getSignalConfidence(casualCount),
  };

        const cappedLearningStrength = {
    shorter: Math.min(shorterCount, 8),
    clearer: Math.min(clearerCount, 8),
    structure: Math.min(structureCount, 8),
    vague: Math.min(vagueCount, 8),
    context: Math.min(contextCount, 8),
    casual: Math.min(casualCount, 8),
  };

  const resolvedActiveLearningRules = buildActiveLearningRules({
    learningConfidence,
    cappedLearningStrength,
  });

    const activeLearningRules = [
    shorterCount >= 1 &&
      `- Prefer shorter, tighter answers with less filler (strength: ${cappedLearningStrength.shorter}, confidence: ${learningConfidence.shorter}, mode: ${resolvedActiveLearningRules.shorter ? "strong" : resolvedActiveLearningRules.soft.shorter ? "light" : "off"})`,
    clearerCount >= 1 &&
      `- Use simpler wording and make the explanation easier to follow (strength: ${cappedLearningStrength.clearer}, confidence: ${learningConfidence.clearer}, mode: ${resolvedActiveLearningRules.clearer ? "strong" : resolvedActiveLearningRules.soft.clearer ? "light" : "off"})`,
    structureCount >= 1 &&
      `- Use cleaner structure with clearer sections and flow (strength: ${cappedLearningStrength.structure}, confidence: ${learningConfidence.structure}, mode: ${resolvedActiveLearningRules.structured ? "strong" : resolvedActiveLearningRules.soft.structured ? "light" : "off"})`,
    vagueCount >= 1 &&
      `- Be more concrete, specific, and less generic (strength: ${cappedLearningStrength.vague}, confidence: ${learningConfidence.vague}, mode: ${resolvedActiveLearningRules.moreConcrete ? "strong" : resolvedActiveLearningRules.soft.moreConcrete ? "light" : "off"})`,
    contextCount >= 1 &&
      `- Add a bit more depth and explain the why more clearly (strength: ${cappedLearningStrength.context}, confidence: ${learningConfidence.context}, mode: ${resolvedActiveLearningRules.moreContext ? "strong" : resolvedActiveLearningRules.soft.moreContext ? "light" : "off"})`,
    casualCount >= 1 &&
      `- In casual conversation, sound lighter, shorter, and more natural instead of formal or essay-like (strength: ${cappedLearningStrength.casual}, confidence: ${learningConfidence.casual}, mode: ${resolvedActiveLearningRules.casualTone ? "strong" : resolvedActiveLearningRules.soft.casualTone ? "light" : "off"})`,
  ]
    .filter(Boolean)
    .join("\n");

    const injectedLearningRules = effectiveFeedback
    .filter(
      (f: any) =>
        (f.type === "improve" || f.source === "idea_feedback_learning") &&
        inferFeedbackLearningType(f) === "style"
    )
    .map((f: any) => (f.message || f.userMessage || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((rule: string) => `- ${rule}`)
    .join("\n");

  let globalSignals = {
    shorter: 0,
    clearer: 0,
    structure: 0,
  };

  try {
    const feedbackData = await fetchSupabaseGlobalFeedbackRows(
  "select=message,type,user_id&user_id=is.null",
  "Global learning fetch failed:"
);

      feedbackData
        .filter((f: any) => !f.user_id && f.userScope !== "personal")
        .forEach((f: any) => {
        const text = `${f.message || ""}`.toLowerCase();
        const learningType = inferFeedbackLearningType(f);

        if (
          learningType === "style" &&
          (f.type === "down" || f.type === "improve" || f.type === "idea")
        ) {
          if (text.match(/korter|te lang|too long|shorter/)) globalSignals.shorter += 1;
          if (text.match(/duidelijker|onduidelijk|clearer|unclear/)) globalSignals.clearer += 1;
          if (text.match(/structuur|structure|opbouw/)) globalSignals.structure += 1;
        }

        if (learningType === "style" && f.type === "up") {
          if (text.match(/korter|short/)) globalSignals.shorter -= 0.5;
          if (text.match(/duidelijk|clear/)) globalSignals.clearer -= 0.5;
        }
      });
  } catch (e) {
    console.warn("Global learning fetch failed:", toSafeErrorMeta(e));
  }

    let responseVariant = "A";

  try {
    const feedbackData = await fetchSupabaseGlobalFeedbackRows(
  "select=type,source,user_id&user_id=is.null",
  "A/B feedback fetch failed:"
);

    const globalAbFeedback = feedbackData.filter(
      (f: any) => !f.user_id && f.userScope !== "personal"
    );

    const variantA = globalAbFeedback.filter((f: any) => f.source === "ab_test_A");
    const variantB = globalAbFeedback.filter((f: any) => f.source === "ab_test_B");

    const scoreA =
      variantA.filter((f: any) => f.type === "up").length -
      variantA.filter((f: any) => f.type === "down").length;

    const scoreB =
      variantB.filter((f: any) => f.type === "up").length -
      variantB.filter((f: any) => f.type === "down").length;

    if (variantA.length < 5 || variantB.length < 5) {
      responseVariant = Math.random() < 0.5 ? "A" : "B";
    } else if (scoreA > scoreB) {
      responseVariant = Math.random() < 0.8 ? "A" : "B";
    } else if (scoreB > scoreA) {
      responseVariant = Math.random() < 0.8 ? "B" : "A";
    } else {
      responseVariant = Math.random() < 0.5 ? "A" : "B";
    }
  } catch {
    responseVariant = Math.random() < 0.5 ? "A" : "B";
  }

    const {
      normalizedMessage: normalizedMessageForRouting,
      isSimpleImageAnalysis,
      shouldUseWebSearch,
      isCasualChatRequest,
      shouldForceFastCompactOutput,
      shouldUseFastTextPath,
    } = classifyOpenLuraRoute({
      message,
      image,
    });

    const conversationDependentFollowUp =
      !image &&
      isConversationDependentFollowUp(message || "") &&
      hasRecentConversationContext;

    const updatedUsageStats = buildUpdatedUsageStats({
      existingUsageStats: personalState.usageStats,
      isPersonalEnvironment,
      usedWebSearch: shouldUseWebSearch,
      usedImage: !!image,
      userScope,
    });

    const usageLimitSnapshot = getUsageLimitSnapshot({
      usageStats: updatedUsageStats,
    });

    const shouldBlockForUsageLimit =
      isPersonalEnvironment &&
      usageLimitSnapshot.exceeded &&
      userScope !== "admin";

    if (shouldBlockForUsageLimit) {
      if (personalUserId && accessToken) {
        await persistSupabasePersonalMemory({
          userId: personalUserId,
          accessToken,
          memory: runtimePersonalMemory,
          styleProfile: personalState.styleProfile,
          usageStats: updatedUsageStats,
          existingState: personalState.raw,
        });
      }

      const limitMessage =
        usageLimitSnapshot.tier === "free"
          ? "Je hebt je maandelijkse limiet bereikt voor je huidige plan. Upgrade nodig om door te gaan met je persoonlijke AI."
          : "Je huidige gebruikslimiet is bereikt. Controleer je plan of verhoog je limiet.";

      return new Response(limitMessage, {
        status: 429,
        headers: buildNoStoreTextHeaders({
          "X-OpenLura-Variant": responseVariant,
          "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
          ...buildUsageHeaders(usageLimitSnapshot),
            "X-OpenLura-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
          "Retry-After": "86400",
        }),
      });
    }

    const responseStyleProfile = buildResponseStyleProfile({
      isCasualChatRequest,
      shouldUseWebSearch,
      isSimpleImageAnalysis,
      learningConfidence,
      cappedLearningStrength,
      activeLearningRules: resolvedActiveLearningRules,
    });

    const sharedStyleInstructionBlock = buildSharedStyleInstructionBlock({
      responseStyleProfile,
      cappedLearningStrength,
      activeLearningRules: resolvedActiveLearningRules,
    });

    const personalOverrideProfile = buildPersonalOverrideProfile({
      isPersonalEnvironment,
      personalFeedbackRows: personalLearningFeedback,
      personalMemory: runtimePersonalMemory,
    });

    if ((shouldPersistRuntimeMemory || shouldPersistUsageStats) && personalUserId && accessToken) {
      await persistSupabasePersonalMemory({
        userId: personalUserId,
        accessToken,
        memory: runtimePersonalMemory,
        styleProfile: {
          preferredBrevity: personalOverrideProfile.preferredBrevity,
          preferredClarity: personalOverrideProfile.preferredClarity,
          preferredStructure: personalOverrideProfile.preferredStructure,
          preferredDepth: personalOverrideProfile.preferredDepth,
          preferredTone: personalOverrideProfile.preferredTone,
          hardRules: personalOverrideProfile.hardRules,
          avoidPatterns: personalOverrideProfile.avoidPatterns,
          memoryDirectives: personalOverrideProfile.memoryDirectives,
          updatedAt: new Date().toISOString(),
        },
        usageStats: updatedUsageStats,
        existingState: personalState.raw,
      });
    }

    const resolvedRuntimeInstructionProfile =
      buildResolvedRuntimeInstructionProfile({
        isPersonalEnvironment,
        baseProfile: responseStyleProfile,
        persistedStyleProfile: personalState.styleProfile,
        personalOverrideProfile,
        activeLearningRulesText: activeLearningRules,
      });

    const runtimeOverrideInstructionBlock =
      buildRuntimeOverrideInstructionBlock(
        resolvedRuntimeInstructionProfile
      );

    const fastRouteDecisionInput = {
      shouldUseFastTextPath: conversationDependentFollowUp
        ? false
        : shouldUseFastTextPath,
      isCasualChatRequest,
      casualSignalStrength: cappedLearningStrength.casual,
      hasContentPreference: contentLearningState.hasContentPreference,
      hasMixedResponseFeedback: contentLearningState.hasMixedResponseFeedback,
      bestResponsePreferenceScore:
        contentLearningState.bestResponsePreference?.score || 0,
      shouldApplyContentPreference:
        contentLearningState.shouldApplyContentPreference,
    };

    const shouldUseFastTextRoute =
      !conversationDependentFollowUp &&
      shouldUseAdaptiveSpeedMode(fastRouteDecisionInput) &&
      !shouldBypassFastTextPath(fastRouteDecisionInput);

    const resolvedRouteType: "fast_text" | "fast_image" | "search" | "default" =
      shouldUseFastTextRoute
        ? "fast_text"
        : isSimpleImageAnalysis && image
        ? "fast_image"
        : shouldUseWebSearch
        ? "search"
        : "default"; 

        if (shouldUseFastTextRoute) {
      const cacheKey = isRefinementInstruction(message || "")
          ? ""
          : buildCacheKey({
              message: message || "",
              personalMemory: runtimePersonalMemory,
              learningScope,
              isPersonalEnvironment,
              personalUserId,
            });

      const cached = cacheKey ? responseCache.get(cacheKey) : null;

      if (cached && Date.now() - cached.timestamp < RESPONSE_CACHE_TTL_MS) {
        return new Response(cached.text, {
          headers: buildNoStoreTextHeaders({
            "X-OpenLura-Variant": responseVariant,
            "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
            "X-OpenLura-Speed": "fast_text",
            "X-OpenLura-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
            ...buildUsageHeaders(usageLimitSnapshot),
          }),
        });
      }

      const fastStream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are OpenLura.

Respond in the same language as the user.
Keep short prompts fast, natural, and direct.
Do not use long structure for greetings or tiny prompts.
Keep the answer useful but compact.

${sharedStyleInstructionBlock}

Fast-path runtime learning:
- personal environment active: ${isPersonalEnvironment ? "yes" : "no"}
- learning scope: ${learningScope}
- personal memory: ${runtimePersonalMemory || "none"}
- memory priority rule: when personal memory exists, follow higher-priority memory items before weaker global style hints unless the current user request conflicts

Runtime override block:
${runtimeOverrideInstructionBlock}

Exact-message content preference:
${contentLearningState.responsePreferenceContext}

Successful response reuse:
- reusable winner exists: ${successfulResponseReuse.reusableWinner ? "yes" : "no"}
- winner score: ${successfulResponseReuse.winnerScore}
- winner text:
${successfulResponseReuse.winnerText || "none"}

Fast-path rules:
- Prefer shorter replies when possible
- Be clearer and less vague
- If the prompt is casual, sound light and natural
- Do not go into essay mode
- Only expand if the user clearly asks for more detail
- If structure is minimal, keep formatting very light
- If structure is shortlist, prioritize the strongest options only
- If personal environment is active, prioritize personal learning over global learning
- Personal feedback signals override global signals when conflict exists
- Negative personal feedback must be treated as high priority corrections
- Treat personal memory as ranked guidance: high before medium before light
- Memory weights evolve from feedback: reinforce good patterns, suppress bad ones
- When personal environment is active, updated personal memory may be persisted for future sessions
- Low-signal or duplicate personal memory may be merged down or removed over time
- Use personal memory to shape tone, wording, and focus, but never override the user's current request
- If a strong reusable winner exists for the same message, reuse its shape, directness, and usefulness
- Do not copy old answers blindly word-for-word
- If feedback is mixed, create a cleaner balanced version instead of repeating the old answer`,
          },
          {
            role: "user",
            content: message || "",
          },
        ],
      });

      const encoder = new TextEncoder();

            return new Response(
        new ReadableStream({
          async start(controller) {
            let fullText = "";

            for await (const chunk of fastStream as any) {
              const text = chunk.choices?.[0]?.delta?.content || "";
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }

            const cacheKey = buildCacheKey({
              message: message || "",
              personalMemory: runtimePersonalMemory,
              learningScope,
              isPersonalEnvironment,
              personalUserId,
            });

            if (cacheKey && fullText.trim()) {
              responseCache.set(cacheKey, {
                text: fullText,
                sources: [],
                timestamp: Date.now(),
              });

              if (responseCache.size > 100) {
                const oldestKey = responseCache.keys().next().value as string | undefined;
                if (oldestKey) {
                  responseCache.delete(oldestKey);
                }
              }
            }

            controller.close();
          },
        }),
        {
          headers: buildNoStoreTextHeaders({
            "X-OpenLura-Variant": responseVariant,
            "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
            "X-OpenLura-Speed": "fast_image",
            ...buildRateLimitHeaders(rateLimit),
            ...buildUsageHeaders(usageLimitSnapshot),
          }),
        }
      );
    }

        if (isSimpleImageAnalysis && image) {
      const fastImageStream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are OpenLura.

Respond in the same language as the user.
Analyze the image directly.
Be fast, clear, and compact first.
If something is uncertain, say that clearly.
Do not use web search for this path.`,
          },
          {
            role: "user",
            content: [
              ...(message
                ? [
                    {
                      type: "text",
                      text: message,
                    },
                  ]
                : []),
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ] as any,
          },
        ],
      });

      const encoder = new TextEncoder();

      return new Response(
        new ReadableStream({
          async start(controller) {
            for await (const chunk of fastImageStream as any) {
              const text = chunk.choices?.[0]?.delta?.content || "";
              controller.enqueue(encoder.encode(text));
            }
            controller.close();
          },
        }),
        {
          headers: buildNoStoreTextHeaders({
            "X-OpenLura-Variant": responseVariant,
            "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
            "X-OpenLura-Speed": "fast_image",
            ...buildRateLimitHeaders(rateLimit),
            ...buildUsageHeaders(usageLimitSnapshot),
          }),
        }
      );
    }

    const canUseCache =
      !image &&
      !shouldUseWebSearch &&
      !conversationDependentFollowUp &&
      !isRefinementInstruction(normalizedMessageForRouting) &&
      !!normalizedMessageForRouting &&
      normalizedMessageForRouting.length <= 120;

      const cacheKey = canUseCache
    ? buildCacheKey({
        message: normalizedMessageForRouting,
        personalMemory: runtimePersonalMemory,
        learningScope: `${learningScope}:${shouldForceFastCompactOutput ? "fast" : responseVariant}`,
        isPersonalEnvironment,
        personalUserId,
      })
    : "";

    if (canUseCache) {
      const cached = responseCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < RESPONSE_CACHE_TTL_MS) {
        return new Response(cached.text, {
          headers: buildNoStoreTextHeaders({
            "X-OpenLura-Variant": responseVariant,
            "X-OpenLura-Sources": encodeURIComponent(
              JSON.stringify(Array.isArray(cached.sources) ? cached.sources : [])
            ),
            "X-OpenLura-Speed": "default",
            "X-OpenLura-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
            ...buildUsageHeaders(usageLimitSnapshot),
          }),
        });
      }
    }

        const isLightPrompt =
      !image &&
      !shouldUseWebSearch &&
      !!normalizedMessageForRouting &&
      normalizedMessageForRouting.length <= 120;

    const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    store: false,
    tools: shouldUseWebSearch ? [{ type: "web_search_preview" }] : [],
    include: shouldUseWebSearch ? ["web_search_call.action.sources"] : [],
    text: {
      verbosity: "medium",
    },
    instructions: isLightPrompt
      ? `You are OpenLura.

Respond in the same language as the user.
Be clear, useful, and direct.
Avoid long structured sections unless needed.`
      : `
You are OpenLura.

You improve yourself based on user feedback.

CRITICAL RULES:
- Detect the language of the user message and ALWAYS respond in that same language
- NEVER mix languages
- NEVER write "(blank line)"
- Learn from feedback: avoid disliked responses and reinforce liked ones
- Use live web search when the user asks for current, local, location-based, business, travel, venue, opening-hours, review, route, event, or factual web-dependent information
- When web search is used:
  → ALWAYS include at least 2–3 real sources in the answer
  → Mention actual names of places, products, or locations
  → Prefer clickable, real-world useful results (restaurants, places, pages)
  → If possible, refer to the source naturally in the answer (not only at the bottom)

- Never give generic lists without sources
- Never give “top 10” style answers without at least some real references
- If you list places, businesses, cafés, restaurants, venues, or locations, prefer 3 to 5 stronger options instead of long vague lists
- For location or business recommendations, only mention options that can be supported by web results
- Make the answer itself explain WHY each option is relevant (not just names)
- For search answers: prioritize usefulness → what it is, why it fits, and what stands out
- If sources exist: align the explanation with them so links feel connected
- Never invent sources, links, addresses, ratings, opening hours, or locations
- If the answer depends on fresh web information, prefer searched information over guessing
- If an image is present and no text is provided, treat the request as: "Analyze this image and tell me clearly what it shows"
- If an image is present and text is also provided, answer the user's question using the image as primary context
- For simple image questions like "wat is dit", "wie is dit", "what is this", or "who is this", analyze the image directly first and do not rely on web search
- Only use web search with an image when the user asks for location, business, venue, travel, restaurant, address, opening hours, reviews, maps, or other fresh real-world lookup
- When both image and web search are used, first infer the most likely visual context from the image, then use search only to verify or enrich it
- Do not let web search override obvious image evidence unless the image is unclear
- For simple image analysis, answer fast and directly from the image itself
- For simple image analysis, keep the first answer compact and immediate
- For search/location/business answers, keep the first answer concise and practical
- Prefer a fast useful answer first over a long polished answer
- For casual, playful, personal, or chemistry-style conversation, keep replies shorter, lighter, and more natural
- In casual chat, avoid long reflective self-analysis unless the user clearly asks for depth
- If the user's message is light, social, or flirt-adjacent, do not switch into essay mode
- Do not ignore the image when one is attached
- If the image is unclear, say what is visible and what is uncertain

GLOBAL FEEDBACK CONTEXT:
${feedbackContext}

PERSONAL FEEDBACK CONTEXT:
${personalFeedbackContext}

PERSONAL ENVIRONMENT:
- active: ${isPersonalEnvironment ? "yes" : "no"}
- user id: ${personalUserId || "none"}
- learning scope: ${learningScope}
- supabase personal state: ${personalState.raw ? "loaded" : "not_found"}
- personal feedback rows loaded: ${normalizedPersonalFeedbackRows.length}

RESPONSE CONTENT PREFERENCE FOR THIS EXACT MESSAGE:
${contentLearningState.responsePreferenceContext}

SUCCESSFUL RESPONSE REUSE:
- reusable winner exists: ${successfulResponseReuse.reusableWinner ? "yes" : "no"}
- winner score: ${successfulResponseReuse.winnerScore}
- winner positive votes: ${successfulResponseReuse.winnerUp}
- winner negative votes: ${successfulResponseReuse.winnerDown}
- winner text:
${successfulResponseReuse.winnerText || "none"}

STYLE LEARNING SIGNALS:
- shorter answers: ${cappedLearningStrength.shorter} (${learningConfidence.shorter})
- clearer explanations: ${cappedLearningStrength.clearer} (${learningConfidence.clearer})
- better structure: ${cappedLearningStrength.structure} (${learningConfidence.structure})
- less vague: ${cappedLearningStrength.vague} (${learningConfidence.vague})
- more context: ${cappedLearningStrength.context} (${learningConfidence.context})
- casual/natural chat tone: ${cappedLearningStrength.casual} (${learningConfidence.casual})

PERSONAL STYLE SIGNALS:
- shorter answers: ${personalFeedbackSignals.shorter}
- clearer explanations: ${personalFeedbackSignals.clearer}
- better structure: ${personalFeedbackSignals.structure}
- less vague: ${personalFeedbackSignals.vague}
- more context: ${personalFeedbackSignals.context}
- casual/natural chat tone: ${personalFeedbackSignals.casual}

GLOBAL STYLE SIGNALS:
- shorter answers: ${globalFeedbackSnapshotSignals.shorter}
- clearer explanations: ${globalFeedbackSnapshotSignals.clearer}
- better structure: ${globalFeedbackSnapshotSignals.structure}
- less vague: ${globalFeedbackSnapshotSignals.vague}
- more context: ${globalFeedbackSnapshotSignals.context}
- casual/natural chat tone: ${globalFeedbackSnapshotSignals.casual}

PRIORITY RULE:
- current user request > personal feedback signals > global consensus > defaults

RESPONSE STYLE PROFILE:
${sharedStyleInstructionBlock}

RUNTIME OVERRIDE PROFILE:
${runtimeOverrideInstructionBlock}

GLOBAL LEARNING:
Total sessions: ${currentGlobalFeedbackSnapshot.length}

Common failed patterns (avoid these types of responses):
${currentGlobalFeedbackSnapshot
  .filter(
    (f: any) => f.type === "down" || f.source === "idea_feedback_learning"
  )
  .map(
    (f: any) =>
      `User said: "${f.userMessage || f.message}" → user was not satisfied`
  )
  .join("\n") || "none"}

DETECTED FEEDBACK PATTERNS:
${detectedFeedbackPatterns || "none"}

ACTIVE LEARNING RULES:
${activeLearningRules || "none"}

GLOBAL AI LEARNING (CONSENSUS ENGINE):
- Shorter answers pressure: ${globalSignals.shorter}
- Clearer explanations pressure: ${globalSignals.clearer}
- Better structure pressure: ${globalSignals.structure}

CONSENSUS RULES:
- If a consensus signal is above 5, apply it strongly
- If a consensus signal is between 2 and 5, apply it lightly
- If consensus signals conflict, choose a balanced middle ground

GLOBAL LEARNING (all users):
${injectedLearningRules || "none"}

PERSONAL CONTEXT (single user bias):
${personalLayer.length > 0 ? "present" : "none"}

RUNTIME LEARNING PRIORITY:
- personal learning active: ${isPersonalEnvironment ? "yes" : "no"}
- user runtime feedback rows: ${userLayer.length}
- personal runtime feedback rows: ${normalizedPersonalFeedbackRows.length}
- personal state feedback rows: ${normalizedPersonalStateFeedback.length}
- priority order: ${isPersonalEnvironment ? "user > personal > global > default" : "user > global > default"}

USAGE SNAPSHOT:
- tier: ${usageLimitSnapshot.tier}
- monthly requests used: ${usageLimitSnapshot.requestCount}
- monthly web searches used: ${usageLimitSnapshot.webSearchCount}
- requests remaining: ${usageLimitSnapshot.requestsRemaining === Infinity ? "unlimited" : usageLimitSnapshot.requestsRemaining}
- web searches remaining: ${usageLimitSnapshot.webSearchesRemaining === Infinity ? "unlimited" : usageLimitSnapshot.webSearchesRemaining}
- limit exceeded: ${usageLimitSnapshot.exceeded ? "yes" : "no"}

SUCCESSFUL PATTERNS (completed items):
${completedFeedback
  .filter(
    (f: any) =>
      f.type === "up" ||
      f.type === "improve" ||
      f.source === "idea_feedback_learning"
  )
  .map((f: any) => `- ${f.userMessage || f.message}`)
  .slice(0, 5)
  .join("\n") || "none"}

ADAPTATION RULES:
- If users prefer shorter answers, reduce filler and get to the point faster
- If users want clearer explanations, simplify wording and make the logic more obvious
- If users want more depth or context, explain the why behind the answer more clearly
- If users want a different structure, use cleaner sections and a more readable flow
- If users dislike vague answers, be more concrete and specific
- Treat ACTIVE LEARNING RULES as global behavior instructions learned from all users
- Treat LEARNING INJECTION FROM FEEDBACK as global instructions learned from analytics and shared feedback
- Treat GLOBAL LEARNING as the default base layer
- Treat current-request feedback as the highest-priority user layer
- Treat PERSONAL FEEDBACK CONTEXT, personal state, and User memory as the personal override layer when PERSONAL ENVIRONMENT is active
- If PERSONAL ENVIRONMENT is active, use priority order: user > personal > global > default
- If PERSONAL ENVIRONMENT is not active, use priority order: user > global > default
- Use global learning as fallback consensus, not as an override against active user or personal learning
- Treat RUNTIME OVERRIDE PROFILE as more important than GLOBAL LEARNING whenever PERSONAL ENVIRONMENT is active
- Apply hard override rules first, then personal memory directives, then soft global rules
- Never let global style pressure cancel a strong personal preference
- If RESPONSE CONTENT PREFERENCE FOR THIS EXACT MESSAGE contains a strong positively rated answer, reuse that style as the default for similar future messages
- If RESPONSE CONTENT PREFERENCE FOR THIS EXACT MESSAGE shows mixed feedback, do not copy the old answer literally; create a balanced improved version between too short and too verbose
- If SUCCESSFUL RESPONSE REUSE says reusable winner exists = yes, reuse the winning answer's shape, strengths, and level of usefulness as the starting point
- Do not copy the winner blindly word-for-word unless the user is clearly asking the exact same thing again
- Prefer reusing structure, tone, directness, and completeness over literal repetition
- For simple greetings or repeated casual openers, converge toward the best globally rated phrasing instead of answering randomly
- When ACTIVE LEARNING RULES exist, follow them before default style preferences
- When LEARNING INJECTION FROM FEEDBACK exists, apply those rules directly unless they conflict with safety or the user's current request
- High confidence signals should change the reply clearly and strongly
- Medium confidence signals should noticeably influence structure, clarity, or length
- Low confidence signals should only be applied lightly as a soft preference
- Ignore signals with confidence None
- Weighted learning signals are recency-based, so follow recent repeated feedback more strongly than older feedback
- Follow the shared style instruction block as the default presentation layer for this answer
- If tone is casual_light, keep the answer warm, short, and natural
- If tone is practical_grounded, prioritize usefulness and concrete details
- If tone is visual_direct, answer directly from what is visible
- If brevity is tight, cut filler aggressively
- If structure is minimal, avoid heavy sections unless necessary
- If structure is shortlist, prefer fewer stronger options over long lists
- If clarity is high, use simpler wording and more direct phrasing
- If depth is expanded, add more why/context without becoming bloated

INTERPRETATION RULES:
EMOTIONAL SUPPORT RULES:
- OpenLura is not only for answering questions, but also for normal conversation and emotional support
- If the user shares something emotional, painful, heavy, or personal, respond like a caring human first
- In those cases, do NOT act like the user only asked an information question
- First acknowledge the emotion clearly and naturally, then respond helpfully
- If the user says something like "my grandma died", respond with empathy first, for example by recognizing the loss and seriousness before asking anything else
- Avoid cold responses like "what do you want to know?" when the user is clearly sharing emotion
- Keep the tone warm, grounded, supportive, and respectful
- Do not sound fake, overly dramatic, or clingy
- OpenLura should feel thoughtful and present, like a very good conversational companion

- If multiple negative feedback entries exist, detect patterns and avoid them
- If positive feedback exists, mirror tone, depth, and structure
- If completed (klaar) items exist, treat them as strong positive signals and reuse their structure, tone, and clarity
- If user explicitly says "this is wrong", treat it as strong negative feedback

- If recent conversation exists and the user's message is short, interpret it in the context of the ongoing topic first
- For follow-up prompts like "korter", "nog korter", "anders verwoorden", "duidelijker", "welke dan", "waarom", "en voor rust?", "alleen het aantal", "gewoon het aantal", or "alleen de naam":
  → continue the same topic by default
  → apply the follow-up directly to the last relevant answer
  → do not ask a clarifying question unless the recent conversation still makes the intent genuinely unclear
- Only treat the message as a fresh topic when the user clearly switches subject

- If user input is vague or unclear and similar feedback was negative:
  → Ask a clarifying question instead of giving a generic answer

- If similar user messages received negative feedback:
  → Change strategy completely
  → Do NOT repeat previous style

  - When a user message matches a previously disliked pattern:
  → Do NOT respond normally
  → Ask a clarifying or more specific question instead

STYLE:
- Write like a high-quality ChatGPT answer
- Sound natural, confident, and slightly conversational
- Not robotic, not stiff
- Add small human touches where appropriate
- Occasionally use short punchy lines for emphasis
- Explanations should feel insightful, not generic
- Occasionally explain things in a slightly opinionated or insightful way
- Add short “why this matters” or “this is where it goes wrong” moments
- Avoid sounding like a guidebook; sound like you actually understand it deeply
- Use subtle conversational touches like “this is key”, “this is where most people mess up”
- In casual conversation, prioritize charm, rhythm, and natural brevity over polished long-form explanation

STRUCTURE:
- Start with a strong, natural explanation (2–4 sentences)
- Then break things into clear sections
- Each section should have a fitting emoji based on the topic
- NEVER use fixed emojis like ☕ or 🥛 unless the topic is actually about that
- Choose emojis that match the subject (e.g. 🎮 💰 🧠 📈)
- For search/location/business answers, prefer a compact shortlist format:
  1. name
  2. why it matches
  3. one practical detail if supported by sources
- For search/location/business answers, avoid dumping too many names at once

FORMATTING RULES:
- Use real empty lines for spacing
- Keep it clean and easy to scan
- No markdown like **bold**
- No "(blank line)"

SECTIONS TO USE (when relevant):

Intro paragraph (natural explanation)

Section with relevant emoji  
Short explanation + details

Next section with relevant emoji  
Short explanation + details

🎯 Key insight / principle  

❌ Common mistakes  

💡 Pro tip / upgrade  

BEHAVIOR:
- Treat the user like someone you can also talk with, not only someone asking technical or factual questions
- Make answers feel slightly premium / expert-level
- Avoid generic tips
- Prefer specific, practical advice
- If useful, add small “insider” tips

CONTEXT:
Recent conversation:
${recentConversationTranscript || "none"}

Personal user memory: ${runtimePersonalMemory || "none"}
User location: ${location ? JSON.stringify(location) : "unknown"}

BAD OUTPUT:
- Using the same emojis for every topic
- Random or irrelevant emojis
- Too short answers
- Robotic tone
- Generic steps with no depth
- Ignoring feedback patterns

GOOD OUTPUT:
- Adapts based on feedback
- Emojis match the topic naturally
- Feels like a premium ChatGPT answer
- Clear + structured + interesting
- Slight personality without being childish

A/B TEST VARIANT:
${responseVariant}

VARIANT RULES:
- If variant is A: be more direct, tighter, and slightly shorter
- If variant is B: be a bit more structured, slightly more explanatory, and more segmented
- Keep both variants high quality
- Do not mention the variant
- Do not mention testing

FOLLOW THIS STYLE STRICTLY.
    `,
      input: [
        {
          role: "user",
          content: [
            ...(message
              ? [
                  {
                    type: "input_text",
                    text: message,
                  },
                ]
              : []),
            ...(image
              ? [
                  {
                    type: "input_image",
                    image_url: image,
                  },
                ]
              : []),
          ],
        },
      ],
    } as any);

        let aiText =
    response.output_text ||
    (response.output || [])
      .flatMap((item: any) =>
        item.type === "message" ? item.content || [] : []
      )
      .map((part: any) => {
        if (part.type !== "output_text") return "";

        if (typeof part.text === "string") return part.text;
        if (typeof part.text?.value === "string") return part.text.value;
        if (typeof part.value === "string") return part.value;

        return "";
      })
      .join("")
      .trim();

  const shouldRewriteCasualReply =
    isCasualChatRequest &&
    detectCasualStyleMismatch({
      userMessage: message || "",
      aiText,
    });

  if (shouldRewriteCasualReply && aiText) {
    try {
      const rewrite = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are OpenLura.

Rewrite the assistant draft so it feels more natural for a casual personal chat.
Rules:
- Keep the same language as the user
- Make it shorter
- Sound warm, light, and spontaneous
- Avoid essay tone, abstract self-analysis, and overexplaining
- Usually 2 to 5 short paragraphs max
- Keep the meaning, just make it feel more human
- If it fits, lightly bounce the conversation back to the user`,
          },
          {
            role: "user",
            content: `User message:
${message || ""}

Current draft:
${aiText}`,
          },
        ],
      });

      const rewritten =
        rewrite.choices?.[0]?.message?.content?.trim() || "";

      if (rewritten) {
        aiText = rewritten;
      }
    } catch (error) {
      console.error("OpenLura casual rewrite failed:", toSafeErrorMeta(error));
    }
  }

  const annotationSources: [string, { title: string; url: string }][] = (response.output || [])
    .flatMap((item: any) =>
      item.type === "message" ? item.content || [] : []
    )
    .flatMap((part: any) =>
      part.type === "output_text" ? part.annotations || [] : []
    )
    .filter((annotation: any) => annotation.type === "url_citation" && annotation.url)
    .map(
      (annotation: any): [string, { title: string; url: string }] => [
        annotation.url,
        {
          title: annotation.title || annotation.url,
          url: annotation.url,
        },
      ]
    );

  const webSearchSources: [string, { title: string; url: string }][] = (response.output || [])
    .filter((item: any) => item.type === "web_search_call")
    .flatMap((item: any) => item.action?.sources || [])
    .filter((source: any) => source?.url)
    .map(
      (source: any): [string, { title: string; url: string }] => [
        source.url,
        {
          title: source.title || source.url,
          url: source.url,
        },
      ]
    );

      const sources = Array.from(
    new Map<string, { title: string; url: string }>([
      ...annotationSources,
      ...webSearchSources,
    ]).values()
  ).slice(0, 5);

  const autoDebugSignals = detectAutoDebugSignals({
    userMessage: message || "",
    aiText,
    image,
    usedWebSearch: shouldUseWebSearch,
    sources,
    isCasualChatRequest,
    isSimpleImageAnalysis,
    responseVariant,
    routeType: resolvedRouteType,
  });

  if (autoDebugSignals.length > 0) {
    await storeAutoDebugSignals({
      userMessage: message,
      signals: autoDebugSignals,
    });
  }

  if (canUseCache && aiText) {
    responseCache.set(cacheKey, {
      text: aiText,
      sources,
      timestamp: Date.now(),
    });

    if (responseCache.size > 100) {
      const oldestKey = responseCache.keys().next().value as string | undefined;
      if (oldestKey) {
        responseCache.delete(oldestKey);
      }
    }
  }

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const chunkSize = 80;

                const safeText =
          aiText ||
          (image
            ? "Ik kon de afbeelding nog niet goed uitlezen. Probeer het nog een keer met een kortere vraag zoals: wat staat hierop?"
            : "Ik kon geen antwoord genereren. Probeer het opnieuw.");

        for (let i = 0; i < safeText.length; i += chunkSize) {
          controller.enqueue(
            encoder.encode(safeText.slice(i, i + chunkSize))
          );
        }

        controller.close();
      },
    }),
    {
      headers: buildNoStoreTextHeaders({
        "X-OpenLura-Variant": responseVariant,
        "X-OpenLura-Sources": encodeURIComponent(JSON.stringify(sources)),
        ...buildRateLimitHeaders(rateLimit),
        ...buildUsageHeaders(usageLimitSnapshot),
      }),
    }
  );
}