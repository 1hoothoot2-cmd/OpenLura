"use client";
import { useEffect, useMemo, useRef, useState } from "react";
function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function AnalyticsPage() {
    type AnalyticsFeedbackItem = {
    chatId?: string | null;
    msgIndex?: number | null;
    type?: string | null;
    message?: string | null;
    userMessage?: string | null;
    source?: string | null;
    environment?: string | null;
    userScope?: string | null;
    user_id?: string | null;
    workflowKey?: string | null;
    workflowStatus?: string | null;
    timestamp?: string | null;
    learningType?: string | null;
    _localOnly?: boolean;
  };
   const getOrCreateOpenLuraUserId = () => {
    if (typeof window === "undefined") return "";

    const storageKey = "openlura_user_id";
    const existing = localStorage.getItem(storageKey);

    if (existing?.trim()) {
      return existing.trim();
    }

    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `openlura_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(storageKey, newId);
    return newId;
  };

  const getOpenLuraRequestHeaders = (
    includeJson = true,
    options?: { personalEnv?: boolean; includeUserId?: boolean }
  ) => {
    const headers: Record<string, string> = includeJson
      ? { "Content-Type": "application/json" }
      : {};

    // 🔥 TEMP: altijd user_id meesturen (simuleert login)
const resolvedUserId = getOrCreateOpenLuraUserId();

if (resolvedUserId) {
  headers["x-openlura-user-id"] = resolvedUserId;
}

    if (options?.personalEnv) {
      headers["x-openlura-personal-env"] = "true";
    }

    return headers;
  };
    const [feedback, setFeedback] = useState<AnalyticsFeedbackItem[]>([]);
    const [activeTab, setActiveTab] = useState("all");
    const [ideaFilter, setIdeaFilter] = useState("all");
    const [analyticsPassword, setAnalyticsPassword] = useState("");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(true);

    const ANALYTICS_UNLOCK_STORAGE_KEY = "openlura_analytics_unlocked";
    const [itemStatus, setItemStatus] = useState<Record<string, string>>({});
      // Workflow status is server-truth first.
  // Local state is only an in-memory optimistic overlay for this tab/session.
    const [workflowFilter, setWorkflowFilter] = useState("all");
    const [learningTypeFilter, setLearningTypeFilter] = useState("all");
    const [autoDebugConfidenceFilter, setAutoDebugConfidenceFilter] = useState("all");
    const [autoDebugRouteFilter, setAutoDebugRouteFilter] = useState("all");
    const [autoDebugSignalFilter, setAutoDebugSignalFilter] = useState("all");
    const [localFeedbackStats, setLocalFeedbackStats] = useState({
      defaultCount: 0,
      personalCount: 0,
      total: 0,
    });
    const latestFeedbackRef = useRef<AnalyticsFeedbackItem[]>([]);
    const hasLoadedServerTruthRef = useRef(false);
    const pendingAutoLearningInsightsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ANALYTICS_UNLOCK_STORAGE_KEY);
    }
  }, []);

  const inferLearningType = (f: any) => {
    if (f.learningType === "style" || f.learningType === "content") {
      return f.learningType;
    }

    const text = `${f.userMessage || ""} ${f.message || ""}`.toLowerCase();

    const isStyleSignal = !!text.match(
      /korter|te lang|too long|shorter|duidelijker|onduidelijk|clearer|unclear|andere structuur|structuur|structure|te vaag|vaag|vague|meer context|more context|more depth|te serieus|te formeel|menselijker|spontaner|luchtiger|more natural|too formal|too long for chat/
    );

    return isStyleSignal ? "style" : "content";
  };

  const getAutoDebugRouteType = (f: any) => {
    const source = String(f.source || "");
    const match = source.match(/__route_(fast_text|fast_image|search|default)/);
    return match?.[1] || "unknown";
  };

  const getAutoDebugConfidence = (f: any) => {
    const match = String(f.message || "").toLowerCase().match(/^\[(high|medium|low)\]/);
    return match?.[1] || "unknown";
  };

  const getAutoDebugSignalType = (f: any) => {
    const source = String(f.source || "");

    if (source.includes("auto_debug_casual_mismatch")) {
      return "casual_mismatch";
    }

    if (source.includes("auto_debug_possible_search_miss")) {
      return "possible_search_miss";
    }

    if (source.includes("auto_debug_possible_image_context_miss")) {
      return "possible_image_context_miss";
    }

    if (source.includes("auto_debug_weak_source_support")) {
      return "weak_source_support";
    }

    if (source.includes("auto_debug_too_verbose_for_image_route")) {
      return "too_verbose_for_image_route";
    }

    return "unknown";
  };
  const isRenderableAnalyticsItem = (f: AnalyticsFeedbackItem) => {
    const hasValidType =
      f.type === "up" ||
      f.type === "down" ||
      f.type === "improve" ||
      f.type === "idea" ||
      f.type === "auto_debug";

    const hasValidEnvironment =
      f.environment === "default" || f.environment === "personal";

    const hasValidUserScope =
      f.userScope === "admin" ||
      f.userScope === "guest" ||
      f.userScope === "personal" ||
      f.userScope === "user";

    if (!hasValidType || !hasValidEnvironment || !hasValidUserScope) {
      return false;
    }

    if (f.environment === "personal" && !f.user_id) {
      return false;
    }

    if (f.userScope === "personal" && !f.user_id) {
      return false;
    }

    if (f.userScope === "user" && !f.user_id) {
      return false;
    }

    return true;
  };
    const getUserScope = (f: any) => {
    if (
      f.userScope === "admin" ||
      f.userScope === "guest" ||
      f.userScope === "personal" ||
      f.userScope === "user"
    ) {
      return f.userScope;
    }

    if (f.environment === "personal" && f.user_id) {
      return "personal";
    }

    if (f.environment === "default" && f.user_id) {
      return "user";
    }

    return "guest";
  };

  useEffect(() => {
    if (activeTab !== "ideas") {
      setIdeaFilter("all");
    }

    if (activeTab === "positive") {
      setLearningTypeFilter("all");
    }

    if (activeTab !== "auto_debug") {
      setAutoDebugConfidenceFilter("all");
      setAutoDebugRouteFilter("all");
      setAutoDebugSignalFilter("all");
    }
  }, [activeTab]);

    useEffect(() => {
    const checkAnalyticsAccess = async () => {
      try {
        const res = await fetch("/api/feedback", {
  method: "GET",
  headers: getOpenLuraRequestHeaders(false, { includeUserId: false }),
  cache: "no-store",
});

        if (res.ok) {
          setIsUnlocked(true);
          setAuthError("");

          if (typeof window !== "undefined") {
            sessionStorage.removeItem(ANALYTICS_UNLOCK_STORAGE_KEY);
          }
        } else if (res.status === 401) {
          setIsUnlocked(false);

          if (typeof window !== "undefined") {
            sessionStorage.removeItem(ANALYTICS_UNLOCK_STORAGE_KEY);
          }
        }
      } catch {
        setAuthError("");
      } finally {
        setAuthLoading(false);
      }
    };

    checkAnalyticsAccess();
  }, []);

  function matchesCurrentAnalyticsFilters(
    f: AnalyticsFeedbackItem,
    statusOverride?: string
  ) {
    const currentStatus = getResolvedStatus(f, statusOverride);

    if (workflowFilter !== "all" && currentStatus !== workflowFilter) {
      return false;
    }

    const resolvedLearningType = inferLearningType(f);
    const supportsLearningTypeFilter =
      f.type === "down" ||
      f.type === "improve" ||
      f.type === "auto_debug" ||
      f.source === "idea_feedback_learning";

    if (
      learningTypeFilter !== "all" &&
      supportsLearningTypeFilter &&
      resolvedLearningType !== learningTypeFilter
    ) {
      return false;
    }

    if (
      activeTab === "auto_debug" &&
      autoDebugConfidenceFilter !== "all" &&
      getAutoDebugConfidence(f) !== autoDebugConfidenceFilter
    ) {
      return false;
    }

    if (
      activeTab === "auto_debug" &&
      autoDebugRouteFilter !== "all" &&
      getAutoDebugRouteType(f) !== autoDebugRouteFilter
    ) {
      return false;
    }

    if (
      activeTab === "auto_debug" &&
      autoDebugSignalFilter !== "all" &&
      getAutoDebugSignalType(f) !== autoDebugSignalFilter
    ) {
      return false;
    }

    if (activeTab === "all") return true;
    if (activeTab === "positive") return f.type === "up";
    if (activeTab === "negative") return f.type === "down";
    if (activeTab === "improvement") return f.type === "improve";
    if (activeTab === "auto_debug") return f.type === "auto_debug";

    if (activeTab === "ideas") {
      if (f.type !== "idea") return false;
      if (ideaFilter === "all") return true;
      if (ideaFilter === "bug") return f.source === "idea_bug";
      if (ideaFilter === "adjustment") return f.source === "idea_adjustment";
      if (ideaFilter === "learning") return f.source === "idea_feedback_learning";
    }

    return true;
  }

  const getResolvedStatus = (
    f: AnalyticsFeedbackItem,
    statusOverride?: string
  ) => {
    if (statusOverride) {
      return statusOverride;
    }

    if (f.workflowKey && itemStatus[f.workflowKey]) {
      return itemStatus[f.workflowKey];
    }

    const fallbackKey = getItemKey(f);

    if (itemStatus[fallbackKey]) {
      return itemStatus[fallbackKey];
    }

    return getAutoStatus(f);
  };

  const filteredFeedback = feedback.filter((f: AnalyticsFeedbackItem) =>
    matchesCurrentAnalyticsFilters(f)
  );

          const negativeFeedback = feedback.filter((f: any) => f.type === "down");
  const positiveFeedback = feedback.filter((f: any) => f.type === "up");
  const improvementFeedback = feedback.filter((f: any) => f.type === "improve");
  const autoDebugFeedback = feedback.filter((f: any) => f.type === "auto_debug");
  const ideaFeedback = feedback.filter((f: any) => f.type === "idea");
    const bugIdeas = ideaFeedback.filter((f: any) => f.source === "idea_bug");

  const autoDebugSignalCounts = {
    casualMismatch: autoDebugFeedback.filter((f: any) => String(f.source || "").includes("auto_debug_casual_mismatch")).length,
    searchMiss: autoDebugFeedback.filter((f: any) => String(f.source || "").includes("auto_debug_possible_search_miss")).length,
    imageContextMiss: autoDebugFeedback.filter((f: any) => String(f.source || "").includes("auto_debug_possible_image_context_miss")).length,
    weakSourceSupport: autoDebugFeedback.filter((f: any) => String(f.source || "").includes("auto_debug_weak_source_support")).length,
    verboseImageRoute: autoDebugFeedback.filter((f: any) => String(f.source || "").includes("auto_debug_too_verbose_for_image_route")).length,
  };

  const autoDebugConfidenceCounts = {
    high: autoDebugFeedback.filter((f: any) => getAutoDebugConfidence(f) === "high").length,
    medium: autoDebugFeedback.filter((f: any) => getAutoDebugConfidence(f) === "medium").length,
    low: autoDebugFeedback.filter((f: any) => getAutoDebugConfidence(f) === "low").length,
  };

  const autoDebugRouteCounts = {
    fastText: autoDebugFeedback.filter((f: any) => getAutoDebugRouteType(f) === "fast_text").length,
    fastImage: autoDebugFeedback.filter((f: any) => getAutoDebugRouteType(f) === "fast_image").length,
    search: autoDebugFeedback.filter((f: any) => getAutoDebugRouteType(f) === "search").length,
    default: autoDebugFeedback.filter((f: any) => getAutoDebugRouteType(f) === "default").length,
  };

  const autoDebugLearningTypeCounts = {
    style: autoDebugFeedback.filter((f: any) => inferLearningType(f) === "style").length,
    content: autoDebugFeedback.filter((f: any) => inferLearningType(f) === "content").length,
  };

  const adjustmentIdeas = ideaFeedback.filter((f: any) => f.source === "idea_adjustment");
  const learningIdeas = ideaFeedback.filter((f: any) => f.source === "idea_feedback_learning");

  const variantAFeedback = feedback.filter(
    (f: any) => String(f.source || "").toLowerCase() === "ab_test_a"
  );
  const variantBFeedback = feedback.filter(
    (f: any) => String(f.source || "").toLowerCase() === "ab_test_b"
  );

  const variantAScore = {
    up: variantAFeedback.filter((f: any) => f.type === "up").length,
    down: variantAFeedback.filter((f: any) => f.type === "down").length,
  };

  const variantBScore = {
    up: variantBFeedback.filter((f: any) => f.type === "up").length,
    down: variantBFeedback.filter((f: any) => f.type === "down").length,
  };

  const improvementTexts = improvementFeedback
    .map((f: any) => (f.message || "").toLowerCase().trim())
    .filter(Boolean);

  const complaintKeywords = [
    "korter",
    "te lang",
    "shorter",
    "too long",
    "duidelijker",
    "onduidelijk",
    "clearer",
    "unclear",
    "te vaag",
    "vague",
    "meer context",
    "more context",
    "te veel tekst",
    "andere structuur",
    "structure",
    "niet goed",
    "verkeerd",
    "wrong",
    "incorrect",
  ];

    const topComplaints = useMemo(
    () =>
      complaintKeywords
        .map((keyword) => ({
          keyword,
          count: improvementTexts.filter((text: string) => text.includes(keyword)).length,
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    [improvementTexts]
  );

    const bugNewCount = bugIdeas.filter(
    (f: any) => getResolvedStatus(f) === "nieuw"
  ).length;
  const bugBezigCount = bugIdeas.filter(
    (f: any) => getResolvedStatus(f) === "bezig"
  ).length;

  const learningPool = [
    ...learningIdeas,
    ...improvementFeedback,
    ...negativeFeedback,
  ];

  const styleLearningPool = learningPool.filter(
    (f: any) => inferLearningType(f) === "style"
  );

  const contentLearningPool = learningPool.filter(
    (f: any) => inferLearningType(f) === "content"
  );

  const learningNewCount = learningPool.filter(
    (f: any) => getResolvedStatus(f) === "nieuw"
  ).length;
  const learningBezigCount = learningPool.filter(
    (f: any) => getResolvedStatus(f) === "bezig"
  ).length;

  const adjustmentNewCount = adjustmentIdeas.filter(
    (f: any) => getResolvedStatus(f) === "nieuw"
  ).length;
  const adjustmentBezigCount = adjustmentIdeas.filter(
    (f: any) => getResolvedStatus(f) === "bezig"
  ).length;

  const priorityItems = useMemo(
    () =>
      [
        {
          label: "Bugs",
          count: bugIdeas.length,
          type: "bug",
          weightedCount: bugIdeas.length + bugNewCount * 2 + bugBezigCount,
          priority:
            bugIdeas.length + bugNewCount * 2 + bugBezigCount >= 8
              ? "High"
              : bugIdeas.length + bugNewCount * 2 + bugBezigCount >= 4
              ? "Medium"
              : bugIdeas.length + bugNewCount * 2 + bugBezigCount >= 1
              ? "Low"
              : "None",
        },
        {
          label: "AI feedback",
          count: learningPool.length,
          type: "learning",
          weightedCount: learningPool.length + learningNewCount * 2 + learningBezigCount,
          priority:
            learningPool.length + learningNewCount * 2 + learningBezigCount >= 12
              ? "High"
              : learningPool.length + learningNewCount * 2 + learningBezigCount >= 6
              ? "Medium"
              : learningPool.length + learningNewCount * 2 + learningBezigCount >= 1
              ? "Low"
              : "None",
        },
        {
          label: "Adjustments",
          count: adjustmentIdeas.length,
          type: "adjustment",
          weightedCount: adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount,
          priority:
            adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount >= 9
              ? "High"
              : adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount >= 4
              ? "Medium"
              : adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount >= 1
              ? "Low"
              : "None",
        },
      ].sort((a, b) => b.weightedCount - a.weightedCount),
    [
      bugIdeas.length,
      bugNewCount,
      bugBezigCount,
      learningPool.length,
      learningNewCount,
      learningBezigCount,
      adjustmentIdeas.length,
      adjustmentNewCount,
      adjustmentBezigCount,
    ]
  );

    const feedbackScore =
    feedback.length > 0
      ? Math.round((positiveFeedback.length / (positiveFeedback.length + negativeFeedback.length || 1)) * 100)
      : 0;

            const workflowCounts = {
    nieuw: filteredFeedback.filter((f: any) => getResolvedStatus(f) === "nieuw").length,
    bezig: filteredFeedback.filter((f: any) => getResolvedStatus(f) === "bezig").length,
    klaar: filteredFeedback.filter((f: any) => getResolvedStatus(f) === "klaar").length,
    // Note: database uses Dutch values (nieuw/bezig/klaar) — display only translated
  };

  const autoLearningItems = learningIdeas.filter(
    (f: any) => f.userMessage === "Auto learning insight"
  );

  const manualLearningItems = learningIdeas.filter(
    (f: any) => f.userMessage === "AI insight action"
  );

  void autoLearningItems;
  void manualLearningItems;

  const activeLearningRules: string[] = [
    topComplaints.some(
      (c) => c.keyword.includes("korter") || c.keyword.includes("te lang") ||
             c.keyword.includes("shorter") || c.keyword.includes("too long")
    ) && "Shorter answers active",
    topComplaints.some(
      (c) => c.keyword.includes("duidelijker") || c.keyword.includes("onduidelijk") ||
             c.keyword.includes("clearer") || c.keyword.includes("unclear")
    ) && "Clearer explanations active",
    topComplaints.some((c) => c.keyword.includes("structuur") || c.keyword.includes("structure")) &&
      "Better structure active",
    topComplaints.some((c) => c.keyword.includes("te vaag") || c.keyword.includes("vague")) &&
      "More concrete answers active",
    topComplaints.some((c) => c.keyword.includes("meer context") || c.keyword.includes("more context")) &&
      "More context active",
    priorityItems[0]?.type === "bug" && "Bug focus active",
  ].filter(Boolean) as string[];

    const learningWorkflowCounts = {
    nieuw: learningPool.filter(
      (f: any) => getResolvedStatus(f) === "nieuw"
    ).length,
    bezig: learningPool.filter(
      (f: any) => getResolvedStatus(f) === "bezig"
    ).length,
    klaar: learningPool.filter(
      (f: any) => getResolvedStatus(f) === "klaar"
    ).length,
  };

  const globalLearningPool = learningPool.filter(
    (f: any) => getUserScope(f) !== "personal" && f.environment !== "personal"
  );
  const personalLearningPool = learningPool.filter(
    (f: any) => getUserScope(f) === "personal" || f.environment === "personal"
  );

  const globalLearningText = globalLearningPool
    .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
    .join(" ");

  const personalLearningText = personalLearningPool
    .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
    .join(" ");

  const globalActiveLearningRules: string[] = [
    (globalLearningText.includes("korter") || globalLearningText.includes("te lang") ||
     globalLearningText.includes("shorter") || globalLearningText.includes("too long")) &&
      "Shorter answers active globally",
    (globalLearningText.includes("duidelijker") || globalLearningText.includes("onduidelijk") ||
     globalLearningText.includes("clearer") || globalLearningText.includes("unclear")) &&
      "Clearer explanations active globally",
    (globalLearningText.includes("structuur") || globalLearningText.includes("structure")) &&
      "Better structure active globally",
    (globalLearningText.includes("te vaag") || globalLearningText.includes("vague")) &&
      "More concrete answers active globally",
    (globalLearningText.includes("meer context") || globalLearningText.includes("more context")) &&
      "More context active globally",
  ].filter(Boolean) as string[];

  const personalActiveLearningRules: string[] = [
    (personalLearningText.includes("korter") || personalLearningText.includes("te lang") ||
     personalLearningText.includes("shorter") || personalLearningText.includes("too long")) &&
      "Shorter answers active personally",
    (personalLearningText.includes("duidelijker") || personalLearningText.includes("onduidelijk") ||
     personalLearningText.includes("clearer") || personalLearningText.includes("unclear")) &&
      "Clearer explanations active personally",
    (personalLearningText.includes("structuur") || personalLearningText.includes("structure")) &&
      "Better structure active personally",
    (personalLearningText.includes("te vaag") || personalLearningText.includes("vague")) &&
      "More concrete answers active personally",
    (personalLearningText.includes("meer context") || personalLearningText.includes("more context")) &&
      "More context active personally",
  ].filter(Boolean) as string[];

  const globalWeightedSignals = {
    shorter: globalLearningPool.filter((f: any) =>
      `${f.userMessage || ""} ${f.message || ""}`.toLowerCase().match(/korter|te lang|too long|shorter/)
    ).length,
    clearer: globalLearningPool.filter((f: any) =>
      `${f.userMessage || ""} ${f.message || ""}`.toLowerCase().match(/duidelijker|onduidelijk|clearer|unclear/)
    ).length,
    structure: globalLearningPool.filter((f: any) =>
      `${f.userMessage || ""} ${f.message || ""}`.toLowerCase().match(/andere structuur|structuur|structure/)
    ).length,
  };

  const styleLearningCounts = {
    global: globalLearningPool.filter((f: any) => inferLearningType(f) === "style").length,
    personal: personalLearningPool.filter((f: any) => inferLearningType(f) === "style").length,
    total: styleLearningPool.length,
  };

  const contentLearningCounts = {
    global: globalLearningPool.filter((f: any) => inferLearningType(f) === "content").length,
    personal: personalLearningPool.filter((f: any) => inferLearningType(f) === "content").length,
    total: contentLearningPool.length,
  };

    const personalWeightedSignals = {
    shorter: personalLearningPool.filter((f: any) =>
      `${f.userMessage || ""} ${f.message || ""}`.toLowerCase().match(/korter|te lang|too long|shorter/)
    ).length,
    clearer: personalLearningPool.filter((f: any) =>
      `${f.userMessage || ""} ${f.message || ""}`.toLowerCase().match(/duidelijker|onduidelijk|clearer|unclear/)
    ).length,
    structure: personalLearningPool.filter((f: any) =>
      `${f.userMessage || ""} ${f.message || ""}`.toLowerCase().match(/andere structuur|structuur|structure/)
    ).length,
  };

  const getLearningConfidence = (count: number) => {
    if (count >= 6) return "High";
    if (count >= 3) return "Medium";
    if (count >= 1) return "Low";
    return "None";
  };

  const getLearningConfidenceColor = (confidence: string) => {
    if (confidence === "High") return "text-green-400";
    if (confidence === "Medium") return "text-yellow-300";
    if (confidence === "Low") return "text-blue-300";
    return "text-white/40";
  };

  useEffect(() => {
    if (!isUnlocked || feedback.length === 0) return;

    if (
      topComplaints.some(
        (c) => c.keyword.includes("korter") || c.keyword.includes("te lang") ||
               c.keyword.includes("shorter") || c.keyword.includes("too long")
      )
    ) {
      pushAutoLearningInsight(
        "shorter_answers",
        "AI replies are often too long. Always prefer shorter, more direct answers. Cut filler aggressively."
      );
    }

    if (
      topComplaints.some(
        (c) => c.keyword.includes("duidelijker") || c.keyword.includes("onduidelijk") ||
               c.keyword.includes("clearer") || c.keyword.includes("unclear")
      )
    ) {
      pushAutoLearningInsight(
        "clearer_explanations",
        "Users want clearer explanations and simpler wording. Avoid complex or vague phrasing."
      );
    }

    if (topComplaints.some((c) => c.keyword.includes("structuur") || c.keyword.includes("structure"))) {
      pushAutoLearningInsight(
        "better_structure",
        "Users want cleaner structure and better flow in answers. Use clear sections and logical ordering."
      );
    }

    if (priorityItems[0]?.type === "bug") {
      pushAutoLearningInsight(
        "bug_priority",
        "Bug reports are the highest priority. Acknowledge issues clearly and be precise in responses."
      );
    }
  }, [
    isUnlocked,
    feedback.length,
    topComplaints.map((item) => `${item.keyword}:${item.count}`).join("|"),
    priorityItems.map((item) => `${item.type}:${item.weightedCount}:${item.priority}`).join("|"),
  ]);

useEffect(() => {
  if (!isUnlocked) return;

  const load = async () => {
    const defaultLocalFeedback = safeParseJson<any[]>(
      localStorage.getItem("openlura_feedback"),
      []
    );
    const personalLocalFeedback = safeParseJson<any[]>(
      localStorage.getItem("openlura_personal_feedback"),
      []
    );

    setLocalFeedbackStats({
      defaultCount: defaultLocalFeedback.length,
      personalCount: personalLocalFeedback.length,
      total: defaultLocalFeedback.length + personalLocalFeedback.length,
    });

    const localFeedback = [
      ...defaultLocalFeedback.map((item: any) => ({
        ...item,
        environment: item.environment || "default",
        userScope: item.userScope || "guest",
      })),
      ...personalLocalFeedback.map((item: any) => ({
        ...item,
        environment: item.environment || "personal",
        userScope: item.userScope || "personal",
      })),
    ];

    const normalizedLocal = localFeedback
      .map((item: any) => {
        const isImprovementItem =
          item.type === "improve" ||
          item.type === "improvement" ||
          item.source === "improvement_reply" ||
          item.userMessage === "Direct improvement feedback";

        const normalizedType =
          item.type === "idea"
            ? "idea"
            : isImprovementItem
            ? "improve"
            : item.type || "down";

        const rawMessage = String(item.message || "").toLowerCase();

        const normalizedSource =
          normalizedType === "idea"
            ? item.source ||
              (rawMessage.includes("bug") ||
              rawMessage.includes("werkt niet") ||
              rawMessage.includes("error") ||
              rawMessage.includes("fout") ||
              rawMessage.includes("crash") ||
              rawMessage.includes("stuk") ||
              rawMessage.includes("kapot")
                ? "idea_bug"
                : rawMessage.includes("aanpassen") ||
                  rawMessage.includes("aanpassing") ||
                  rawMessage.includes("toevoegen") ||
                  rawMessage.includes("maak") ||
                  rawMessage.includes("zet") ||
                  rawMessage.includes("verander") ||
                  rawMessage.includes("wijzig")
                ? "idea_adjustment"
                : rawMessage.includes("ai") ||
                  rawMessage.includes("antwoord") ||
                  rawMessage.includes("reageer") ||
                  rawMessage.includes("korter") ||
                  rawMessage.includes("duidelijker") ||
                  rawMessage.includes("beter") ||
                  rawMessage.includes("leren")
                ? "idea_feedback_learning"
                : "idea_adjustment")
            : item.source;

        const resolvedEnvironment =
          item.environment === "personal" ? "personal" : "default";
        const resolvedUserScope =
          item.userScope === "admin" ||
          item.userScope === "guest" ||
          item.userScope === "personal" ||
          item.userScope === "user"
            ? item.userScope
            : resolvedEnvironment === "personal"
            ? "personal"
            : item.user_id
            ? "user"
            : "guest";

        const resolvedUserId =
          item.user_id || (resolvedEnvironment === "personal" ? "local_personal" : null);

        return {
          ...item,
          _localOnly: true,
          type: normalizedType,
          source: normalizedSource,
          environment: resolvedEnvironment,
          userScope: resolvedUserScope,
          user_id: resolvedUserId,
          learningType:
            item.learningType ||
            (normalizedType === "down" ||
            normalizedType === "improve" ||
            normalizedType === "auto_debug"
              ? inferLearningType({
                  ...item,
                  type: normalizedType,
                  source: normalizedSource,
                  user_id: resolvedUserId,
                  environment: resolvedEnvironment,
                  userScope: resolvedUserScope,
                })
              : null),
          workflowKey:
            item.workflowKey ||
            [
              item.chatId || "",
              item.msgIndex ?? "",
              normalizedType || "",
              normalizedSource || "",
              resolvedEnvironment,
              resolvedUserScope,
              resolvedUserId || "",
              item.userMessage || "",
              item.message || "",
            ].join("::"),
        } satisfies AnalyticsFeedbackItem;
      })
      .filter((item: AnalyticsFeedbackItem) => isRenderableAnalyticsItem(item));

    let data: AnalyticsFeedbackItem[] = [];
    let serverFetchSucceeded = false;

  try {
    const res = await fetch("/api/feedback", {
      method: "GET",
      headers: getOpenLuraRequestHeaders(false, { includeUserId: false }),
      cache: "no-store",
    });

    if (res.status === 401) {
      setIsUnlocked(false);
      setFeedback([]);
      latestFeedbackRef.current = [];
      hasLoadedServerTruthRef.current = false;
      setItemStatus({});
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(ANALYTICS_UNLOCK_STORAGE_KEY);
      }
      return;
    }

    if (!res.ok) {
      throw new Error("Feedback ophalen mislukt");
    }

    const rawData: unknown = await res.json();
    data = Array.isArray(rawData) ? rawData : [];
    serverFetchSucceeded = true;
  } catch (error) {
    console.warn("Analytics server tijdelijk niet bereikbaar", error);
  }

  const workflowEntries = data.filter(
    (item: AnalyticsFeedbackItem) =>
      item.type === "workflow_status" &&
      item.source === "analytics_workflow" &&
      item.workflowKey &&
      item.workflowStatus
  );

  const serverStatusMap = workflowEntries
    .sort(
      (a: AnalyticsFeedbackItem, b: AnalyticsFeedbackItem) =>
        new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    )
    .reduce((acc: Record<string, string>, item: AnalyticsFeedbackItem) => {
      if (item.workflowKey && item.workflowStatus) {
        acc[item.workflowKey] = item.workflowStatus;
      }
      return acc;
    }, {});

  if (serverFetchSucceeded) {
    hasLoadedServerTruthRef.current = true;
    setItemStatus(serverStatusMap);
  }

 const normalServerFeedback = data
  .filter((item: AnalyticsFeedbackItem) => item.type !== "workflow_status")
  .map((item: AnalyticsFeedbackItem) => {
    const resolvedEnvironment =
      item.environment === "personal" ? "personal" : "default";
    const resolvedUserScope =
      item.userScope === "admin" ||
      item.userScope === "guest" ||
      item.userScope === "personal" ||
      item.userScope === "user"
        ? item.userScope
        : resolvedEnvironment === "personal" && item.user_id
        ? "personal"
        : item.user_id
        ? "user"
        : "guest";

    return {
      ...item,
      _localOnly: false,
      environment: resolvedEnvironment,
      userScope: resolvedUserScope,
      user_id: item.user_id || null,
      learningType:
        item.learningType ||
        (item.type === "down" || item.type === "improve" || item.type === "auto_debug"
          ? inferLearningType(item)
          : null),
      workflowKey:
        item.workflowKey ||
        [
          item.chatId || "",
          item.msgIndex ?? "",
          item.type || "",
          item.source || "",
          resolvedEnvironment,
          resolvedUserScope,
          item.user_id || "",
          item.userMessage || "",
          item.message || "",
        ].join("::"),
    };
  })
  .filter((item: AnalyticsFeedbackItem) => isRenderableAnalyticsItem(item));

  const truthSource = serverFetchSucceeded
    ? normalServerFeedback
    : hasLoadedServerTruthRef.current
    ? latestFeedbackRef.current
    : normalizedLocal;

  const deduped = truthSource.filter(
    (item: AnalyticsFeedbackItem, index: number, arr: AnalyticsFeedbackItem[]) => {
      const itemKey = getItemKey(item);

      return index === arr.findIndex((x: AnalyticsFeedbackItem) => getItemKey(x) === itemKey);
    }
  );

  const sorted = [...deduped].sort((a: AnalyticsFeedbackItem, b: AnalyticsFeedbackItem) => {
    const timeA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  latestFeedbackRef.current = sorted;
  setFeedback(sorted);
};

    const runLoad = () => {
    load().catch((error) => {
      console.error("Analytics load wrapper failed:", error);
    });
  };

runLoad();

const pollId = window.setInterval(() => {
  runLoad();
}, 5000);

const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    runLoad();
  }
};

window.addEventListener("openlura_feedback_update", runLoad);
window.addEventListener("focus", runLoad);
document.addEventListener("visibilitychange", handleVisibilityChange);

return () => {
  window.clearInterval(pollId);
  window.removeEventListener("openlura_feedback_update", runLoad);
  window.removeEventListener("focus", runLoad);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
};
}, [isUnlocked]);

        const downloadCSV = (weekOnly = false) => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const rows = feedback.filter((f) => {
      if (f.type !== "up" && f.type !== "down" && f.type !== "improve" && f.type !== "idea") return false;
      if (weekOnly && f.timestamp) {
        const time = new Date(f.timestamp).getTime();
        if (now - time > weekMs) return false;
      }
      return true;
    });

    const headers = ["type", "userMessage", "message", "source", "environment", "userScope", "learningType", "timestamp"];

    const escape = (val: any) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent = [
      headers.join(","),
      ...rows.map((f) =>
        headers.map((h) => escape((f as any)[h])).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = weekOnly ? "week" : "all";
    a.download = `openlura-feedback-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUnlock = async () => {
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true, { includeUserId: false }),
        body: JSON.stringify({
          action: "unlock_analytics",
          password: analyticsPassword,
        }),
      });

      if (!res.ok) {
        setIsUnlocked(false);

        if (typeof window !== "undefined") {
          sessionStorage.removeItem(ANALYTICS_UNLOCK_STORAGE_KEY);
        }

        setAuthError("Incorrect password");
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(ANALYTICS_UNLOCK_STORAGE_KEY);
      }

      setIsUnlocked(true);
      setAuthError("");
      setAnalyticsPassword("");
      window.dispatchEvent(new Event("openlura_feedback_update"));
    } catch {
      setIsUnlocked(false);
      setAuthError("Login failed");
    }
  };

      function getItemKey(f: AnalyticsFeedbackItem) {
    if (f.workflowKey?.trim()) {
      return f.workflowKey.trim();
    }

    return [
      f.chatId || "",
      f.msgIndex ?? "",
      f.type || "",
      f.source || "",
      f.environment || "",
      f.userScope || "",
      f.user_id || "",
      f.userMessage || "",
      f.message || "",
    ].join("::");
  }

      function getAutoStatus(f: any) {
    if (f.type === "up") return "klaar";
    return "nieuw";
  }

  const pushAutoLearningInsight = async (key: string, message: string) => {
    const storageKey = "openlura_auto_learning_insights";
    const existing = safeParseJson<string[]>(
      localStorage.getItem(storageKey),
      []
    );
    const alreadyStoredInFeedback = feedback.some(
      (item: AnalyticsFeedbackItem) =>
        item.type === "idea" &&
        item.source === "idea_feedback_learning" &&
        item.userMessage === "Auto learning insight" &&
        (item.message || "").trim() === message.trim()
    );

    if (
      existing.includes(key) ||
      alreadyStoredInFeedback ||
      pendingAutoLearningInsightsRef.current.has(key)
    ) {
      return;
    }

    pendingAutoLearningInsightsRef.current.add(key);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true, { includeUserId: false }),
        body: JSON.stringify({
          type: "idea",
          message,
          userMessage: "Auto learning insight",
          source: "idea_feedback_learning",
          learningType: "content",
          environment: "default",
        }),
      });

      if (!res.ok) {
        pendingAutoLearningInsightsRef.current.delete(key);
        return;
      }

      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify([...existing, key])
        );
      } catch {}

      pendingAutoLearningInsightsRef.current.delete(key);
      window.dispatchEvent(new Event("openlura_feedback_update"));
    } catch (error) {
      pendingAutoLearningInsightsRef.current.delete(key);
      console.error("Auto learning sync failed:", error);
    }
  };

        const handleInsightAction = async (action: string) => {
    if (action === "focus_bug") {
      const nextBug = bugIdeas.find(
        (f: any) => getResolvedStatus(f) === "nieuw"
      );

      if (nextBug) {
        await updateItemStatus(getItemKey(nextBug), "bezig");
      }

      return;
    }

    if (action === "shorter_answers") {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true, { includeUserId: false }),
        body: JSON.stringify({
          type: "idea",
          message: "AI replies are too long. Keep answers shorter and more direct. Cut unnecessary filler.",
          userMessage: "AI insight action",
          source: "idea_feedback_learning",
          learningType: "style",
          environment: "default",
        }),
      });

      if (!res.ok) {
        throw new Error("AI insight action save failed");
      }

      window.dispatchEvent(new Event("openlura_feedback_update"));
      return;
    }

    if (action === "clearer_structure") {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true, { includeUserId: false }),
        body: JSON.stringify({
          type: "idea",
          message: "Users want clearer structure and better flow in answers. Use clean sections and logical ordering.",
          userMessage: "AI insight action",
          source: "idea_feedback_learning",
          learningType: "style",
          environment: "default",
        }),
      });

      if (!res.ok) {
        throw new Error("AI insight action save failed");
      }

      window.dispatchEvent(new Event("openlura_feedback_update"));
    }
  };

        const updateItemStatus = async (key: string, status: string) => {
    const previousStatus = itemStatus[key];

    setItemStatus((prev) => ({
      ...prev,
      [key]: status,
    }));

    try {
      const item = feedback.find((f: AnalyticsFeedbackItem) => getItemKey(f) === key);

      if (!item) {
        return;
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true, {
          includeUserId: false,
        }),
        body: JSON.stringify({
          action: "update_workflow_status",
          chatId: item?.chatId ?? null,
          msgIndex: item?.msgIndex ?? null,
          type: "workflow_status",
          message: status,
          userMessage: item?.userMessage ?? null,
          source: "analytics_workflow",
          environment: "default",
          workflowKey: key,
          workflowStatus: status,
        }),
      });

      if (!res.ok) {
        throw new Error("Workflow status sync failed");
      }

      window.dispatchEvent(new Event("openlura_feedback_update"));
    } catch (error) {
      setItemStatus((prev) => {
        const next = { ...prev };

        if (previousStatus !== undefined) {
          next[key] = previousStatus;
        } else {
          delete next[key];
        }

        return next;
      });

      console.error("Workflow status sync failed:", error);
    }
  };

            if (authLoading) {
    return (
      <main className="min-h-screen bg-[#050510] text-white p-6 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white/10 rounded-2xl p-6 text-center">
          Loading analytics...
        </div>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="min-h-screen bg-[#050510] text-white p-6 flex items-center justify-center">
        <div
          className="w-full max-w-sm bg-white/10 rounded-2xl p-6"
          data-lpignore="false"
        >
          <h1 className="text-2xl mb-2">🔐 Analytics Admin</h1>
          <p className="text-sm opacity-60 mb-4">
            Enter the password to open analytics
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUnlock();
            }}
          >
            <input
              type="password"
              name="analytics_password"
              autoComplete="current-password"
              value={analyticsPassword}
              onChange={(e) => {
                setAnalyticsPassword(e.target.value);
                if (authError) setAuthError("");
              }}
              className="w-full p-3 rounded-xl bg-white/10 mb-3 outline-none"
              placeholder="Password"
            />

            {authError && (
              <p className="text-red-400 text-sm mb-3">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full p-3 bg-purple-500 rounded-xl"
            >
              Unlock
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050510] text-white p-6">
      
            <div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl">📊 OpenLura Analytics</h1>
    <button
    onClick={() => downloadCSV(true)}
    className="text-xs px-3 py-1 bg-green-500/20 rounded-lg hover:bg-green-500/30 text-green-300"
  >
    ↓ This week
  </button>

  <button
    onClick={() => downloadCSV(false)}
    className="text-xs px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20"
  >
    ↓ All
  </button>

  <button
    onClick={async () => {
      try {
        await fetch("/api/feedback", {
        method: "DELETE",
        headers: getOpenLuraRequestHeaders(false, { includeUserId: false }),
        });
      } catch (error) {
        console.error("Analytics logout failed:", error);
      }

      try {
        localStorage.removeItem("openlura_auto_learning_insights");
      } catch {}
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(ANALYTICS_UNLOCK_STORAGE_KEY);
      }
      setItemStatus({});
      setIsUnlocked(false);
      setFeedback([]);
      latestFeedbackRef.current = [];
      hasLoadedServerTruthRef.current = false;
    }}
    className="text-xs px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20"
  >
    Logout
  </button>
