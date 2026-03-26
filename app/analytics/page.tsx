"use client";
import { useEffect, useState } from "react";

export default function AnalyticsPage() {
        const [feedback, setFeedback] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("all");
    const [ideaFilter, setIdeaFilter] = useState("all");
        const [analyticsPassword, setAnalyticsPassword] = useState("");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [authError, setAuthError] = useState("");
                const [authLoading, setAuthLoading] = useState(true);
    const [itemStatus, setItemStatus] = useState<{ [key: string]: string }>({});
    const [workflowFilter, setWorkflowFilter] = useState("all");

      useEffect(() => {
    if (activeTab !== "ideas") {
      setIdeaFilter("all");
    }
  }, [activeTab]);

  useEffect(() => {
    const saved = localStorage.getItem("openlura_analytics_status");
    if (saved) {
      setItemStatus(JSON.parse(saved));
    }
  }, []);

    useEffect(() => {
    const checkAnalyticsAccess = async () => {
      try {
        const res = await fetch("/api/feedback", {
          cache: "no-store",
        });

        setIsUnlocked(res.ok);
      } catch {
        setIsUnlocked(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAnalyticsAccess();
  }, []);

            const filteredFeedback = feedback.filter((f: any) => {
        const currentStatus =
      itemStatus[
        [f.type || "", f.source || "", f.timestamp || "", f.userMessage || "", f.message || ""].join("::")
      ] || getAutoStatus(f);

    if (workflowFilter !== "all" && currentStatus !== workflowFilter) {
      return false;
    }

    if (activeTab === "all") return true;
    if (activeTab === "positive") return f.type === "up";
    if (activeTab === "negative") return f.type === "down";
    if (activeTab === "improvement") return f.type === "improve";
    if (activeTab === "ideas") {
      if (f.type !== "idea") return false;
      if (ideaFilter === "all") return true;
      if (ideaFilter === "bug") return f.source === "idea_bug";
      if (ideaFilter === "adjustment") return f.source === "idea_adjustment";
      if (ideaFilter === "learning") return f.source === "idea_feedback_learning";
    }
    return true;
  });

          const negativeFeedback = feedback.filter((f: any) => f.type === "down");
  const positiveFeedback = feedback.filter((f: any) => f.type === "up");
  const improvementFeedback = feedback.filter((f: any) => f.type === "improve");
  const ideaFeedback = feedback.filter((f: any) => f.type === "idea");
    const bugIdeas = ideaFeedback.filter((f: any) => f.source === "idea_bug");
  const adjustmentIdeas = ideaFeedback.filter((f: any) => f.source === "idea_adjustment");
  const learningIdeas = ideaFeedback.filter((f: any) => f.source === "idea_feedback_learning");

  const variantAFeedback = feedback.filter((f: any) => f.source === "ab_test_A");
  const variantBFeedback = feedback.filter((f: any) => f.source === "ab_test_B");

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
    "duidelijker",
    "onduidelijk",
    "te vaag",
    "meer context",
    "te veel tekst",
    "andere structuur",
    "niet goed",
    "verkeerd",
  ];

    const topComplaints = complaintKeywords
    .map((keyword) => ({
      keyword,
      count: improvementTexts.filter((text: string) => text.includes(keyword)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

    const bugNewCount = bugIdeas.filter(
    (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "nieuw"
  ).length;
  const bugBezigCount = bugIdeas.filter(
    (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "bezig"
  ).length;

  const learningPool = [
    ...learningIdeas,
    ...improvementFeedback,
    ...negativeFeedback,
  ];

  const learningNewCount = learningPool.filter(
    (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "nieuw"
  ).length;
  const learningBezigCount = learningPool.filter(
    (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "bezig"
  ).length;

  const adjustmentNewCount = adjustmentIdeas.filter(
    (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "nieuw"
  ).length;
  const adjustmentBezigCount = adjustmentIdeas.filter(
    (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "bezig"
  ).length;

  const priorityItems = [
    {
      label: "Bugs",
      count: bugIdeas.length,
      type: "bug",
      weightedCount: bugIdeas.length + bugNewCount * 2 + bugBezigCount,
      priority:
        bugIdeas.length + bugNewCount * 2 + bugBezigCount >= 8
          ? "Hoog"
          : bugIdeas.length + bugNewCount * 2 + bugBezigCount >= 4
          ? "Middel"
          : bugIdeas.length + bugNewCount * 2 + bugBezigCount >= 1
          ? "Laag"
          : "Geen",
    },
    {
      label: "AI feedback",
      count: learningPool.length,
      type: "learning",
      weightedCount: learningPool.length + learningNewCount * 2 + learningBezigCount,
      priority:
        learningPool.length + learningNewCount * 2 + learningBezigCount >= 12
          ? "Hoog"
          : learningPool.length + learningNewCount * 2 + learningBezigCount >= 6
          ? "Middel"
          : learningPool.length + learningNewCount * 2 + learningBezigCount >= 1
          ? "Laag"
          : "Geen",
    },
    {
      label: "Aanpassingen",
      count: adjustmentIdeas.length,
      type: "adjustment",
      weightedCount: adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount,
      priority:
        adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount >= 9
          ? "Hoog"
          : adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount >= 4
          ? "Middel"
          : adjustmentIdeas.length + adjustmentNewCount * 2 + adjustmentBezigCount >= 1
          ? "Laag"
          : "Geen",
    },
  ].sort((a, b) => b.weightedCount - a.weightedCount);

    const feedbackScore =
    feedback.length > 0
      ? Math.round((positiveFeedback.length / (positiveFeedback.length + negativeFeedback.length || 1)) * 100)
      : 0;

            const workflowCounts = {
    nieuw: filteredFeedback.filter((f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "nieuw").length,
    bezig: filteredFeedback.filter((f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "bezig").length,
    klaar: filteredFeedback.filter((f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "klaar").length,
  };

  const autoLearningItems = learningIdeas.filter(
    (f: any) => f.userMessage === "Auto learning insight"
  );

  const manualLearningItems = learningIdeas.filter(
    (f: any) => f.userMessage === "AI insight action"
  );

  const activeLearningRules: string[] = [
    topComplaints.some(
      (c) => c.keyword.includes("korter") || c.keyword.includes("te lang")
    ) && "Kortere antwoorden actief",
    topComplaints.some(
      (c) => c.keyword.includes("duidelijker") || c.keyword.includes("onduidelijk")
    ) && "Duidelijkere uitleg actief",
    topComplaints.some((c) => c.keyword.includes("structuur")) &&
      "Strakkere structuur actief",
    topComplaints.some((c) => c.keyword.includes("te vaag")) &&
      "Concretere antwoorden actief",
    topComplaints.some((c) => c.keyword.includes("meer context")) &&
      "Meer context actief",
    priorityItems[0]?.type === "bug" && "Bug focus actief",
  ].filter(Boolean) as string[];

    const learningWorkflowCounts = {
    nieuw: learningPool.filter(
      (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "nieuw"
    ).length,
    bezig: learningPool.filter(
      (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "bezig"
    ).length,
    klaar: learningPool.filter(
      (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "klaar"
    ).length,
  };

  const globalLearningPool = learningPool.filter((f: any) => !f._localOnly);
  const personalLearningPool = learningPool.filter((f: any) => f._localOnly);

  const globalLearningText = globalLearningPool
    .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
    .join(" ");

  const personalLearningText = personalLearningPool
    .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
    .join(" ");

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

  const styleLearningPool = learningPool.filter(
    (f: any) => inferLearningType(f) === "style"
  );

  const contentLearningPool = learningPool.filter(
    (f: any) => inferLearningType(f) === "content"
  );

  const globalActiveLearningRules: string[] = [
    (globalLearningText.includes("korter") || globalLearningText.includes("te lang")) &&
      "Kortere antwoorden globaal actief",
    (globalLearningText.includes("duidelijker") || globalLearningText.includes("onduidelijk")) &&
      "Duidelijkere uitleg globaal actief",
    globalLearningText.includes("structuur") && "Betere structuur globaal actief",
    globalLearningText.includes("te vaag") && "Concretere antwoorden globaal actief",
    globalLearningText.includes("meer context") && "Meer context globaal actief",
  ].filter(Boolean) as string[];

  const personalActiveLearningRules: string[] = [
    (personalLearningText.includes("korter") || personalLearningText.includes("te lang")) &&
      "Kortere antwoorden persoonlijk actief",
    (personalLearningText.includes("duidelijker") || personalLearningText.includes("onduidelijk")) &&
      "Duidelijkere uitleg persoonlijk actief",
    personalLearningText.includes("structuur") && "Betere structuur persoonlijk actief",
    personalLearningText.includes("te vaag") && "Concretere antwoorden persoonlijk actief",
    personalLearningText.includes("meer context") && "Meer context persoonlijk actief",
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
        (c) => c.keyword.includes("korter") || c.keyword.includes("te lang")
      )
    ) {
      pushAutoLearningInsight(
        "shorter_answers",
        "AI antwoorden zijn vaak te lang, geef kortere en directere antwoorden"
      );
    }

    if (
      topComplaints.some(
        (c) => c.keyword.includes("duidelijker") || c.keyword.includes("onduidelijk")
      )
    ) {
      pushAutoLearningInsight(
        "clearer_explanations",
        "Users willen duidelijkere uitleg en simpelere formulering in antwoorden"
      );
    }

    if (topComplaints.some((c) => c.keyword.includes("structuur"))) {
      pushAutoLearningInsight(
        "better_structure",
        "Users willen een duidelijkere structuur en betere opbouw in antwoorden"
      );
    }

    if (priorityItems[0]?.type === "bug") {
      pushAutoLearningInsight(
        "bug_priority",
        "Bugs hebben nu de hoogste prioriteit binnen analytics en moeten eerst opgepakt worden"
      );
    }
  }, [isUnlocked, feedback.length, topComplaints, priorityItems]);

useEffect(() => {
  if (!isUnlocked) return;

  const load = async () => {
  const localFeedback = JSON.parse(
    localStorage.getItem("openlura_feedback") || "[]"
  );

    const normalizedLocal = localFeedback.map((item: any) => {
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

    return {
      ...item,
      _localOnly: true,
      type: normalizedType,
      source: normalizedSource,
    };
  });

    let data: any[] = [];

  try {
    const res = await fetch("/api/feedback", {
      cache: "no-store",
    });

    if (res.status === 401) {
      setIsUnlocked(false);
      setFeedback([]);
      return;
    }

    if (!res.ok) {
      throw new Error("Feedback ophalen mislukt");
    }

    data = await res.json();
  } catch (error) {
    console.warn("Analytics server tijdelijk niet bereikbaar");
  }

  const workflowEntries = data.filter(
    (item: any) =>
      item.type === "workflow_status" && item.source === "analytics_workflow"
  );

  const serverStatusMap = workflowEntries
    .sort(
      (a: any, b: any) =>
        new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    )
    .reduce((acc: any, item: any) => {
      if (item.userMessage && item.message) {
        acc[item.userMessage] = item.message;
      }
      return acc;
    }, {});

  setItemStatus((prev) => {
    const next = { ...prev, ...serverStatusMap };
    localStorage.setItem("openlura_analytics_status", JSON.stringify(next));
    return next;
  });

  const normalServerFeedback = data.filter(
    (item: any) => item.type !== "workflow_status"
  );

  const combined = [...normalServerFeedback, ...normalizedLocal];

  const deduped = combined.filter((item: any, index: number, arr: any[]) => {
    const itemType = item.type || "down";
    const itemMessage = (item.message || "").trim();
    const itemUserMessage = (item.userMessage || "").trim();

    return (
      index ===
      arr.findIndex((x: any) => {
        const sameType = (x.type || "down") === itemType;
        const sameMessage = ((x.message || "").trim() === itemMessage);
        const sameUserMessage =
          ((x.userMessage || "").trim() === itemUserMessage);

        return sameType && sameMessage && sameUserMessage;
      })
    );
  });

    const sorted = [...deduped].sort((a: any, b: any) => {
    const timeA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  setFeedback(sorted);
};

    const runLoad = () => {
    load().catch((error) => {
      console.error("Analytics load wrapper failed:", error);
    });
  };

runLoad();

const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    runLoad();
  }
};

window.addEventListener("openlura_feedback_update", runLoad);
window.addEventListener("focus", runLoad);
document.addEventListener("visibilitychange", handleVisibilityChange);

return () => {
  window.removeEventListener("openlura_feedback_update", runLoad);
  window.removeEventListener("focus", runLoad);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
};
}, [isUnlocked]);

        const handleUnlock = async () => {
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "unlock_analytics",
          password: analyticsPassword,
        }),
      });

      if (!res.ok) {
        setAuthError("Verkeerd wachtwoord");
        return;
      }

      setIsUnlocked(true);
      setAuthError("");
      setAnalyticsPassword("");
    } catch {
      setAuthError("Inloggen mislukt");
    }
  };

      function getItemKey(f: any) {
    return [f.type || "", f.source || "", f.timestamp || "", f.userMessage || "", f.message || ""].join("::");
  }

      function getAutoStatus(f: any) {
    if (f.type === "up") return "klaar";
    return "nieuw";
  }

  const pushAutoLearningInsight = async (key: string, message: string) => {
    const storageKey = "openlura_auto_learning_insights";
    const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");

    if (existing.includes(key)) return;

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "idea",
          message,
          userMessage: "Auto learning insight",
          source: "idea_feedback_learning",
        }),
      });

      if (!res.ok) return;

      localStorage.setItem(
        storageKey,
        JSON.stringify([...existing, key])
      );

      window.dispatchEvent(new Event("openlura_feedback_update"));
    } catch (error) {
      console.error("Auto learning sync failed:", error);
    }
  };

        const handleInsightAction = async (action: string) => {
    if (action === "focus_bug") {
      const nextBug = bugIdeas.find(
        (f: any) => (itemStatus[getItemKey(f)] || getAutoStatus(f)) === "nieuw"
      );

      if (nextBug) {
        await updateItemStatus(getItemKey(nextBug), "bezig");
      }

      return;
    }

    if (action === "shorter_answers") {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "idea",
          message: "AI antwoorden zijn te lang, maak antwoorden korter en directer",
          userMessage: "AI insight action",
          source: "idea_feedback_learning",
        }),
      });

      window.dispatchEvent(new Event("openlura_feedback_update"));
      return;
    }

    if (action === "clearer_structure") {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "idea",
          message: "Veel users willen duidelijkere structuur en helderdere opbouw in antwoorden",
          userMessage: "AI insight action",
          source: "idea_feedback_learning",
        }),
      });

      window.dispatchEvent(new Event("openlura_feedback_update"));
    }
  };

        const updateItemStatus = async (key: string, status: string) => {
    setItemStatus((prev) => {
      const next = { ...prev, [key]: status };
      localStorage.setItem("openlura_analytics_status", JSON.stringify(next));
      return next;
    });

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_workflow_status",
          itemKey: key,
          status,
        }),
      });
    } catch (error) {
      console.error("Workflow status sync failed:", error);
    }
  };

            if (authLoading) {
    return (
      <main className="min-h-screen bg-[#050510] text-white p-6 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white/10 rounded-2xl p-6 text-center">
          Analytics laden...
        </div>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="min-h-screen bg-[#050510] text-white p-6 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white/10 rounded-2xl p-6">
          <h1 className="text-2xl mb-2">🔐 Analytics Admin</h1>
          <p className="text-sm opacity-60 mb-4">
            Voer het wachtwoord in om analytics te openen
          </p>

          <input
            type="password"
            value={analyticsPassword}
            onChange={(e) => {
              setAnalyticsPassword(e.target.value);
              if (authError) setAuthError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUnlock();
            }}
            className="w-full p-3 rounded-xl bg-white/10 mb-3 outline-none"
            placeholder="Wachtwoord"
          />

          {authError && (
            <p className="text-red-400 text-sm mb-3">{authError}</p>
          )}

          <button
            onClick={handleUnlock}
            className="w-full p-3 bg-purple-500 rounded-xl"
          >
            Ontgrendelen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050510] text-white p-6">
      
            <div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl">📊 OpenLura Analytics</h1>
    <button
    onClick={() => {
      document.cookie =
        "openlura_analytics_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      localStorage.removeItem("openlura_auto_learning_insights");
      setIsUnlocked(false);
      setFeedback([]);
    }}
    className="text-xs px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20"
  >
    Logout
  </button>
</div>

      <p className="text-xs opacity-50 mb-4">
  Environment: {typeof window !== "undefined" ? window.location.origin : ""}
</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Server items</p>
    <p className="text-xl">{feedback.filter((f) => !f._localOnly).length}</p>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Lokale items</p>
    <p className="text-xl">{feedback.filter((f) => f._localOnly).length}</p>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <p className="text-xs opacity-60">Totaal zichtbaar</p>
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
    <p className="text-xs opacity-60">Totaal</p>
    <p className="text-xl">{feedback.length}</p>
  </button>

  <button
    onClick={() => setActiveTab("positive")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "positive" ? "bg-green-500/30 ring-1 ring-green-300/40" : "bg-green-500/20"
    }`}
  >
    <p className="text-xs opacity-60">👍 Positief</p>
    <p className="text-xl">{positiveFeedback.length}</p>
  </button>

  <button
    onClick={() => setActiveTab("negative")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "negative" ? "bg-red-500/30 ring-1 ring-red-300/40" : "bg-red-500/20"
    }`}
  >
    <p className="text-xs opacity-60">👎 Negatief</p>
    <p className="text-xl">{negativeFeedback.length}</p>
  </button>

  <button
    onClick={() => setActiveTab("improvement")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "improvement" ? "bg-yellow-500/30 ring-1 ring-yellow-300/40" : "bg-yellow-500/20"
    }`}
  >
    <p className="text-xs opacity-60">🛠️ Verbeter</p>
    <p className="text-xl">{improvementFeedback.length}</p>
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
    <p className="text-xs opacity-60">🔥 Top prioriteit</p>
    <p className="text-xl">{priorityItems[0]?.label || "Geen"}</p>
    <p className="text-xs opacity-60 mt-1">{priorityItems[0]?.priority || ""}</p>
  </div>

  <button
    onClick={() => setActiveTab("ideas")}
    className={`p-4 rounded-xl text-left ${
      activeTab === "ideas" ? "bg-blue-500/30 ring-1 ring-blue-300/40" : "bg-blue-500/20"
    }`}
  >
    <p className="text-xs opacity-60">💡 Ideeën</p>
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
    Negatief
  </button>
  <button
    onClick={() => setActiveTab("positive")}
    className={`px-4 py-2 rounded-xl ${activeTab === "positive" ? "bg-green-400 text-black" : "bg-white/10 text-white"}`}
  >
    Positief
  </button>
    <button
    onClick={() => setActiveTab("improvement")}
    className={`px-4 py-2 rounded-xl ${activeTab === "improvement" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
  >
    Verbeter
  </button>
  <button
    onClick={() => setActiveTab("ideas")}
    className={`px-4 py-2 rounded-xl ${activeTab === "ideas" ? "bg-blue-400 text-black" : "bg-white/10 text-white"}`}
  >
    Ideeën
  </button>
</div>

{activeTab === "ideas" && (
  <div className="mb-6 flex flex-wrap gap-2">
    <button
      onClick={() => setIdeaFilter("all")}
      className={`px-4 py-2 rounded-xl ${ideaFilter === "all" ? "bg-blue-400 text-black" : "bg-white/10 text-white"}`}
    >
      Alle ideeën ({ideaFeedback.length})
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
      Aanpassingen ({adjustmentIdeas.length})
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
    Alles ({filteredFeedback.length})
  </button>
  <button
    onClick={() => setWorkflowFilter("nieuw")}
    className={`px-4 py-2 rounded-xl ${workflowFilter === "nieuw" ? "bg-blue-400 text-black" : "bg-white/10 text-white"}`}
  >
    Nieuw ({feedback.filter((f: any) => {
      const status = itemStatus[getItemKey(f)] || getAutoStatus(f);
      if (status !== "nieuw") return false;
      if (activeTab === "all") return true;
      if (activeTab === "positive") return f.type === "up";
      if (activeTab === "negative") return f.type === "down";
      if (activeTab === "improvement") return f.type === "improve";
      if (activeTab === "ideas") {
        if (f.type !== "idea") return false;
        if (ideaFilter === "all") return true;
        if (ideaFilter === "bug") return f.source === "idea_bug";
        if (ideaFilter === "adjustment") return f.source === "idea_adjustment";
        if (ideaFilter === "learning") return f.source === "idea_feedback_learning";
      }
      return true;
    }).length})
  </button>
  <button
    onClick={() => setWorkflowFilter("bezig")}
    className={`px-4 py-2 rounded-xl ${workflowFilter === "bezig" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
  >
    In behandeling ({feedback.filter((f: any) => {
      const status = itemStatus[getItemKey(f)] || getAutoStatus(f);
      if (status !== "bezig") return false;
      if (activeTab === "all") return true;
      if (activeTab === "positive") return f.type === "up";
      if (activeTab === "negative") return f.type === "down";
      if (activeTab === "improvement") return f.type === "improve";
      if (activeTab === "ideas") {
        if (f.type !== "idea") return false;
        if (ideaFilter === "all") return true;
        if (ideaFilter === "bug") return f.source === "idea_bug";
        if (ideaFilter === "adjustment") return f.source === "idea_adjustment";
        if (ideaFilter === "learning") return f.source === "idea_feedback_learning";
      }
      return true;
    }).length})
  </button>
  <button
    onClick={() => setWorkflowFilter("klaar")}
    className={`px-4 py-2 rounded-xl ${workflowFilter === "klaar" ? "bg-green-400 text-black" : "bg-white/10 text-white"}`}
  >
    Klaar ({feedback.filter((f: any) => {
      const status = itemStatus[getItemKey(f)] || getAutoStatus(f);
      if (status !== "klaar") return false;
      if (activeTab === "all") return true;
      if (activeTab === "positive") return f.type === "up";
      if (activeTab === "negative") return f.type === "down";
      if (activeTab === "improvement") return f.type === "improve";
      if (activeTab === "ideas") {
        if (f.type !== "idea") return false;
        if (ideaFilter === "all") return true;
        if (ideaFilter === "bug") return f.source === "idea_bug";
        if (ideaFilter === "adjustment") return f.source === "idea_adjustment";
        if (ideaFilter === "learning") return f.source === "idea_feedback_learning";
      }
      return true;
    }).length})
  </button>
</div>

<div className="grid md:grid-cols-4 gap-4 mb-6">
  <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">🚨 Top complaints</h2>
    {topComplaints.length === 0 ? (
      <p className="opacity-60 text-sm">Nog geen veelvoorkomende patronen.</p>
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
        <span>Negatieve antwoorden</span>
        <span className="opacity-60">{negativeFeedback.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Verbeterfeedback</span>
        <span className="opacity-60">{improvementFeedback.length}</span>
      </div>
            <div className="flex justify-between">
        <span>Positieve antwoorden</span>
        <span className="opacity-60">{positiveFeedback.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Idea bugs</span>
        <span className="opacity-60">{bugIdeas.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Idea aanpassingen</span>
        <span className="opacity-60">{adjustmentIdeas.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Idea AI feedback</span>
        <span className="opacity-60">{learningIdeas.length}</span>
      </div>
    </div>
  </div>

    <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">📌 Actieve filter</h2>
    <p className="text-sm opacity-80 mb-2">
      {activeTab === "all" && "Je ziet nu alle feedback."}
      {activeTab === "negative" && "Je ziet nu alleen negatieve antwoorden."}
      {activeTab === "positive" && "Je ziet nu alleen positieve antwoorden."}
            {activeTab === "improvement" && "Je ziet nu alleen verbeterfeedback van gebruikers."}
      {activeTab === "ideas" && "Je ziet nu alleen ingestuurde ideeën en algemene feedback."}
    </p>
    <p className="text-xs opacity-60">
      Gebruik dit om snel te zien waarom iets 👎 kreeg en wat gebruikers letterlijk teruggeven.
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
        <span>Nieuw</span>
        <span className="opacity-60">{workflowCounts.nieuw}</span>
      </div>
      <div className="flex justify-between">
        <span>In behandeling</span>
        <span className="opacity-60">{workflowCounts.bezig}</span>
      </div>
      <div className="flex justify-between">
        <span>Klaar</span>
        <span className="opacity-60">{workflowCounts.klaar}</span>
      </div>
    </div>
  </div>
</div>

<div className="p-4 bg-white/10 rounded-2xl mb-6">
  <h2 className="text-lg mb-3">🧠 Learning visibility</h2>

  <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 text-sm">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Opgeslagen AI feedback</p>
      <p className="text-lg">{learningPool.length}</p>
    </div>
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-1">Global learning</p>
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
      <p className="text-xs opacity-60 mb-1">Actieve live rules</p>
      <p className="text-lg">{activeLearningRules.length}</p>
    </div>
  </div>

  <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Globaal actief in alle chats</p>
      {globalActiveLearningRules.length === 0 ? (
        <p className="opacity-60">Nog geen globale learning rules.</p>
      ) : (
        <div className="space-y-2">
          {globalActiveLearningRules.map((rule, i) => (
            <p key={i}>🌍 {rule}</p>
          ))}
        </div>
      )}
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Persoonlijk / lokaal actief</p>
      {personalActiveLearningRules.length === 0 ? (
        <p className="opacity-60">Nog geen persoonlijke learning rules.</p>
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
          <span>Totaal</span>
          <span className="opacity-60">{styleLearningCounts.total}</span>
        </div>
        <div className="flex justify-between">
          <span>Globaal</span>
          <span className="opacity-60">{styleLearningCounts.global}</span>
        </div>
        <div className="flex justify-between">
          <span>Persoonlijk</span>
          <span className="opacity-60">{styleLearningCounts.personal}</span>
        </div>
      </div>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Content learning split</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Totaal</span>
          <span className="opacity-60">{contentLearningCounts.total}</span>
        </div>
        <div className="flex justify-between">
          <span>Globaal</span>
          <span className="opacity-60">{contentLearningCounts.global}</span>
        </div>
        <div className="flex justify-between">
          <span>Persoonlijk</span>
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
          <span>Korter</span>
          <span className="opacity-60">{globalWeightedSignals.shorter}</span>
        </div>
        <div className="flex justify-between">
          <span>Duidelijker</span>
          <span className="opacity-60">{globalWeightedSignals.clearer}</span>
        </div>
        <div className="flex justify-between">
          <span>Structuur</span>
          <span className="opacity-60">{globalWeightedSignals.structure}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
        <div className="flex justify-between">
          <span>Korter confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(globalWeightedSignals.shorter))}>
            {getLearningConfidence(globalWeightedSignals.shorter)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Duidelijker confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(globalWeightedSignals.clearer))}>
            {getLearningConfidence(globalWeightedSignals.clearer)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Structuur confidence</span>
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
          <span>Korter</span>
          <span className="opacity-60">{personalWeightedSignals.shorter}</span>
        </div>
        <div className="flex justify-between">
          <span>Duidelijker</span>
          <span className="opacity-60">{personalWeightedSignals.clearer}</span>
        </div>
        <div className="flex justify-between">
          <span>Structuur</span>
          <span className="opacity-60">{personalWeightedSignals.structure}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
        <div className="flex justify-between">
          <span>Korter confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(personalWeightedSignals.shorter))}>
            {getLearningConfidence(personalWeightedSignals.shorter)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Duidelijker confidence</span>
          <span className={getLearningConfidenceColor(getLearningConfidence(personalWeightedSignals.clearer))}>
            {getLearningConfidence(personalWeightedSignals.clearer)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Structuur confidence</span>
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
          <span>Nieuw</span>
          <span className="opacity-60">{learningWorkflowCounts.nieuw}</span>
        </div>
        <div className="flex justify-between">
          <span>In behandeling</span>
          <span className="opacity-60">{learningWorkflowCounts.bezig}</span>
        </div>
        <div className="flex justify-between">
          <span>Klaar</span>
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
          <span>👍 Positief</span>
          <span className="opacity-60">{variantAScore.up}</span>
        </div>
        <div className="flex justify-between">
          <span>👎 Negatief</span>
          <span className="opacity-60">{variantAScore.down}</span>
        </div>
      </div>
    </div>

    <div className="p-3 rounded-xl bg-white/5">
      <p className="text-xs opacity-60 mb-2">Variant B</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>👍 Positief</span>
          <span className="opacity-60">{variantBScore.up}</span>
        </div>
        <div className="flex justify-between">
          <span>👎 Negatief</span>
          <span className="opacity-60">{variantBScore.down}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<div className="p-4 bg-white/10 rounded-2xl mb-6">
  <h2 className="text-lg mb-3">🤖 AI Actie Suggesties</h2>

  <div className="space-y-2 text-sm">

        {priorityItems[0]?.type === "bug" && (
      <button
        onClick={() => handleInsightAction("focus_bug")}
        className="block text-left w-full p-3 rounded-xl bg-red-500/20 hover:bg-red-500/30"
      >
        🐞 Fix deze bug eerst (hoogste prioriteit)
      </button>
    )}

        {topComplaints.some(c => c.keyword.includes("korter") || c.keyword.includes("te lang")) && (
      <button
        onClick={() => handleInsightAction("shorter_answers")}
        className="block text-left w-full p-3 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30"
      >
        ✂️ AI antwoorden zijn te lang → maak ze korter
      </button>
    )}

        {topComplaints.some(c => c.keyword.includes("duidelijker") || c.keyword.includes("onduidelijk")) && (
      <button
        onClick={() => handleInsightAction("clearer_structure")}
        className="block text-left w-full p-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30"
      >
        🧠 Users willen duidelijkere uitleg
      </button>
    )}

    {topComplaints.some(c => c.keyword.includes("structuur")) && (
      <button
        onClick={() => handleInsightAction("clearer_structure")}
        className="block text-left w-full p-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30"
      >
        📐 Verbeter de structuur van antwoorden
      </button>
    )}

    {negativeFeedback.length > positiveFeedback.length && (
      <p>📉 Meer negatieve dan positieve feedback → herzie AI output</p>
    )}

  </div>
</div>

<div className="grid gap-4">
        {filteredFeedback.length === 0 && (
          <p className="opacity-60">No feedback yet...</p>
        )}

                        {filteredFeedback.map((f, i) => {
  const itemKey = getItemKey(f);
    const currentStatus = itemStatus[itemKey] || getAutoStatus(f);

  return (
  <div key={i} className="p-4 bg-white/10 rounded-2xl">

        <p className="text-xs opacity-60 mb-1">
      {f.type === "improve"
        ? "Verbeterfeedback"
        : f.type === "idea"
        ? "Idee / Feedback"
        : "User"}
    </p>
    <p className="mb-3">
      {f.type === "improve" || f.type === "idea" ? f.message : f.userMessage}
    </p>

    {f.type !== "improve" && f.type !== "idea" && (
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
          : f.type === "idea"
          ? f.source === "idea_bug"
            ? "🐞 Bug"
            : f.source === "idea_feedback_learning"
            ? "🧠 AI feedback"
            : "💡 Aanpassing"
          : "🛠️ Verbeter feedback"}
        {(f.type === "down" || f.type === "improve" || f.source === "idea_feedback_learning") && (
          <span className="ml-2 text-xs opacity-60">
            [{inferLearningType(f) === "style" ? "style" : "content"}]
          </span>
        )}
      </span>

      <div className="flex items-center gap-2 ml-auto">
                        <select
          value={currentStatus}
          onChange={(e) => updateItemStatus(itemKey, e.target.value)}
          className="px-3 py-1 rounded-lg bg-white/10 text-white text-sm [&>option]:text-black"
        >
          <option value="nieuw">Nieuw</option>
          <option value="bezig">In behandeling</option>
          <option value="klaar">Klaar</option>
        </select>

        <span className="text-xs opacity-50">
          {new Date(f.timestamp).toLocaleString()}
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