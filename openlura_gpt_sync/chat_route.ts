import OpenAI from "openai";
import {
  ADMIN_COOKIE_NAME,
  getCookieValue,
  isValidAdminSession,
} from "@/lib/auth/adminSession";

let globalFeedback: any[] = [];
const responseCache = new Map<
  string,
  { text: string; sources: { title: string; url: string }[]; timestamp: number }
>();
const RESPONSE_CACHE_TTL_MS = 1000 * 60 * 10;

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
}) {
  return JSON.stringify({
    message: input.message.trim().toLowerCase(),
    personalMemory: (input.personalMemory || "").trim().toLowerCase(),
    learningScope: (input.learningScope || "global").trim().toLowerCase(),
  });
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const personalStateTable =
  process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

type OpenLuraFeedbackRow = {
  type?: string | null;
  message?: string | null;
  userMessage?: string | null;
  source?: string | null;
  learningType?: string | null;
  userScope?: string | null;
  timestamp?: string | number | null;
  weight?: number;
};

type OpenLuraPersonalState = {
  userId: string | null;
  memory: string;
  feedback: OpenLuraFeedbackRow[];
  raw: any;
};

type OpenLuraPersonalRuntimeContext = {
  isPersonalEnvironment: boolean;
  personalUserId: string | null;
  personalState: OpenLuraPersonalState;
  personalFeedbackRows: OpenLuraFeedbackRow[];
  resolvedPersonalMemory: string;
  learningScope: string;
};

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

function getBearerTokenFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1].trim();

  const directCookie =
    getCookieValue(req, "sb-access-token") ||
    getCookieValue(req, "supabase-access-token");

  if (directCookie) return decodeURIComponent(directCookie);

  const packedCookie =
    getCookieValue(req, "supabase-auth-token") ||
    getCookieValue(req, "sb-auth-token");

  if (!packedCookie) return null;

  try {
    const decoded = decodeURIComponent(packedCookie);
    const parsed = JSON.parse(decoded);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    if (typeof parsed?.access_token === "string") return parsed.access_token;
  } catch {}

  return null;
}

async function fetchSupabaseAuthUser(accessToken?: string | null) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !accessToken) return null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("OpenLura auth user fetch failed:", error);
    return null;
  }
}

async function fetchSupabasePersonalState(userId: string | null = null) {
  const resolvedUserId = userId ?? null;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return {
      userId: resolvedUserId,
      memory: "",
      feedback: [],
      raw: null,
    } satisfies OpenLuraPersonalState;
  }

  const tryQueries = resolvedUserId
    ? [
        `select=*&user_id=eq.${encodeURIComponent(resolvedUserId)}&limit=1`,
        `select=*&id=eq.${encodeURIComponent(resolvedUserId)}&limit=1`,
        "select=*&key=eq.primary&limit=1",
      ]
    : [];

  for (const query of tryQueries) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/${personalStateTable}?${query}`,
        {
          method: "GET",
          headers: {
            apikey: supabaseServiceRoleKey,
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
          },
          cache: "no-store",
        }
      );

      if (!res.ok) continue;

      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;

      if (!row) continue;

      const nestedFeedback = Array.isArray(row.feedback)
        ? row.feedback
        : Array.isArray(row.learning_feedback)
        ? row.learning_feedback
        : Array.isArray(row.personal_feedback)
        ? row.personal_feedback
        : [];

      const memoryText =
        normalizePersonalMemoryValue(row.personalMemory) ||
        normalizePersonalMemoryValue(row.memory) ||
        normalizePersonalMemoryValue(row.profile_memory) ||
        normalizePersonalMemoryValue(row.state?.memory) ||
        "";

      return {
        userId: resolvedUserId,
        memory: memoryText,
        feedback: nestedFeedback,
        raw: row,
      } satisfies OpenLuraPersonalState;
    } catch (error) {
      console.error("OpenLura personal state fetch failed:", error);
    }
  }

  return {
    userId: resolvedUserId,
    memory: "",
    feedback: [],
    raw: null,
  } satisfies OpenLuraPersonalState;
}

function mergeLearningFeedbackLayers(input: {
  globalFeedback: OpenLuraFeedbackRow[];
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
    ...normalizeLayerRows(input.globalFeedback, "global"),
    ...normalizeLayerRows(input.personalFeedback, "personal"),
    ...normalizeLayerRows(input.userFeedback || [], "user"),
  ];
}

async function resolvePersonalRuntimeContext(input: {
  req: Request;
  personalMemory?: string;
  memory?: string;
}) {
  const accessToken = getBearerTokenFromRequest(input.req);
  const authUser = await fetchSupabaseAuthUser(accessToken);
  const headerPersonalUserId = input.req.headers.get("x-openlura-user-id");
  const explicitPersonalEnvHeader =
    input.req.headers.get("x-openlura-personal-env") === "true";

  const personalUserId = authUser?.id || headerPersonalUserId || null;
  const personalState = await fetchSupabasePersonalState(personalUserId);
  const personalFeedbackRows = await getPersonalFeedbackRows(personalUserId);

  const hasTrustedPersonalSignal =
    !!personalUserId ||
    (explicitPersonalEnvHeader &&
      isValidAdminSession(getCookieValue(input.req, ADMIN_COOKIE_NAME)));

  const isPersonalEnvironment =
    hasTrustedPersonalSignal ||
    (!!personalUserId &&
      (
        !!personalState.memory ||
        personalState.feedback.length > 0 ||
        personalFeedbackRows.length > 0
      ));

  const resolvedPersonalMemory = isPersonalEnvironment
    ? input.personalMemory || personalState.memory || input.memory || ""
    : input.memory || "";

  const learningScope = isPersonalEnvironment
    ? `personal:${personalUserId || "active"}`
    : "global";

  return {
    isPersonalEnvironment,
    personalUserId,
    personalState,
    personalFeedbackRows,
    resolvedPersonalMemory,
    learningScope,
  } satisfies OpenLuraPersonalRuntimeContext;
}

async function fetchSupabaseFeedbackRows(query: string, errorLabel: string) {
  if (!supabaseUrl || !supabaseServiceRoleKey) return [];

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/openlura_feedback?${query}`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
      },
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
        console.error(errorLabel, res.status, errorText);
      }

      return [];
    }

    return await res.json();
  } catch (error) {
    console.error(errorLabel, error);
    return [];
  }
}