</div>

      <p className="text-xs opacity-50 mb-4">
  Environment: {typeof window !== "undefined" ? window.location.origin : ""}
</p>

  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Server items</p>
    <p className="text-xl">{feedback.filter((f) => !f._localOnly).length}</p>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Local items</p>
    <p className="text-xl">{localFeedbackStats.total}</p>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Admin items</p>
    <p className="text-xl">{feedback.filter((f) => getUserScope(f) === "admin").length}</p>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">User items</p>
    <p className="text-xl">{feedback.filter((f) => getUserScope(f) === "user").length}</p>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Personal items</p>
    <p className="text-xl">{feedback.filter((f) => getUserScope(f) === "personal").length}</p>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Total visible</p>
    <p className="text-xl">{feedback.length}</p>
  </div>
</div>

  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">

  <button
    onClick={() => setActiveTab("all")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "all" ? "bg-white/20 ring-1 ring-white/30" : "bg-white/10"
    }`}
  >
    <p className="text-xs opacity-60">Total</p>
    <p className="text-xl">{feedback.length}</p>
  </button>

  <button
    onClick={() => setActiveTab("positive")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "positive" ? "bg-green-500/30 ring-1 ring-green-300/40" : "bg-green-500/20"
    }`}
  >
    <p className="text-xs opacity-60">👍 Positive</p>
    <p className="text-xl">{positiveFeedback.length}</p>
  </button>

  <button
    onClick={() => setActiveTab("negative")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "negative" ? "bg-red-500/30 ring-1 ring-red-300/40" : "bg-red-500/20"
    }`}
  >
    <p className="text-xs opacity-60">👎 Negative</p>
    <p className="text-xl">{negativeFeedback.length}</p>
  </button>

  <button
    onClick={() => setActiveTab("improvement")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "improvement" ? "bg-yellow-500/30 ring-1 ring-yellow-300/40" : "bg-yellow-500/20"
    }`}
  >
    <p className="text-xs opacity-60">🛠️ Improve</p>
    <p className="text-xl">{improvementFeedback.length}</p>
  </button>

  <button
    onClick={() => setActiveTab("auto_debug")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "auto_debug" ? "bg-purple-500/30 ring-1 ring-purple-300/40" : "bg-purple-500/20"
    }`}
  >
    <p className="text-xs opacity-60">🧪 Auto Debug</p>
    <p className="text-xl">{autoDebugFeedback.length}</p>
  </button>

  <div className="p-4 bg-white/10 rounded-xl">
    <p className="text-xs opacity-60">📈 Score</p>
    <p className="text-xl">{feedbackScore}%</p>
  </div>

      <div className="p-4 bg-white/10 rounded-xl">
    <p className="text-xs opacity-60">🧠 Complaints</p>
    <p className="text-xl">{topComplaints.length}</p>
  </div>

    <div className="p-4 bg-white/10 rounded-xl">
    <p className="text-xs opacity-60">🔥 Top priority</p>
    <p className="text-xl">{priorityItems[0]?.label || "None"}</p>
    <p className="text-xs opacity-60 mt-1">{priorityItems[0]?.priority || ""}</p>
  </div>

  <button
    onClick={() => setActiveTab("ideas")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "ideas" ? "bg-blue-500/30 ring-1 ring-blue-300/40" : "bg-blue-500/20"
    }`}
  >
    <p className="text-xs opacity-60">💡 Ideas</p>
    <p className="text-xl">{ideaFeedback.length}</p>
  </button>

