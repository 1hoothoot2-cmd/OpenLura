"use client";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ MEMORY ARRAY
  const [memory, setMemory] = useState<string[]>([]);

  const [image, setImage] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackUI, setFeedbackUI] = useState<{ [key: string]: string }>({});
  const [feedbackGiven, setFeedbackGiven] = useState<{ [key: string]: boolean }>({});
  const [improvedFeedbackGiven, setImprovedFeedbackGiven] = useState<{ [key: string]: boolean }>({});
  const [awaitingImprovement, setAwaitingImprovement] = useState<{ [key: number]: boolean }>({});
  
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

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
      const normalizedChats = parsed.map((chat: any) => ({
        ...chat,
        pinned: chat.pinned ?? false,
        archived: chat.archived ?? false,
        deleted: chat.deleted ?? false,
      }));

      setChats(normalizedChats);
      setActiveChatId(
        normalizedChats.find(
          (chat: any) => !chat.archived && !chat.deleted
        )?.id ?? null
      );
    } else {
      createNewChat();
    }

    // ✅ MEMORY LOAD FIX
    if (mem) setMemory(JSON.parse(mem));

    if (window.innerWidth >= 768) {
  setMobileMenu(true);
} else {
  setMobileMenu(false);
}
  }, []);

    useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("openlura_chats", JSON.stringify(chats));
    }
  }, [chats]);

  useEffect(() => {
    setOpenChatMenuId(null);
  }, [activeChatId]);
  useEffect(() => {
  const el = messagesRef.current;
  if (!el) return;

  requestAnimationFrame(() => {
    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
  });
}, [activeChatId, chats, loading]);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "New Chat",
      messages: [{ role: "ai", content: getGreeting() }],
      pinned: false,
      archived: false,
      deleted: false,
    };

        setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setOpenChatMenuId(null);
  };

    const [openChatMenuId, setOpenChatMenuId] = useState<number | null>(null);

  const activeChat = chats.find((c: any) => c.id === activeChatId);

  const updateChatMeta = (
    chatId: number,
    updates: Partial<{
      pinned: boolean;
      archived: boolean;
      deleted: boolean;
    }>
  ) => {
    const updatedChats = chats.map((chat: any) =>
      chat.id === chatId ? { ...chat, ...updates } : chat
    );

    setChats(updatedChats);

    if (activeChatId === chatId && (updates.archived || updates.deleted)) {
      const nextVisibleChat = updatedChats.find(
        (chat: any) => !chat.archived && !chat.deleted
      );
      setActiveChatId(nextVisibleChat?.id ?? null);
    }

    setOpenChatMenuId(null);
  };

  const togglePinnedChat = (chatId: number) => {
    const target = chats.find((chat: any) => chat.id === chatId);
    if (!target) return;

    updateChatMeta(chatId, { pinned: !target.pinned });
  };

  const archiveChat = (chatId: number) => {
    updateChatMeta(chatId, {
      archived: true,
      deleted: false,
      pinned: false,
    });
  };

  const restoreArchivedChat = (chatId: number) => {
    updateChatMeta(chatId, {
      archived: false,
      deleted: false,
    });
  };

  const deleteChat = (chatId: number) => {
    updateChatMeta(chatId, {
      deleted: true,
      archived: false,
      pinned: false,
    });
  };

  const restoreDeletedChat = (chatId: number) => {
    updateChatMeta(chatId, {
      deleted: false,
      archived: false,
    });
  };

  const visibleChats = chats.filter(
    (chat: any) => !chat.archived && !chat.deleted
  );

  const pinnedChats = visibleChats.filter((chat: any) => chat.pinned);

  const searchedPinnedChats = pinnedChats.filter((chat: any) =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  );

  const regularChats = visibleChats.filter(
    (chat: any) =>
      !chat.pinned &&
      chat.title.toLowerCase().includes(search.toLowerCase())
  );

  const archivedChats = chats.filter(
    (chat: any) => chat.archived && !chat.deleted
  );

    const deletedChats = chats.filter((chat: any) => chat.deleted);

  const clearDeletedChats = () => {
    setChats((prev) => prev.filter((chat: any) => !chat.deleted));
  };

  // ✅ IMAGE HANDLER
  const handleFile = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
        if (!input.trim() && !image) return;

    const currentChatId = activeChatId!;
    const isImprovementReply = awaitingImprovement[currentChatId] && !!input.trim();

    if (isImprovementReply) {
      let updated = [...chats];
      const index = updated.findIndex((c) => c.id === currentChatId);

      updated[index].messages.push({
        role: "user",
        content: input,
      });

      const localFeedbackKey = "openlura_feedback";
      const existingFeedback = JSON.parse(localStorage.getItem(localFeedbackKey) || "[]");

      existingFeedback.push({
        chatId: currentChatId,
        msgIndex: updated[index].messages.length - 1,
                type: "improve",
        message: input,
        userMessage: "Direct improvement feedback",
        timestamp: Date.now(),
        source: "improvement_reply",
      });

      localStorage.setItem(localFeedbackKey, JSON.stringify(existingFeedback));

            const keyId = currentChatId + "-" + (updated[index].messages.length - 1);

      setFeedbackUI(prev => ({
        ...prev,
        [keyId]: "Thanks for your feedback"
      }));

      setTimeout(() => {
        setFeedbackUI(prev => {
          const copy = { ...prev };
          delete copy[keyId];
          return copy;
        });
      }, 2000);

      setChats([...updated]);
      setInput("");
      setImage(null);

      try {
  const feedbackRes = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatId: currentChatId,
      type: "improve",
      message: input,
      userMessage: "Direct improvement feedback",
      source: "improvement_reply",
    }),
  });

  if (!feedbackRes.ok) {
    throw new Error("Improvement feedback POST failed");
  }

  window.dispatchEvent(new Event("openlura_feedback_update"));
} catch (error) {
  console.error("OpenLura improvement feedback save failed:", error);
}

      const chatMessages = updated[index].messages;

      const originalUserMessage =
        [...chatMessages]
          .reverse()
          .find((msg: any) => msg.role === "user" && msg.content !== input)?.content || "";

      const originalAiMessage =
        [...chatMessages]
          .reverse()
          .find(
            (msg: any) =>
              msg.role === "ai" &&
              !msg.disableFeedback &&
              msg.content !== "🤖 Wat kan ik beter doen?"
          )?.content || "";

      setAwaitingImprovement((prev) => ({
        ...prev,
        [currentChatId]: false,
      }));

      setLoading(true);

      const improveRes = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: `De gebruiker was niet tevreden met je vorige antwoord.

Oorspronkelijke vraag:
${originalUserMessage}

Je vorige antwoord:
${originalAiMessage}

Verbeterpunt van de gebruiker:
${input}

Geef nu meteen een betere versie van hetzelfde antwoord.

BELANGRIJK:
- Volg het verbeterpunt van de gebruiker letterlijk op
- Als de gebruiker zegt "korter" of "te lang": maak het antwoord maximaal 50% van de oorspronkelijke lengte
- Als de gebruiker zegt "duidelijker": maak het antwoord simpeler en concreter
- Als de gebruiker kritiek geeft op structuur: pas de structuur zichtbaar aan
- Herhaal niet dezelfde fout als in het vorige antwoord

Noem niet dat dit een verbeterde versie is.
Geef alleen direct het betere antwoord.`,
          memory: memory.join(" | "),
          feedback: {
            likes: 0,
            dislikes: 1,
            issues: [input],
            recentIssues: [originalUserMessage],
          },
        }),
      });

      const improveReader = improveRes.body?.getReader();
      const improveDecoder = new TextDecoder();

      let improvedText = "";

      updated[index].messages.push({
        role: "ai",
        content: "",
      });

      setChats([...updated]);

      while (true) {
        const { done, value } = await improveReader!.read();
        if (done) break;

        let chunk = improveDecoder.decode(value);

        chunk = chunk
          .replace(/\(blank line\)/gi, "")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/\n\s*\n/g, "\n\n");

        improvedText += chunk;

        updated[index].messages[
          updated[index].messages.length - 1
        ].content = improvedText;

        setChats([...updated]);
      }

      setLoading(false);

      return;
    }
    if (!input && !image) return;

    let updated = [...chats];
    const index = updated.findIndex((c) => c.id === activeChatId);

    updated[index].messages.push({
      role: "user",
      content: input,
      image,
    });

    // ✅ AUTO TITLE
    if (updated[index].messages.length === 2) {
      updated[index].title = input.slice(0, 30);
    }

    setChats(updated);
    setInput("");
    setImage(null);
    setLoading(true);
