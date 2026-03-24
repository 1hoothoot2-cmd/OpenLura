"use client";
import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const [feedback, setFeedback] = useState<any[]>([]);

useEffect(() => {
  const load = async () => {
    const res = await fetch("/api/feedback");
    const data = await res.json();
    setFeedback([...data].reverse());
  };

  load();

  window.addEventListener("openlura_feedback_update", load);

  return () => {
    window.removeEventListener("openlura_feedback_update", load);
  };
}, []);

  return (
    <main className="min-h-screen bg-[#050510] text-white p-6">
      
      <h1 className="text-2xl mb-6">📊 OpenLura Analytics</h1>

      <div className="grid gap-4">
        {feedback.length === 0 && (
          <p className="opacity-60">No feedback yet...</p>
        )}

        {feedback.map((f, i) => (
          <div key={i} className="p-4 bg-white/10 rounded-2xl">

            <p className="text-xs opacity-60 mb-1">User</p>
            <p className="mb-3">{f.userMessage}</p>

            <p className="text-xs opacity-60 mb-1">AI</p>
            <p className="mb-3">{f.message}</p>

            <div className="flex justify-between items-center">
              <span
                className={
                  f.type === "up"
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {f.type === "up" ? "👍 Positive" : "👎 Negative"}
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