</div>

      <div className="mb-6 flex flex-wrap gap-2">
  <button
    onClick={() => setActiveTab("all")}
    className={`px-4 py-2 rounded-xl ${activeTab === "all" ? "bg-white text-black" : "bg-white/10 text-white"}`}
  >
    All
  </button>
  <button
    onClick={() => setActiveTab("negative")}
    className={`px-4 py-2 rounded-xl ${activeTab === "negative" ? "bg-red-400 text-black" : "bg-white/10 text-white"}`}
  >
    Negative
  </button>
  <button
    onClick={() => setActiveTab("positive")}
    className={`px-4 py-2 rounded-xl ${activeTab === "positive" ? "bg-green-400 text-black" : "bg-white/10 text-white"}`}
  >
    Positive
  </button>
  <button
    onClick={() => setActiveTab("improvement")}
    className={`px-4 py-2 rounded-xl ${activeTab === "improvement" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
  >
    Improve
  </button>
  <button
    onClick={() => setActiveTab("auto_debug")}
    className={`px-4 py-2 rounded-xl ${activeTab === "auto_debug" ? "bg-purple-400 text-black" : "bg-white/10 text-white"}`}
  >
    Auto Debug
  </button>
  <button
    onClick={() => setActiveTab("ideas")}
    className={`px-4 py-2 rounded-xl ${activeTab === "ideas" ? "bg-blue-400 text-black" : "bg-white/10 text-white"}`}
  >
    Ideas
  </button>
</div>

{activeTab === "ideas" && (
  <div className="mb-6 flex flex-wrap gap-2">
    <button
      onClick={() => setIdeaFilter("all")}
      className={`px-4 py-2 rounded-xl ${ideaFilter === "all" ? "bg-blue-400 text-black" : "bg-white/10 text-white"}`}
    >
      All ideas ({ideaFeedback.length})
    </button>
    <button
      onClick={() => setIdeaFilter("bug")}
      className={`px-4 py-2 rounded-xl ${ideaFilter === "bug" ? "bg-red-400 text-black" : "bg-white/10 text-white"}`}
    >
      Bugs ({bugIdeas.length})
    </button>
    <button
      onClick={() => setIdeaFilter("adjustment")}
      className={`px-4 py-2 rounded-xl ${ideaFilter === "adjustment" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
    >
      Adjustments ({adjustmentIdeas.length})
    </button>
    <button
      onClick={() => setIdeaFilter("learning")}
      className={`px-4 py-2 rounded-xl ${ideaFilter === "learning" ? "bg-green-400 text-black" : "bg-white/10 text-white"}`}
    >
      AI feedback ({learningIdeas.length})
    </button>
  </div>
)}