async function getRecentServerFeedback() {
  const primary = await fetchSupabaseFeedbackRows(
    "select=type,message,userMessage,source,userScope,timestamp,user_id&order=timestamp.desc&limit=30",
    "OpenLura server feedback fetch failed:"
  );

  if (primary.length > 0) return primary;

  return fetchSupabaseFeedbackRows(
    "select=type,message,userMessage,source,userScope,timestamp&order=timestamp.desc&limit=30",
    "OpenLura server feedback fallback fetch failed:"
  );
}

async function getPersonalFeedbackRows(userId?: string | null) {
  if (!userId) return [];

  const primary = await fetchSupabaseFeedbackRows(
    `select=type,message,userMessage,source,userScope,timestamp,user_id&user_id=eq.${encodeURIComponent(
      userId
    )}&order=timestamp.desc&limit=60`,
    "OpenLura personal feedback fetch failed:"
  );

  if (primary.length > 0) return primary;

  return [];
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

function getUserScopeFromRequest(input: {
  req: Request;
  isPersonalEnvironment?: boolean;
}) {
  if (input.isPersonalEnvironment) {
    return "personal";
  }

  return isValidAdminSession(getCookieValue(input.req, ADMIN_COOKIE_NAME))
    ? "admin"
    : "guest";
}

async function storeAutoDebugSignals(input: {
  userMessage?: string;
  aiText?: string;
  userScope?: "admin" | "guest" | "personal";
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

  const recentRows = await fetchSupabaseFeedbackRows(
    "select=type,message,userMessage,source,timestamp&type=eq.auto_debug&order=timestamp.desc&limit=50",
    "OpenLura recent auto debug fetch failed:"
  );

  const recentSignatures = new Set(
    recentRows.map((item: any) =>
      buildAutoDebugSignature({
        userMessage: item.userMessage,
        signalSource: String(item.source || "").split("__route_")[0],
        learningType: inferFeedbackLearningType(item),
        confidence:
          String(item.message || "")
            .toLowerCase()
            .match(/^\[(high|medium|low)\]/)?.[1] as "low" | "medium" | "high" || "low",
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
      userScope: input.userScope || "guest",
      timestamp: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return;
  }

  try {
    let res = await fetch(`${supabaseUrl}/rest/v1/openlura_feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
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

      if (isSchemaMismatch) {
        const fallbackRows = rows.map((row: any) => {
          const { user_id, learningType, ...rest } = row;
          return rest;
        });

        res = await fetch(`${supabaseUrl}/rest/v1/openlura_feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseServiceRoleKey,
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(fallbackRows),
          cache: "no-store",
        });
      } else {
        console.error("Auto debug signal save failed:", res.status, errorText);
      }
    }

    if (!res.ok) {
      console.error("Auto debug signal fallback save failed:", res.status, await res.text());
    }
  } catch (error) {
    console.error("Auto debug signal save error:", error);
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const {
    message,
    image,
    memory,
    personalMemory,
    location,
    feedback,
    recentMessages,
  } = await req.json();

  const {
    isPersonalEnvironment,
    personalUserId,
    personalState,
    personalFeedbackRows,
    resolvedPersonalMemory,
    learningScope,
  } = await resolvePersonalRuntimeContext({
    req,
    personalMemory,
    memory,
  });

  const userScope = getUserScopeFromRequest({
    req,
    isPersonalEnvironment,
  });

  const serverFeedback = await getRecentServerFeedback();

    const normalizedServerFeedback = serverFeedback
    .filter((item: any) => !item.user_id)
    .map((item: any) => ({
      type: item.type,
      message: item.message,
      userMessage: item.userMessage,
      source: item.source,
      learningType: inferFeedbackLearningType(item),
      userScope: item.userScope || "guest",
      user_id: item.user_id ?? null,
      weight: item.userScope === "admin" ? 1.35 : 1,
      timestamp: item.timestamp,
    }));

  const normalizedPersonalFeedbackRows = personalFeedbackRows.map((item: any) => ({
    type: item.type,
    message: item.message,
    userMessage: item.userMessage,
    source: item.source || "personal_feedback_runtime",
    learningType: inferFeedbackLearningType(item),
    userScope: "personal",
    user_id: item.user_id ?? personalUserId ?? null,
    weight: 1.5,
    timestamp: item.timestamp,
  }));

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
          message: (feedback.issues || []).join(" | "),
          userMessage: (feedback.recentIssues || []).join(" | "),
          learningType: inferFeedbackLearningType({
            message: (feedback.issues || []).join(" | "),
            userMessage: (feedback.recentIssues || []).join(" | "),
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

  const normalizedPersonalStateFeedback = (Array.isArray(personalState.feedback)
    ? personalState.feedback
    : []
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
    globalFeedback: globalLearningFeedback,
    personalFeedback: isPersonalEnvironment ? personalLearningFeedback : [],
    userFeedback: userRuntimeFeedback,
  });

  const personalLayer = isPersonalEnvironment ? personalLearningFeedback : [];
  const userLayer = userRuntimeFeedback;

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

  const bestResponsePreference = rankedResponsePreferences[0];
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

  globalFeedback = globalLearningFeedback;

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

        return pattern.test(text)
          ? sum + getDecayWeight(f.timestamp) * baseWeight
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

  const feedbackSignals = getFeedbackSignals(effectiveFeedback);

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
    const feedbackData = await fetchSupabaseFeedbackRows(
      "select=message,type,user_id,userScope",
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
    console.warn("Global learning fetch failed:", e);
  }

    let responseVariant = "A";

  try {
    const feedbackData = await fetchSupabaseFeedbackRows(
      "select=type,source,user_id,userScope",
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
      isSearchStyleRequest,
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
            personalMemory: resolvedPersonalMemory,
            learningScope,
          });

      const cached = cacheKey ? responseCache.get(cacheKey) : null;

      if (cached && Date.now() - cached.timestamp < RESPONSE_CACHE_TTL_MS) {
        return new Response(cached.text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-OpenLura-Variant": responseVariant,
        "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
        "X-OpenLura-Speed": "fast_text",
        "X-OpenLura-Learning-Scope": learningScope,
      },
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
- personal memory: ${resolvedPersonalMemory || "none"}

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
              personalMemory: resolvedPersonalMemory,
        learningScope,
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
       headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-OpenLura-Variant": responseVariant,
        "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
        "X-OpenLura-Speed": "fast_image",
        "X-OpenLura-Learning-Scope": learningScope,
      },
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
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-OpenLura-Variant": responseVariant,
            "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
            "X-OpenLura-Speed": "fast_image",
          },
        }
      );
    }

    const canUseCache =
      !image &&
      !shouldUseWebSearch &&
      !isRefinementInstruction(normalizedMessageForRouting) &&
      !!normalizedMessageForRouting &&
      normalizedMessageForRouting.length <= 120;

    const cacheKey = canUseCache
      ? JSON.stringify({
          message: normalizedMessageForRouting,
          memory: resolvedPersonalMemory,
          learningScope,
          variant: shouldForceFastCompactOutput ? "fast" : responseVariant,
        })
      : "";

    if (canUseCache) {
      const cached = responseCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < RESPONSE_CACHE_TTL_MS) {
        return new Response(cached.text, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-OpenLura-Variant": responseVariant,
            "X-OpenLura-Sources": encodeURIComponent(JSON.stringify([])),
            "X-OpenLura-Speed": "default",
            "X-OpenLura-Learning-Scope": learningScope,
          },
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

RESPONSE STYLE PROFILE:
${sharedStyleInstructionBlock}

GLOBAL LEARNING:
Total sessions: ${globalFeedback.length}

Common failed patterns (avoid these types of responses):
${globalFeedback
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

Personal user memory: ${resolvedPersonalMemory || "none"}
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
      console.error("OpenLura casual rewrite failed:", error);
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

      await storeAutoDebugSignals({
    userMessage: message,
    aiText,
    userScope,
    signals: autoDebugSignals,
  });

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
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-OpenLura-Variant": responseVariant,
        "X-OpenLura-Sources": encodeURIComponent(JSON.stringify(sources)),
        "X-OpenLura-Learning-Scope": learningScope,
      },
    }
  );
}