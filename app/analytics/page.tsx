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
  <h2 className="text-lg mb-3">🤖 AI Actie Suggesties</h2>

  <div className="space-y-2 text-sm">

    {priorityItems[0]?.type === "bug" && (
      <p>🐞 Fix deze bug eerst (hoogste prioriteit)</p>
    )}

    {topComplaints.some(c => c.keyword.includes("korter") || c.keyword.includes("te lang")) && (
      <p>✂️ AI antwoorden zijn te lang → maak ze korter</p>
    )}

    {topComplaints.some(c => c.keyword.includes("duidelijker") || c.keyword.includes("onduidelijk")) && (
      <p>🧠 Users willen duidelijkere uitleg</p>
    )}

    {topComplaints.some(c => c.keyword.includes("structuur")) && (
      <p>📐 Verbeter de structuur van antwoorden</p>
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