const rawFeedback = JSON.parse(localStorage.getItem("openlura_feedback") || "[]").slice(-20);

// geef recente feedback meer gewicht
const weightedFeedback = rawFeedback.map((f: any, i: number) => ({
  ...f,
  weight: i / rawFeedback.length + 0.5, // recenter = hoger
}));

const feedbackSummary = {
  likes: weightedFeedback
    .filter((f: any) => f.type === "up")
    .reduce((sum: number, f: any) => sum + f.weight, 0),

  dislikes: weightedFeedback
    .filter((f: any) => f.type === "down")
    .reduce((sum: number, f: any) => sum + f.weight, 0),

  issues: weightedFeedback
    .filter((f: any) => f.type === "down")
    .map((f: any) => f.message),

  recentIssues: weightedFeedback
    .filter((f: any) => f.type === "down")
    .map((f: any) => f.userMessage)
    .slice(-3),
};
 
const res = await fetch("/api/chat", {
  method: "POST", // ✅ VERPLICHT
  body: JSON.stringify({
    message: input,
    memory: memory.join(" | "),
    feedback: feedbackSummary,
  }),
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

    // ✅ MEMORY SAVE
    if (input.length < 60) {
      const newMemory = [...memory, input].slice(-10);
      setMemory(newMemory);
      localStorage.setItem("openlura_memory", JSON.stringify(newMemory));
    }

    setLoading(false);
  };
  const handleFeedback = async (chatId: number, msgIndex: number, type: string) => {
console.log("FEEDBACK CLICKED", { chatId, msgIndex, type });
  const key = "openlura_feedback";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");

  const chat = chats.find(c => c.id === chatId);
  const message = chat?.messages[msgIndex];
  const prevMessage =
[...(chat?.messages.slice(0, msgIndex) || [])]
.reverse()
.find((msg: any) => msg.role === "user");

  existing.push({
    chatId,
    msgIndex,
    type,
    message: message?.content,
    userMessage: prevMessage?.content,
    timestamp: Date.now(),
  });

  localStorage.setItem(key, JSON.stringify(existing));

      try {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatId,
      msgIndex,
      type,
      message: message?.content,
      userMessage: prevMessage?.content,
    }),
  });

  if (!res.ok) {
    throw new Error("Feedback POST failed");
  }

  window.dispatchEvent(new Event("openlura_feedback_update"));
} catch (error) {
  console.error("OpenLura feedback save failed:", error);
}

  const keyId = chatId + "-" + msgIndex;

  setFeedbackGiven(prev => ({
    ...prev,
    [keyId]: true
  }));

  setFeedbackUI(prev => ({
    ...prev,
    [keyId]: "Thanks for your feedback"
  }));

  setTimeout(() => {
    setFeedbackUI(prev => {
      const copy = { ...prev };
      delete copy[keyId];
      return copy;
    });
  }, 2000);

  if (type === "down") {
    const updatedChats = [...chats];
    const chatIndex = updatedChats.findIndex(c => c.id === chatId);

    updatedChats[chatIndex].messages.push({
  role: "ai",
  content: "🤖 Wat kan ik beter doen?",
  disableFeedback: true,
});

    setChats(updatedChats);

    setAwaitingImprovement(prev => ({
      ...prev,
      [chatId]: true
    }));
  }
};