<div className="mb-6 flex flex-wrap gap-2">
    <button
    onClick={() => setWorkflowFilter("all")}
    className={`px-4 py-2 rounded-xl ${workflowFilter === "all" ? "bg-white text-black" : "bg-white/10 text-white"}`}
  >
    All ({filteredFeedback.length})
  </button>
  <button
    onClick={() => setWorkflowFilter("nieuw")}
    className={`px-4 py-2 rounded-xl ${workflowFilter === "nieuw" ? "bg-blue-400 text-black" : "bg-white/10 text-white"}`}
  >
    New ({feedback.filter((f: AnalyticsFeedbackItem) =>
  matchesCurrentAnalyticsFilters(f, "nieuw")
).length})
  </button>
  <button
    onClick={() => setWorkflowFilter("bezig")}
    className={`px-4 py-2 rounded-xl ${workflowFilter === "bezig" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
  >
    In progress ({feedback.filter((f: AnalyticsFeedbackItem) =>
  matchesCurrentAnalyticsFilters(f, "bezig")
).length})
  </button>
  <button
    onClick={() => setWorkflowFilter("klaar")}
    className={`px-4 py-2 rounded-xl ${workflowFilter === "klaar" ? "bg-green-400 text-black" : "bg-white/10 text-white"}`}
  >
    Done ({feedback.filter((f: AnalyticsFeedbackItem) =>
  matchesCurrentAnalyticsFilters(f, "klaar")
).length})
  </button>
</div>

<div className="mb-6 flex flex-wrap gap-2">
  <button
    onClick={() => setLearningTypeFilter("all")}
    className={`px-4 py-2 rounded-xl ${learningTypeFilter === "all" ? "bg-white text-black" : "bg-white/10 text-white"}`}
  >
    All learning
  </button>
  <button
    onClick={() => setLearningTypeFilter("style")}
    className={`px-4 py-2 rounded-xl ${learningTypeFilter === "style" ? "bg-purple-400 text-black" : "bg-white/10 text-white"}`}
  >
    Style
  </button>
  <button
    onClick={() => setLearningTypeFilter("content")}
    className={`px-4 py-2 rounded-xl ${learningTypeFilter === "content" ? "bg-cyan-400 text-black" : "bg-white/10 text-white"}`}
  >
    Content
  </button>
</div>

{activeTab === "auto_debug" && (
  <>
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        onClick={() => setAutoDebugConfidenceFilter("all")}
        className={`px-4 py-2 rounded-xl ${autoDebugConfidenceFilter === "all" ? "bg-white text-black" : "bg-white/10 text-white"}`}
      >
        All confidence
      </button>
      <button
        onClick={() => setAutoDebugConfidenceFilter("high")}
        className={`px-4 py-2 rounded-xl ${autoDebugConfidenceFilter === "high" ? "bg-red-400 text-black" : "bg-white/10 text-white"}`}
      >
        High
      </button>
      <button
        onClick={() => setAutoDebugConfidenceFilter("medium")}
        className={`px-4 py-2 rounded-xl ${autoDebugConfidenceFilter === "medium" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
      >
        Medium
      </button>
      <button
        onClick={() => setAutoDebugConfidenceFilter("low")}
        className={`px-4 py-2 rounded-xl ${autoDebugConfidenceFilter === "low" ? "bg-blue-400 text-black" : "bg-white/10 text-white"}`}
      >
        Low
      </button>
    </div>

    <div className="mb-4 flex flex-wrap gap-2">
      <button
        onClick={() => setAutoDebugRouteFilter("all")}
        className={`px-4 py-2 rounded-xl ${autoDebugRouteFilter === "all" ? "bg-white text-black" : "bg-white/10 text-white"}`}
      >
        All routes
      </button>
      <button
        onClick={() => setAutoDebugRouteFilter("fast_text")}
        className={`px-4 py-2 rounded-xl ${autoDebugRouteFilter === "fast_text" ? "bg-purple-400 text-black" : "bg-white/10 text-white"}`}
      >
        Fast text
      </button>
      <button
        onClick={() => setAutoDebugRouteFilter("fast_image")}
        className={`px-4 py-2 rounded-xl ${autoDebugRouteFilter === "fast_image" ? "bg-pink-400 text-black" : "bg-white/10 text-white"}`}
      >
        Fast image
      </button>
      <button
        onClick={() => setAutoDebugRouteFilter("search")}
        className={`px-4 py-2 rounded-xl ${autoDebugRouteFilter === "search" ? "bg-cyan-400 text-black" : "bg-white/10 text-white"}`}
      >
        Search
      </button>
      <button
        onClick={() => setAutoDebugRouteFilter("default")}
        className={`px-4 py-2 rounded-xl ${autoDebugRouteFilter === "default" ? "bg-green-400 text-black" : "bg-white/10 text-white"}`}
      >
        Default
      </button>
    </div>

    <div className="mb-6 flex flex-wrap gap-2 items-start">
      <button
        onClick={() => setAutoDebugSignalFilter("all")}
        className={`px-3 py-2 rounded-xl text-sm ${autoDebugSignalFilter === "all" ? "bg-white text-black" : "bg-white/10 text-white"}`}
      >
        All signals
      </button>
      <button
        onClick={() => setAutoDebugSignalFilter("casual_mismatch")}
        className={`px-3 py-2 rounded-xl text-sm ${autoDebugSignalFilter === "casual_mismatch" ? "bg-orange-400 text-black" : "bg-white/10 text-white"}`}
      >
        Casual mismatch
      </button>
      <button
        onClick={() => setAutoDebugSignalFilter("possible_search_miss")}
        className={`px-3 py-2 rounded-xl text-sm ${autoDebugSignalFilter === "possible_search_miss" ? "bg-cyan-400 text-black" : "bg-white/10 text-white"}`}
      >
        Search miss
      </button>
      <button
        onClick={() => setAutoDebugSignalFilter("possible_image_context_miss")}
        className={`px-3 py-2 rounded-xl text-sm ${autoDebugSignalFilter === "possible_image_context_miss" ? "bg-pink-400 text-black" : "bg-white/10 text-white"}`}
      >
        Image miss
      </button>
      <button
        onClick={() => setAutoDebugSignalFilter("weak_source_support")}
        className={`px-3 py-2 rounded-xl text-sm ${autoDebugSignalFilter === "weak_source_support" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
      >
        Weak sources
      </button>
      <button
        onClick={() => setAutoDebugSignalFilter("too_verbose_for_image_route")}
        className={`px-3 py-2 rounded-xl text-sm ${autoDebugSignalFilter === "too_verbose_for_image_route" ? "bg-red-400 text-black" : "bg-white/10 text-white"}`}
      >
        Verbose image
      </button>
    </div>
  </>
)}

<div className="grid md:grid-cols-4 gap-4 mb-6">
  <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">🚨 Top complaints</h2>
    {topComplaints.length === 0 ? (
      <p className="opacity-60 text-sm">No common patterns yet.</p>
    ) : (
      <div className="space-y-2">
        {topComplaints.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span>{item.keyword}</span>
            <span className="opacity-60">{item.count}x</span>
          </div>
        ))}
      </div>
    )}
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">🧪 AI debug</h2>
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Negative replies</span>
        <span className="opacity-60">{negativeFeedback.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Improvement feedback</span>
        <span className="opacity-60">{improvementFeedback.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Positive replies</span>
        <span className="opacity-60">{positiveFeedback.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Idea bugs</span>
        <span className="opacity-60">{bugIdeas.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Idea adjustments</span>
        <span className="opacity-60">{adjustmentIdeas.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Idea AI feedback</span>
        <span className="opacity-60">{learningIdeas.length}</span>
      </div>
    </div>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">🤖 Auto Debug</h2>
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Total signals</span>
        <span className="opacity-60">{autoDebugFeedback.length}</span>
      </div>
      <div className="flex justify-between">
        <span>High confidence</span>
        <span className="opacity-60">{autoDebugConfidenceCounts.high}</span>
      </div>
      <div className="flex justify-between">
        <span>Medium confidence</span>
        <span className="opacity-60">{autoDebugConfidenceCounts.medium}</span>
      </div>
      <div className="flex justify-between">
        <span>Low confidence</span>
        <span className="opacity-60">{autoDebugConfidenceCounts.low}</span>
      </div>
      <div className="pt-2 border-t border-white/10 space-y-2">
        <div className="flex justify-between">
          <span>Fast text</span>
          <span className="opacity-60">{autoDebugRouteCounts.fastText}</span>
        </div>
        <div className="flex justify-between">
          <span>Fast image</span>
          <span className="opacity-60">{autoDebugRouteCounts.fastImage}</span>
        </div>
        <div className="flex justify-between">
          <span>Search</span>
          <span className="opacity-60">{autoDebugRouteCounts.search}</span>
        </div>
        <div className="flex justify-between">
          <span>Default</span>
          <span className="opacity-60">{autoDebugRouteCounts.default}</span>
        </div>
      </div>
    </div>
  </div>

    <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">📌 Active filter</h2>
    <p className="text-sm opacity-80 mb-2">
      {activeTab === "all" && "Showing all feedback."}
      {activeTab === "negative" && "Showing negative feedback only."}
      {activeTab === "positive" && "Showing positive feedback only."}
      {activeTab === "improvement" && "Showing improvement feedback from users only."}
      {activeTab === "auto_debug" && "Showing automatically detected product and route signals, deduplicated against recent entries."}
      {activeTab === "ideas" && "Showing submitted ideas and general feedback only."}
    </p>
    <p className="text-xs opacity-60">
      {activeTab === "auto_debug"
        ? autoDebugConfidenceFilter === "all" &&
          autoDebugRouteFilter === "all" &&
          autoDebugSignalFilter === "all"
          ? "Auto Debug filters set to all."
          : `Auto Debug filters: confidence = ${autoDebugConfidenceFilter}, route = ${autoDebugRouteFilter}, signal = ${autoDebugSignalFilter}.`
        : learningTypeFilter === "all"
        ? "Learning type filter is set to all."
        : learningTypeFilter === "style"
        ? "Filtering on style feedback: tone, length, clarity, structure."
        : "Filtering on content feedback: answer shape and successful response patterns."}
    </p>
  </div>

    <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">🚦 Auto priority</h2>
    <div className="space-y-2 text-sm">
      {priorityItems.map((item) => (
        <div key={item.type} className="flex justify-between">
          <span>{item.label}</span>
                    <span className="opacity-60">
            {item.priority} ({item.weightedCount})
          </span>
        </div>
      ))}
    </div>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">🗂️ Workflow</h2>
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span>New</span>
        <span className="opacity-60">{workflowCounts.nieuw}</span>
      </div>
      <div className="flex justify-between">
        <span>In progress</span>
        <span className="opacity-60">{workflowCounts.bezig}</span>
      </div>
      <div className="flex justify-between">
        <span>Done</span>
        <span className="opacity-60">{workflowCounts.klaar}</span>
      </div>
    </div>
  </div>
</div>

<div className="p-4 bg-white/10 rounded-2xl mb-6">
  <h2 className="text-lg mb-3">🧭 Auto Debug signals</h2>

  <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Casual mismatch</p>
      <p className="text-lg">{autoDebugSignalCounts.casualMismatch}</p>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Possible search miss</p>
      <p className="text-lg">{autoDebugSignalCounts.searchMiss}</p>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Image context miss</p>
      <p className="text-lg">{autoDebugSignalCounts.imageContextMiss}</p>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Weak source support</p>
      <p className="text-lg">{autoDebugSignalCounts.weakSourceSupport}</p>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Verbose image route</p>
      <p className="text-lg">{autoDebugSignalCounts.verboseImageRoute}</p>
    </div>
  </div>

  <div className="grid md:grid-cols-2 gap-3 text-sm mt-4">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Auto Debug style</p>
      <p className="text-lg">{autoDebugLearningTypeCounts.style}</p>
      <p className="text-[11px] opacity-50 mt-2">
        Tone, length, structure, clarity
      </p>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Auto Debug content</p>
      <p className="text-lg">{autoDebugLearningTypeCounts.content}</p>
      <p className="text-[11px] opacity-50 mt-2">
        Route choice, search/source usage, image context
      </p>
    </div>
  </div>
</div>

<div className="p-4 bg-white/10 rounded-2xl mb-6">
  <h2 className="text-lg mb-3">🧠 Learning visibility</h2>

  <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 text-sm">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Saved AI feedback</p>
      <p className="text-lg">{learningPool.length}</p>
    </div>
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Global + user learning</p>
      <p className="text-lg">{globalLearningPool.length}</p>
    </div>
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Personal learning</p>
      <p className="text-lg">{personalLearningPool.length}</p>
    </div>
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Style learning</p>
      <p className="text-lg">{styleLearningCounts.total}</p>
    </div>
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Content learning</p>
      <p className="text-lg">{contentLearningCounts.total}</p>
    </div>
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Active live rules</p>
      <p className="text-lg">{activeLearningRules.length}</p>
    </div>
  </div>

  <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Active globally in all chats</p>
      {globalActiveLearningRules.length === 0 ? (
        <p className="opacity-60">No global learning rules yet.</p>
      ) : (
        <div className="space-y-2">
          {globalActiveLearningRules.map((rule, i) => (
            <p key={i}>🌍 {rule}</p>
          ))}
        </div>
      )}
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Active personally / locally</p>
      {personalActiveLearningRules.length === 0 ? (
        <p className="opacity-60">No personal learning rules yet.</p>
      ) : (
        <div className="space-y-2">
          {personalActiveLearningRules.map((rule, i) => (
            <p key={i}>👤 {rule}</p>
          ))}
        </div>
      )}
    </div>
  </div>

  <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Style learning split</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="opacity-60">{styleLearningCounts.total}</span>
        </div>
        <div className="flex justify-between">
          <span>Global</span>
          <span className="opacity-60">{styleLearningCounts.global}</span>
        </div>
        <div className="flex justify-between">
          <span>Personal</span>
          <span className="opacity-60">{styleLearningCounts.personal}</span>
        </div>
      </div>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Content learning split</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="opacity-60">{contentLearningCounts.total}</span>
        </div>
        <div className="flex justify-between">
          <span>Global</span>
          <span className="opacity-60">{contentLearningCounts.global}</span>
        </div>
        <div className="flex justify-between">
          <span>Personal</span>
          <span className="opacity-60">{contentLearningCounts.personal}</span>
        </div>
      </div>
    </div>
  </div>

    <div className="grid md:grid-cols-3 gap-4 text-sm mb-4">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Global weighted signals</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Shorter</span>
          <span className="opacity-60">{globalWeightedSignals.shorter}</span>
        </div>
        <div className="flex justify-between">
          <span>Clearer</span>
          <span className="opacity-60">{globalWeightedSignals.clearer}</span>
        </div>
        <div className="flex justify-between">
          <span>Structure</span>
          <span className="opacity-60">{globalWeightedSignals.structure}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
        <div className="flex justify-between">
          <span>Shorter confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(globalWeightedSignals.shorter))}>
            {getLearningConfidence(globalWeightedSignals.shorter)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Clearer confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(globalWeightedSignals.clearer))}>
            {getLearningConfidence(globalWeightedSignals.clearer)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Structure confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(globalWeightedSignals.structure))}>
            {getLearningConfidence(globalWeightedSignals.structure)}
          </span>
        </div>
      </div>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Personal weighted signals</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Shorter</span>
          <span className="opacity-60">{personalWeightedSignals.shorter}</span>
        </div>
        <div className="flex justify-between">
          <span>Clearer</span>
          <span className="opacity-60">{personalWeightedSignals.clearer}</span>
        </div>
        <div className="flex justify-between">
          <span>Structure</span>
          <span className="opacity-60">{personalWeightedSignals.structure}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
        <div className="flex justify-between">
          <span>Shorter confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(personalWeightedSignals.shorter))}>
            {getLearningConfidence(personalWeightedSignals.shorter)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Clearer confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(personalWeightedSignals.clearer))}>
            {getLearningConfidence(personalWeightedSignals.clearer)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Structure confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(personalWeightedSignals.structure))}>
            {getLearningConfidence(personalWeightedSignals.structure)}
          </span>
        </div>
      </div>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">AI learning workflow</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>New</span>
          <span className="opacity-60">{learningWorkflowCounts.nieuw}</span>
        </div>
        <div className="flex justify-between">
          <span>In progress</span>
          <span className="opacity-60">{learningWorkflowCounts.bezig}</span>
        </div>
        <div className="flex justify-between">
          <span>Done</span>
          <span className="opacity-60">{learningWorkflowCounts.klaar}</span>
        </div>
      </div>
      <p className="text-[11px] opacity-50 mt-3">
        Style learning = tone, length, clarity, structure. Content learning = preferred answer shape and successful response patterns. Saved learningType is used first when available.
      </p>
    </div>
  </div>
</div>
<div className="p-4 bg-white/10 rounded-2xl mb-6">
  <h2 className="text-lg mb-3">🧪 A/B Learning Test</h2>

  <div className="grid md:grid-cols-2 gap-4 text-sm">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Variant A</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>👍 Positive</span>
          <span className="opacity-60">{variantAScore.up}</span>
        </div>
        <div className="flex justify-between">
          <span>👎 Negative</span>
          <span className="opacity-60">{variantAScore.down}</span>
        </div>
      </div>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Variant B</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>👍 Positive</span>
          <span className="opacity-60">{variantBScore.up}</span>
        </div>
        <div className="flex justify-between">
          <span>👎 Negative</span>
          <span className="opacity-60">{variantBScore.down}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<div className="p-4 bg-white/10 rounded-2xl mb-6">
  <h2 className="text-lg mb-3">🤖 AI Action Suggestions</h2>

  <div className="space-y-2 text-sm">

        {priorityItems[0]?.type === "bug" && (
      <button
        onClick={() => handleInsightAction("focus_bug")}
        className="block text-left w-full p-3 rounded-xl bg-red-500/20 hover:bg-red-500/30"
      >
        🐞 Fix this bug first (highest priority)
      </button>
    )}

        {topComplaints.some(c => c.keyword.includes("korter") || c.keyword.includes("te lang") || c.keyword.includes("shorter") || c.keyword.includes("too long")) && (
      <button
        onClick={() => handleInsightAction("shorter_answers")}
        className="block text-left w-full p-3 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30"
      >
        ✂️ AI replies are too long → make them shorter
      </button>
    )}

        {topComplaints.some(c => c.keyword.includes("duidelijker") || c.keyword.includes("onduidelijk") || c.keyword.includes("clearer") || c.keyword.includes("unclear")) && (
      <button
        onClick={() => handleInsightAction("clearer_structure")}
        className="block text-left w-full p-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30"
      >
        🧠 Users want clearer explanations
      </button>
    )}

    {topComplaints.some(c => c.keyword.includes("structuur") || c.keyword.includes("structure")) && (
      <button
        onClick={() => handleInsightAction("clearer_structure")}
        className="block text-left w-full p-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30"
      >
        📐 Improve the structure of answers
      </button>
    )}

    {negativeFeedback.length > positiveFeedback.length && (
      <p>📉 More negative than positive feedback → review AI output</p>
    )}

  </div>
</div>

<div className="grid gap-4">
        {filteredFeedback.length === 0 && (
          <p className="opacity-60">No feedback yet...</p>
        )}

                        {filteredFeedback.map((f, i) => {
  const itemKey = getItemKey(f);
    const currentStatus = getResolvedStatus(f);

  return (
  <div key={i} className="p-4 bg-white/10 rounded-2xl">

        <p className="text-xs opacity-60 mb-1">
      {f.type === "improve"
        ? "Improvement feedback"
        : f.type === "auto_debug"
        ? "Auto Debug signal"
        : f.type === "idea"
        ? "Idea / Feedback"
        : "User"}
    </p>
    <p className="mb-3">
      {f.type === "auto_debug"
        ? f.message
        : f.type === "improve" || f.type === "idea"
        ? f.message
        : f.userMessage}
    </p>

    {f.type !== "improve" && f.type !== "idea" && f.type !== "auto_debug" && (
      <>
        <p className="text-xs opacity-60 mb-1">AI</p>
        <p className="mb-3">{f.message}</p>
      </>
    )}

        <div className="flex justify-between items-center gap-3 flex-wrap">
      <span
        className={
          f.type === "up"
            ? "text-green-400"
            : f.type === "down"
            ? "text-red-400"
            : f.type === "idea"
            ? f.source === "idea_bug"
              ? "text-red-400"
              : f.source === "idea_feedback_learning"
              ? "text-green-400"
              : "text-blue-400"
            : "text-yellow-400"
        }
      >
        {f.type === "up"
          ? "👍 Positive"
          : f.type === "down"
          ? "👎 Negative"
          : f.type === "auto_debug"
          ? "🧪 Auto Debug"
          : f.type === "idea"
          ? f.source === "idea_bug"
            ? "🐞 Bug"
            : f.source === "idea_feedback_learning"
            ? "🧠 AI feedback"
            : "💡 Adjustment"
          : "🛠️ Improvement feedback"}
        {f.type === "auto_debug" && (
          <span className="ml-2 text-xs opacity-70">
            {autoDebugConfidenceFilter === "all" &&
            autoDebugRouteFilter === "all" &&
            autoDebugSignalFilter === "all"
              ? "• filters: all"
              : `• ${autoDebugConfidenceFilter} / ${autoDebugRouteFilter} / ${autoDebugSignalFilter}`}
          </span>
        )}
      </span>

      <div className="flex items-center gap-2 ml-auto">
                        <select
          value={currentStatus}
          onChange={(e) => updateItemStatus(itemKey, e.target.value)}
          className="px-3 py-1 rounded-lg bg-white/10 text-white text-sm [&>option]:text-black"
        >
          <option value="nieuw">New</option>
          <option value="bezig">In progress</option>
          <option value="klaar">Done</option>
        </select>

        <span className="text-xs opacity-50">
          {f?.timestamp ? new Date(f.timestamp).toLocaleString() : "-"}
        </span>
      </div>
    </div>

  </div>
);
})}
      </div>

    </main>
  );
}