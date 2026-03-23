"use client";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const greetings = [
    "👋 Hey! Waar kan ik je mee helpen?",
    "👋 Nieuwe chat gestart! Stel gerust je vraag 😊",
    "👋 Ik ben er! Waar wil je hulp bij?",
  ];

  const getGreeting = () =>
    greetings[Math.floor(Math.random() * greetings.length)];

  useEffect(() => {
    const saved = localStorage.getItem("openlura_chats");
    const mem = localStorage.getItem("openlura_memory");

    if (saved) {
      const parsed = JSON.parse(saved);
      setChats(parsed);
      setActiveChatId(parsed[0]?.id);
    } else {
      createNewChat();
    }

    if (mem) setMemory(mem);

    if (window.innerWidth >= 768) {
      setMobileMenu(true);
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("openlura_chats", JSON.stringify(chats));
    }
  }, [chats]);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "New Chat",
      messages: [{ role: "ai", content: getGreeting() }],
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const activeChat = chats.find((c) => c.id === activeChatId);

  const sendMessage = async () => {
    if (!input && !image) return;

    let updated = [...chats];
    const index = updated.findIndex((c) => c.id === activeChatId);

    updated[index].messages.push({
      role: "user",
      content: input,
      image,
    });

    setChats(updated);
    setInput("");
    setImage(null);
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: input, memory }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    let aiText = "";

    updated[index].messages.push({ role: "ai", content: "" });
    setChats([...updated]);

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      let chunk = decoder.decode(value);

      chunk = chunk
        .replace(/\(blank line\)/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n\s*\n/g, "\n\n");

      aiText += chunk;

      updated[index].messages[
        updated[index].messages.length - 1
      ].content = aiText;

      setChats([...updated]);
    }

    setLoading(false);
  };

  const handleFeedback = (chatId: number, msgIndex: number, type: string) => {
    const key = "openlura_feedback";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");

    existing.push({
      chatId,
      msgIndex,
      type,
      timestamp: Date.now(),
    });

    localStorage.setItem(key, JSON.stringify(existing));
  };

  const handleIdeaSubmit = () => {
    const key = "openlura_ideas";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");

    existing.push({
      text: feedbackText,
      timestamp: Date.now(),
    });

    localStorage.setItem(key, JSON.stringify(existing));
    setFeedbackText("");
    setShowFeedbackBox(false);
  };

  return (
    <main className="flex h-screen bg-[#050510] text-white">

      {/* Sidebar */}
      <div className={`w-72 p-4 bg-white/5 backdrop-blur-xl flex flex-col absolute md:relative z-40 h-full transition ${
        mobileMenu ? "left-0" : "-left-full md:left-0"
      }`}>
        
        <button
          onClick={createNewChat}
          className="mb-3 p-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
        >
          + New Chat
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="mb-3 p-2 rounded-xl bg-white/10"
        />

        <div className="flex-1 overflow-y-auto space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
            >
              {chat.title}
            </div>
          ))}
        </div>

        {/* 🔥 Feedback knop */}
        <button
          onClick={() => setShowFeedbackBox(true)}
          className="mt-3 p-2 rounded-xl bg-white/10 hover:bg-white/20"
        >
          💡 Feedback / Bug
        </button>
      </div>

      {/* Feedback popup */}
      {showFeedbackBox && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0a0a1f] p-6 rounded-2xl w-[300px]">
            <h2 className="mb-2">Feedback / Bug </h2>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full p-2 rounded bg-white/10 mb-3"
              placeholder="Typ je idee..."
            />
            <button
              onClick={handleIdeaSubmit}
              className="w-full p-2 bg-purple-500 rounded-xl"
            >
              Verstuur
            </button>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl h-[90%] flex flex-col bg-white/10 rounded-3xl backdrop-blur-2xl">

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {activeChat?.messages.map((msg: any, i: number) => (
              <div key={i}>
                <div className={`p-3 rounded-2xl max-w-[75%] whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 ml-auto text-white"
                    : "bg-white/20"
                }`}>
                  {msg.content}
                </div>

                {msg.role === "ai" && (
                  <div className="flex gap-2 mt-1 text-sm opacity-70">
                    <button onClick={() => handleFeedback(activeChatId!, i, "up")}>
                      👍
                    </button>
                    <button onClick={() => handleFeedback(activeChatId!, i, "down")}>
                      👎
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && <div>...</div>}
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2 border-t border-white/10 items-center">

            <button
              onClick={() => fileRef.current?.click()}
              className="text-xl px-2"
            >
              +
            </button>

            <input type="file" ref={fileRef} className="hidden" />

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 p-2 bg-white/10 rounded-xl"
              placeholder="Ask OpenLura..."
            />

            <button onClick={sendMessage} className="px-4 bg-purple-500 rounded-xl">
              Send
            </button>
          </div>

        </div>
      </div>

    </main>
  );
}