const handleImprovedFeedback = (chatId: number, msgIndex: number, type: string) => {
  const keyId = chatId + "-" + msgIndex;

  setImprovedFeedbackGiven(prev => ({
    ...prev,
    [keyId]: true
  }));

  if (type === "down") {
  const updatedChats = [...chats];
  const chatIndex = updatedChats.findIndex(c => c.id === chatId);

  const original = updatedChats[chatIndex].messages[msgIndex].content;

  updatedChats[chatIndex].messages[msgIndex] = {
  ...updatedChats[chatIndex].messages[msgIndex],
  content:
    original +
    "\n\n---\n\n🤖 OpenLura is still learning.\nYour feedback has been saved and will improve future answers.",
  isLearningNote: true,
};

  setChats([...updatedChats]);
}
};

  const handleIdeaSubmit = () => {
  const key = "openlura_ideas";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");

  const ideaEntry = {
    text: feedbackText,
    timestamp: Date.now(),
  };

  existing.push(ideaEntry);

  localStorage.setItem(key, JSON.stringify(existing));

  fetch("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      type: "idea",
      message: feedbackText,
      userMessage: "Feedback / Idee",
    }),
  }).then(() => {
    window.dispatchEvent(new Event("openlura_feedback_update"));
  });

  setFeedbackText("");
  setShowFeedbackBox(false);
};

  return (
    <main className="fixed inset-0 flex bg-[#050510] text-white overflow-hidden">
      <button
  onClick={() => setMobileMenu(!mobileMenu)}
  className="fixed top-4 left-4 z-[70] md:hidden bg-white/10 backdrop-blur-xl p-2 rounded-full"
>
  ☰
</button>

            <div className={`w-72 p-4 bg-white/5 backdrop-blur-xl flex flex-col fixed md:relative top-0 left-0 z-50 h-full overflow-hidden transform transition-transform duration-300 ${
        mobileMenu ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        
        <button
          onClick={() => {
  createNewChat();
  setMobileMenu(false);
}}
          className="mb-3 p-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
        >
          + New Chat
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search active chats..."
          className="mb-3 p-2 rounded-xl bg-white/10"
        />

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {searchedPinnedChats.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide opacity-50 px-1">
                Vastgemaakt
              </p>

              {searchedPinnedChats.map((chat: any) => (
                <div
                  key={chat.id}
                  className={`group relative p-2 rounded-lg ${
                    activeChatId === chat.id
                      ? "bg-white/15"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setMobileMenu(false);
                    }}
                    className="pr-8 cursor-pointer"
                  >
                    {chat.title}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenChatMenuId((prev) =>
                        prev === chat.id ? null : chat.id
                      );
                    }}
                    className="absolute right-2 top-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    ⋯
                  </button>

                  {openChatMenuId === chat.id && (
                    <div className="absolute right-2 top-10 z-50 w-40 rounded-xl bg-[#101025] border border-white/10 shadow-xl overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinnedChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        Losmaken
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        Archief
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10 text-red-300"
                      >
                        Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide opacity-50 px-1">
              Je chats
            </p>

            {regularChats.length === 0 ? (
              <div className="p-2 rounded-lg bg-white/5 text-sm opacity-60">
                Geen actieve chats gevonden.
              </div>
            ) : (
              regularChats.map((chat: any) => (
                <div
                  key={chat.id}
                  className={`group relative p-2 rounded-lg ${
                    activeChatId === chat.id
                      ? "bg-white/15"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setMobileMenu(false);
                    }}
                    className="pr-8 cursor-pointer"
                  >
                    {chat.title}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenChatMenuId((prev) =>
                        prev === chat.id ? null : chat.id
                      );
                    }}
                    className="absolute right-2 top-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    ⋯
                  </button>

                  {openChatMenuId === chat.id && (
                    <div className="absolute right-2 top-10 z-50 w-40 rounded-xl bg-[#101025] border border-white/10 shadow-xl overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinnedChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        Vastmaken
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        Archief
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10 text-red-300"
                      >
                        Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide opacity-50 px-1">
              Archief
            </p>

            {archivedChats.length === 0 ? (
              <div className="p-2 rounded-lg bg-white/5 text-sm opacity-60">
                Geen gearchiveerde chats.
              </div>
            ) : (
              archivedChats.map((chat: any) => (
                <div
                  key={chat.id}
                  className="group relative p-2 rounded-lg bg-white/5 hover:bg-white/10"
                >
                  <div
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setMobileMenu(false);
                    }}
                    className="pr-8 cursor-pointer opacity-80"
                  >
                    {chat.title}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenChatMenuId((prev) =>
                        prev === chat.id ? null : chat.id
                      );
                    }}
                    className="absolute right-2 top-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    ⋯
                  </button>

                  {openChatMenuId === chat.id && (
                    <div className="absolute right-2 top-10 z-50 w-40 rounded-xl bg-[#101025] border border-white/10 shadow-xl overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreArchivedChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        Terugzetten
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10 text-red-300"
                      >
                        Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

                    <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs uppercase tracking-wide opacity-50">
                Verwijderde chats
              </p>
              {deletedChats.length > 0 && (
                <button
                  onClick={clearDeletedChats}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Leegmaken
                </button>
              )}
            </div>

            {deletedChats.length === 0 ? (
              <div className="p-2 rounded-lg bg-white/5 text-sm opacity-60">
                Geen verwijderde chats.
              </div>
            ) : (
              deletedChats.map((chat: any) => (
                <div
                  key={chat.id}
                  className="group relative p-2 rounded-lg bg-white/5 hover:bg-white/10"
                >
                  <div className="pr-8 opacity-60">{chat.title}</div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenChatMenuId((prev) =>
                        prev === chat.id ? null : chat.id
                      );
                    }}
                    className="absolute right-2 top-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    ⋯
                  </button>

                  {openChatMenuId === chat.id && (
                    <div className="absolute right-2 top-10 z-50 w-40 rounded-xl bg-[#101025] border border-white/10 shadow-xl overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreDeletedChat(chat.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/10"
                      >
                        Terugzetten
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <button
          onClick={() => setShowFeedbackBox(true)}
          className="mt-3 p-2 rounded-xl bg-white/10 hover:bg-white/20"
        >
          💡 Feedback / Idee
        </button>
      </div>
{mobileMenu && (
  <div
    onClick={() => setMobileMenu(false)}
    className="fixed inset-0 bg-black/50 z-30 md:hidden"
  />
)}
      {showFeedbackBox && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0a0a1f] p-6 rounded-2xl w-[300px]">
            <h2 className="mb-2">Feedback / Idee</h2>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full p-2 rounded bg-white/10 mb-3"
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

      <div className="flex-1 flex items-stretch justify-center md:p-4 pt-0">
        <div className="w-full max-w-2xl h-full md:h-[90%] flex flex-col bg-white/10 md:rounded-3xl backdrop-blur-2xl">

          <div
  ref={messagesRef}
  className="flex-1 p-4 pt-20 md:pt-4 overflow-y-auto space-y-3 pb-52 md:pb-4"
>
                        {activeChat?.messages
              .filter(
                (msg: any) =>
                  msg.content !==
                  "🤖 Bedankt voor je feedback. Ik sla dit op en gebruik het om toekomstige antwoorden te verbeteren."
              )
              .map((msg: any, i: number) => (
              <div key={i}>
                <div className={`p-3 rounded-2xl max-w-[75%] whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 ml-auto text-white"
                    : "bg-white/20"
                }`}>
                  {msg.content}
                </div>

                {msg.role === "ai" &&
  i !== 0 &&
  !msg.disableFeedback &&
  msg.content !== "🤖 Wat kan ik beter doen?" &&
  msg.content !== "🤖 Bedankt voor je feedback. Ik sla dit op en gebruik het om toekomstige antwoorden te verbeteren." && (
  <div className="flex gap-2 mt-1 text-sm opacity-70 items-center">

    {/* FEEDBACK (clean versie) */}
{!feedbackGiven[activeChatId + "-" + i] && (
  <>
    <button onClick={() => handleFeedback(activeChatId!, i, "up")}>👍</button>
    <button onClick={() => handleFeedback(activeChatId!, i, "down")}>👎</button>
  </>
)}

    {/* FEEDBACK TEXT */}
    {feedbackUI[activeChatId + "-" + i] && (
      <span className="text-xs opacity-70 ml-2">
        {feedbackUI[activeChatId + "-" + i]}
      </span>
    )}

  </div>
)}
              </div>
            ))}

            {/* ✅ BETERE LOADING */}
            {loading && (
              <div className="opacity-70 text-sm">
                OpenLura is typing...
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 md:static z-40 p-3 pb-4 flex gap-2 border-t border-white/10 items-end bg-[#050510] md:bg-transparent">

            <button onClick={() => fileRef.current?.click()} className="text-xl px-2">+</button>

            <input 
              type="file" 
              ref={fileRef} 
              onChange={handleFile}
              className="hidden" 
            />

            {/* ✅ IMAGE PREVIEW */}
            {image && (
              <img 
                src={image} 
                className="w-16 h-16 object-cover rounded-xl"
              />
            )}

            <textarea
  value={input}
  onChange={(e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  }}
  onKeyDown={(e) => {
    const isMobile = window.innerWidth < 768;

    if (!isMobile && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }}
  className="flex-1 p-3 bg-white/10 rounded-2xl resize-none min-h-[52px] max-h-[140px] outline-none"
  placeholder="Ask OpenLura..."
  rows={1}
/>

            <button
  onClick={sendMessage}
  className="w-12 h-12 shrink-0 flex items-center justify-center bg-purple-500 rounded-full text-xl"
>
  ↑
</button>
          </div>

        </div>
      </div>

    </main>
  );
}