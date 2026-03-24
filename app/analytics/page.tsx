"use client";
import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const [feedback, setFeedback] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("all");

  const filteredFeedback = feedback.filter((f) => {
    if (activeTab === "all") return true;
    if (activeTab === "positive") return f.type === "up";
    if (activeTab === "negative") return f.type === "down";
    if (activeTab === "improvement") return f.type === "improve";
    return true;
  });

  const negativeFeedback = feedback.filter((f) => f.type === "down");
  const positiveFeedback = feedback.filter((f) => f.type === "up");
  const improvementFeedback = feedback.filter((f) => f.type === "improve");

  const improvementTexts = improvementFeedback
    .map((f) => (f.message || "").toLowerCase().trim())
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
      count: improvementTexts.filter((text) => text.includes(keyword)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const feedbackScore =
    feedback.length > 0
      ? Math.round((positiveFeedback.length / (positiveFeedback.length + negativeFeedback.length || 1)) * 100)
      : 0;

useEffect(() => {
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

    return {
      ...item,
      _localOnly: true,
      type: isImprovementItem ? "improve" : item.type || "down",
    };
  });

  let data: any[] = [];

  try {
    const res = await fetch("/api/feedback", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Feedback ophalen mislukt");
    }

    data = await res.json();
  } catch (error) {
    console.warn("Analytics server tijdelijk niet bereikbaar");
  }

  const combined = data.length > 0 ? [...data] : [...normalizedLocal];

  const deduped = combined.filter((item: any, index: number, arr: any[]) => {
    return (
      index ===
      arr.findIndex(
        (x: any) =>
          x.timestamp === item.timestamp &&
          x.message === item.message &&
          x.userMessage === item.userMessage &&
          x.type === item.type
      )
    );
  });

  setFeedback([...deduped].reverse());
};

    const runLoad = () => {
    load().catch((error) => {
      console.error("Analytics load wrapper failed:", error);
    });
  };

runLoad();

window.addEventListener("openlura_feedback_update", runLoad);
window.addEventListener("focus", runLoad);
document.addEventListener("visibilitychange", runLoad);

return () => {
  window.removeEventListener("openlura_feedback_update", runLoad);
  window.removeEventListener("focus", runLoad);
  document.removeEventListener("visibilitychange", runLoad);
};
}, []);

  return (
    <main className="min-h-screen bg-[#050510] text-white p-6">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <h1 className="text-2xl mb-6">📊 OpenLura Analytics</h1>
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
</div>

<div className="grid md:grid-cols-3 gap-4 mb-6">
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
    </div>
  </div>

  <div className="p-4 bg-white/10 rounded-2xl">
    <h2 className="text-lg mb-3">📌 Actieve filter</h2>
    <p className="text-sm opacity-80 mb-2">
      {activeTab === "all" && "Je ziet nu alle feedback."}
      {activeTab === "negative" && "Je ziet nu alleen negatieve antwoorden."}
      {activeTab === "positive" && "Je ziet nu alleen positieve antwoorden."}
      {activeTab === "improvement" && "Je ziet nu alleen verbeterfeedback van gebruikers."}
    </p>
    <p className="text-xs opacity-60">
      Gebruik dit om snel te zien waarom iets 👎 kreeg en wat gebruikers letterlijk teruggeven.
    </p>
  </div>
</div>

<div className="grid gap-4">
        {filteredFeedback.length === 0 && (
          <p className="opacity-60">No feedback yet...</p>
        )}

        {filteredFeedback.map((f, i) => (
  <div key={i} className="p-4 bg-white/10 rounded-2xl">

    <p className="text-xs opacity-60 mb-1">
      {f.type === "improve" ? "Verbeterfeedback" : "User"}
    </p>
    <p className="mb-3">
      {f.type === "improve" ? f.message : f.userMessage}
    </p>

    {f.type !== "improve" && (
      <>
        <p className="text-xs opacity-60 mb-1">AI</p>
        <p className="mb-3">{f.message}</p>
      </>
    )}

    <div className="flex justify-between items-center">
      <span
        className={
          f.type === "up"
            ? "text-green-400"
            : f.type === "down"
            ? "text-red-400"
            : "text-yellow-400"
        }
      >
        {f.type === "up"
          ? "👍 Positive"
          : f.type === "down"
          ? "👎 Negative"
          : "🛠️ Verbeter feedback"}
      </span>

      <span className="text-xs opacity-50">
        {new Date(f.timestamp).toLocaleString()}
      </span>
    </div>

  </div>
))}
      </div>

    </main>
  );
}