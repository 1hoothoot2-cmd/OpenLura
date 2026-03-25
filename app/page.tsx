"use client";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [streamController, setStreamController] = useState<AbortController | null>(null);
  const [loadingStage, setLoadingStage] = useState<"idle" | "analyzing" | "typing">("idle");

    // ✅ MEMORY ARRAY (weighted)
  const [memory, setMemory] = useState<{ text: string; weight: number }[]>([]);

  const [image, setImage] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

      const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [showClearDeletedConfirm, setShowClearDeletedConfirm] = useState(false);
  const [deleteTargetChatId, setDeleteTargetChatId] = useState<number | null>(null);
    const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("adjustment");
  const [feedbackUI, setFeedbackUI] = useState<{ [key: string]: string }>({});
  const [feedbackGiven, setFeedbackGiven] = useState<{ [key: string]: boolean }>({});
  const [improvedFeedbackGiven, setImprovedFeedbackGiven] = useState<{ [key: string]: boolean }>({});
  const [awaitingImprovement, setAwaitingImprovement] = useState<{ [key: number]: boolean }>({});
  
  const fileRef = useRef<HTMLInputElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  const greetings = [
    "👋 Hey! Waar kan ik je mee helpen?",
    "👋 Nieuwe chat gestart! Stel gerust je vraag 😊",
    "👋 Ik ben er! Waar wil je hulp bij?",
  ];

  const getGreeting = () =>
    greetings[Math.floor(Math.random() * greetings.length)];

        useEffect(() => {
    try {
      const saved = localStorage.getItem("openlura_chats");
      const mem = localStorage.getItem("openlura_memory");

      if (saved) {
        const parsed = JSON.parse(saved);
        const normalizedChats = parsed.map((chat: any) => ({
          ...chat,
          pinned: chat.pinned ?? false,
          archived: chat.archived ?? false,
          deleted: chat.deleted ?? false,
          messages: Array.isArray(chat.messages)
            ? chat.messages.map((msg: any) => ({
                ...msg,
                image: msg.image === "[image-uploaded]" ? null : msg.image ?? null,
              }))
            : [],
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
      if (mem) {
        const parsed = JSON.parse(mem);
        if (parsed.length && typeof parsed[0] === "string") {
          setMemory(parsed.map((m: string) => ({ text: m, weight: 0.5 })));
        } else {
          setMemory(parsed);
        }
      }
    } catch (error) {
      console.error("OpenLura load failed:", error);
      localStorage.removeItem("openlura_chats");
      createNewChat();
    }

    if (window.innerWidth >= 768) {
      setMobileMenu(true);
    } else {
      setMobileMenu(false);
    }
  }, []);

      useEffect(() => {
    try {
      const safeChats = chats.map((chat: any) => ({
        ...chat,
        messages: (chat.messages || []).map((msg: any) => {
          if (!msg.image) return msg;

          return {
            ...msg,
            image:
              typeof msg.image === "string" && msg.image.startsWith("data:")
                ? "[image-uploaded]"
                : msg.image,
          };
        }),
      }));

      localStorage.setItem("openlura_chats", JSON.stringify(safeChats));
    } catch (error) {
      console.error("OpenLura chat persistence failed:", error);
    }
  }, [chats]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!chatMenuRef.current) return;

      if (!chatMenuRef.current.contains(e.target as Node)) {
        setOpenChatMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      const file = imageItem?.getAsFile();

      if (!file) return;

      e.preventDefault();
      await setImageFromFile(file);
    };

    const handleWindowDrop = async (e: DragEvent) => {
      const file = Array.from(e.dataTransfer?.files || []).find((f) =>
        f.type.startsWith("image/")
      );

      if (!file) return;

      e.preventDefault();
      await setImageFromFile(file);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      const hasImage = Array.from(e.dataTransfer?.items || []).some((item) =>
        item.type.startsWith("image/")
      );

      if (hasImage) {
        e.preventDefault();
      }
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragover", handleWindowDragOver);

    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, []);

  const createNewChat = () => {
        const newChat = {
      id: Date.now(),
      title: "New Chat",
      messages: [],
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
    setDeleteTargetChatId(chatId);
    setOpenChatMenuId(null);
  };

  const confirmDeleteChat = () => {
    if (deleteTargetChatId === null) return;

    updateChatMeta(deleteTargetChatId, {
      deleted: true,
      archived: false,
      pinned: false,
    });

    setDeleteTargetChatId(null);
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
    setShowClearDeletedConfirm(true);
  };

    const confirmClearDeletedChats = () => {
    const remainingChats = chats.filter((chat: any) => !chat.deleted);

    if (remainingChats.length === 0) {
      const fallbackChat = {
        id: Date.now(),
        title: "New Chat",
        messages: [],
        pinned: false,
        archived: false,
        deleted: false,
      };

      setChats([fallbackChat]);
      setActiveChatId(fallbackChat.id);
    } else {
      setChats(remainingChats);

      const nextVisibleChat = remainingChats.find(
        (chat: any) => !chat.archived && !chat.deleted
      );

      setActiveChatId(nextVisibleChat?.id ?? remainingChats[0]?.id ?? null);
    }

    setShowClearDeletedConfirm(false);
  };

        // ✅ IMAGE HANDLER
    const readImageFile = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    const compressImageFile = async (file: File) => {
      const dataUrl = await readImageFile(file);

      const img = document.createElement("img");
      img.src = dataUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
      });

            const maxSize = 960;
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return dataUrl;

      ctx.drawImage(img, 0, 0, width, height);

            return canvas.toDataURL("image/jpeg", 0.72);
    };

    const setImageFromFile = async (file?: File | null) => {
      if (!file || !file.type?.startsWith("image/")) return;

      try {
        const compressed = await compressImageFile(file);
        setImage(compressed);
      } catch (error) {
        console.error("OpenLura image processing failed:", error);
      }
    };

    const handleFile = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      await setImageFromFile(file);
      e.target.value = "";
    };

  const getActiveLearningDebug = () => {
    const rawFeedback = JSON.parse(localStorage.getItem("openlura_feedback") || "[]");
    const feedbackText = rawFeedback
      .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
      .join(" ");

    const rules = [
      (
        feedbackText.includes("korter") ||
        feedbackText.includes("te lang") ||
        feedbackText.includes("shorter") ||
        feedbackText.includes("too long")
      ) && "kortere antwoorden",
      (
        feedbackText.includes("duidelijker") ||
        feedbackText.includes("onduidelijk") ||
        feedbackText.includes("clearer") ||
        feedbackText.includes("unclear")
      ) && "duidelijkere uitleg",
      (
        feedbackText.includes("structuur") ||
        feedbackText.includes("structure")
      ) && "betere structuur",
      (
        feedbackText.includes("te vaag") ||
        feedbackText.includes("vaag") ||
        feedbackText.includes("vague")
      ) && "concretere antwoorden",
      (
        feedbackText.includes("meer context") ||
        feedbackText.includes("more context") ||
        feedbackText.includes("more depth")
      ) && "meer context waar nodig",
      memory.some((m) => m.weight > 0.6) && "persoonlijke memory actief",
    ].filter(Boolean) as string[];

    return rules.slice(0, 4);
  };

  const updateMemoryWeight = (text: string, delta: number) => {
    if (!text?.trim() || text.trim().length >= 120) return;

    setMemory((prev) => {
      const existing = prev.find((m) => m.text === text.trim());

      let next = existing
        ? prev.map((m) =>
            m.text === text.trim()
              ? { ...m, weight: Math.max(0.1, Math.min(m.weight + delta, 1)) }
              : m
          )
        : [...prev, { text: text.trim(), weight: Math.max(0.1, Math.min(0.5 + delta, 1)) }];

      next = next.sort((a, b) => b.weight - a.weight).slice(0, 10);
      localStorage.setItem("openlura_memory", JSON.stringify(next));
      return next;
    });
  };

            const stopStreaming = () => {
    if (streamController) {
      streamController.abort();
      setStreamController(null);
    }
    setLoading(false);
    setLoadingStage("idle");
  };

  const isRetryInstruction = (text: string) => {
    const normalized = text.toLowerCase().trim();
    return [
      "opnieuw",
      "retry",
      "again",
      "nog een keer",
      "probeer opnieuw",
      "ga opnieuw",
      "doe opnieuw",
      "verder",
      "ga verder",
      "maak af",
      "maak het af",
      "continue",
      "ga door",
    ].includes(normalized);
  };

  const sendMessage = async () => {
        if (!input.trim() && !image) return;

    const currentChatId = activeChatId!;
    const isImprovementReply = awaitingImprovement[currentChatId] && !!input.trim();

        if (isImprovementReply) {
      let updated = [...chats];
      const index = updated.findIndex((c) => c.id === currentChatId);
      const retryRequest = isRetryInstruction(input);

      updated[index].messages.push({
        role: "user",
        content: input,
      });

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

      if (!retryRequest) {
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
      }

      setChats([...updated]);
      setInput("");
      setImage(null);

      setAwaitingImprovement((prev) => ({
        ...prev,
        [currentChatId]: false,
      }));

      setLoading(true);

      const improveRes = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: retryRequest
            ? `De gebruiker wil dat je opnieuw antwoord geeft op dezelfde vraag.

Oorspronkelijke vraag:
${originalUserMessage}

Je vorige onvolledige of afgewezen antwoord:
${originalAiMessage}

Geef nu direct opnieuw een volledig, goed antwoord op de oorspronkelijke vraag.
Noem niet dat dit een nieuwe poging is.`
            : `De gebruiker was niet tevreden met je vorige antwoord.

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
          memory: memory
            .filter((m) => m.weight > 0.6)
            .map((m) => m.text)
            .join(" | "),
          feedback: retryRequest
            ? {
                likes: 0,
                dislikes: 0,
                issues: [],
                recentIssues: [originalUserMessage],
              }
            : {
                likes: 0,
                dislikes: 1,
                issues: [input],
                recentIssues: [originalUserMessage],
              },
        }),
      });

                  const improveReader = improveRes.body?.getReader();
      const improveDecoder = new TextDecoder();
      const improveVariant = improveRes.headers.get("X-OpenLura-Variant") || "unknown";
      const improveSourcesHeader = improveRes.headers.get("X-OpenLura-Sources");
            let improveSources: any[] = [];
      try {
        improveSources = improveSourcesHeader
          ? JSON.parse(decodeURIComponent(improveSourcesHeader))
          : [];
      } catch {
        improveSources = [];
      }

            let improvedText = "";

      updated[index].messages.push({
        role: "ai",
        content: "Thinking...",
        variant: improveVariant,
        sources: improveSources,
      });

      setChats([...updated]);

            try {
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
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("OpenLura improve stream failed:", error);
        }
      }

            setStreamController(null);
      setLoading(false);
      setLoadingStage("idle");

      return;
    }
        if (!input && !image) return;

    let updated = [...chats];
    const index = updated.findIndex((c) => c.id === activeChatId);
    const inputToSend = input;
    const imageToSend = image;

    updated[index].messages.push({
      role: "user",
      content: inputToSend,
      image: imageToSend,
    });

    // ✅ AUTO TITLE
    if (updated[index].messages.length === 1) {
      updated[index].title = inputToSend.slice(0, 30);
    }

        setChats(updated);
    setInput("");
    setImage(null);
    setLoading(true);
    setLoadingStage(imageToSend ? "analyzing" : "typing");

    if (imageToSend) {
            setTimeout(() => {
        setLoadingStage((current) => (current === "analyzing" ? "typing" : current));
      }, 700);
    }

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

    const controller = new AbortController();
    setStreamController(controller);

    const res = await fetch("/api/chat", {
      method: "POST", // ✅ VERPLICHT
      signal: controller.signal,
      body: JSON.stringify({
        message: inputToSend,
        image: imageToSend,
        memory: memory
          .filter((m) => m.weight > 0.6)
          .map((m) => m.text)
          .join(" | "),
        personalMemory: memory
          .filter((m) => m.weight > 0.6)
          .map((m) => m.text)
          .join(" | "),
        feedback: feedbackSummary,
      }),
    });

        const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    const responseVariant = res.headers.get("X-OpenLura-Variant") || "unknown";
    const responseSourcesHeader = res.headers.get("X-OpenLura-Sources");
        let responseSources: any[] = [];
    try {
      responseSources = responseSourcesHeader
        ? JSON.parse(decodeURIComponent(responseSourcesHeader))
        : [];
    } catch {
      responseSources = [];
    }

        let aiText = "";

    updated[index].messages.push({
      role: "ai",
      content: imageToSend ? "Analyzing image..." : "Thinking...",
      variant: responseVariant,
      sources: responseSources,
    });
    setChats([...updated]);

        try {
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
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("OpenLura chat stream failed:", error);
      }
    }

    setStreamController(null);
    setLoadingStage("idle");

    // ✅ MEMORY SAVE
    if (inputToSend.length < 60) {
      const existing = memory.find((m) => m.text === inputToSend);

      let newMemory;

      if (existing) {
        newMemory = memory.map((m) =>
          m.text === inputToSend
            ? { ...m, weight: Math.min(m.weight + 0.2, 1) }
            : m
        );
      } else {
        newMemory = [...memory, { text: inputToSend, weight: 0.5 }];
      }

      newMemory = newMemory
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 10);

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
    source: message?.variant ? `ab_test_${message.variant}` : null,
    timestamp: Date.now(),
  });

    localStorage.setItem(key, JSON.stringify(existing));

  if (prevMessage?.content) {
    updateMemoryWeight(prevMessage.content, type === "up" ? 0.2 : -0.2);
  }

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
      source: message?.variant ? `ab_test_${message.variant}` : null,
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
  if (!feedbackText.trim()) return;

  const key = "openlura_ideas";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");

    const ideaEntry = {
    text: feedbackText.trim(),
    source: `idea_${feedbackCategory}`,
    timestamp: Date.now(),
  };

  existing.push(ideaEntry);

  localStorage.setItem(key, JSON.stringify(existing));

    fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
        body: JSON.stringify({
      type: "idea",
      message: feedbackText.trim(),
      userMessage: "Feedback / Idee",
      source: `idea_${feedbackCategory}`,
    }),
  }).then(() => {
    window.dispatchEvent(new Event("openlura_feedback_update"));
  });

    setFeedbackText("");
  setFeedbackCategory("adjustment");
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

                  <div className={`w-[88vw] max-w-72 p-4 bg-white/5 backdrop-blur-xl flex flex-col fixed md:relative top-0 left-0 z-50 h-full overflow-hidden transform transition-transform duration-300 ${
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
    ? "bg-white/20 ring-1 ring-white/20"
    : "bg-white/5 hover:bg-white/10"
}`}
                >
                                    <div
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setMobileMenu(false);
                    }}
                                        className="pr-8 cursor-pointer flex items-center gap-2 min-w-0"
                  >
                    <span className="text-xs opacity-70">📌</span>
                                        <span className="truncate">{chat.title}</span>
                  </div>

                                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenChatMenuId((prev) =>
                        prev === chat.id ? null : chat.id
                      );
                    }}
                    className="absolute right-1 top-1 h-9 w-9 flex items-center justify-center rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-white/10"
                  >
                    ⋯
                  </button>

                  {openChatMenuId === chat.id && (
                                        <div ref={chatMenuRef} className="absolute right-2 top-10 z-50 w-40 rounded-xl bg-[#101025] border border-white/10 shadow-xl overflow-hidden">
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
    ? "bg-white/20 ring-1 ring-white/20"
    : "bg-white/5 hover:bg-white/10"
}`}
                >
                  <div
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setMobileMenu(false);
                    }}
                                        className="pr-8 cursor-pointer truncate"
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
                    className="absolute right-1 top-1 h-9 w-9 flex items-center justify-center rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-white/10"
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
                    className="absolute right-1 top-1 h-9 w-9 flex items-center justify-center rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-white/10"
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
                    className="absolute right-1 top-1 h-9 w-9 flex items-center justify-center rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-white/10"
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
                  {showClearDeletedConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0a0a1f] p-6 rounded-2xl w-[300px]">
            <h2 className="mb-2">Weet je het zeker?</h2>
            <p className="text-sm opacity-70 mb-4">
              Alle verwijderde chats worden permanent verwijderd.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowClearDeletedConfirm(false)}
                className="flex-1 p-2 bg-white/10 rounded-xl"
              >
                Annuleren
              </button>

              <button
                onClick={confirmClearDeletedChats}
                className="flex-1 p-2 bg-red-500 rounded-xl"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetChatId !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0a0a1f] p-6 rounded-2xl w-[300px]">
            <h2 className="mb-2">Weet je het zeker?</h2>
            <p className="text-sm opacity-70 mb-4">
              Deze chat wordt verplaatst naar Verwijderde chats.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTargetChatId(null)}
                className="flex-1 p-2 bg-white/10 rounded-xl"
              >
                Annuleren
              </button>

              <button
                onClick={confirmDeleteChat}
                className="flex-1 p-2 bg-red-500 rounded-xl"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

            {showFeedbackBox && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0a0a1f] p-6 rounded-2xl w-[300px]">
                        <h2 className="mb-2">Feedback / Idee</h2>
            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value)}
              className="w-full p-2 rounded bg-white/10 mb-3"
            >
              <option value="bug">Bug</option>
              <option value="adjustment">Aanpassing</option>
              <option value="feedback_learning">AI feedback</option>
            </select>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full p-2 rounded bg-white/10 mb-3"
            />
            <div className="flex gap-2">
              <button
                                onClick={() => {
                  setShowFeedbackBox(false);
                  setFeedbackText("");
                  setFeedbackCategory("adjustment");
                }}
                className="flex-1 p-2 bg-white/10 rounded-xl"
              >
                Annuleren
              </button>
                            <button
                onClick={handleIdeaSubmit}
                disabled={!feedbackText.trim()}
                className={`flex-1 p-2 rounded-xl ${
                  feedbackText.trim()
                    ? "bg-purple-500"
                    : "bg-white/10 text-white/30"
                }`}
              >
                Verstuur
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-stretch justify-center md:p-4 pt-0">
        <div className="w-full max-w-2xl h-full md:h-[90%] flex flex-col bg-white/10 md:rounded-3xl backdrop-blur-2xl">

                    <div
  ref={messagesRef}
  className={`flex-1 overflow-y-auto pb-52 md:pb-4 ${
    activeChat?.messages?.length ? "p-4 pt-20 md:pt-4 space-y-3" : "p-4 pt-20 md:pt-4 flex items-center justify-center"
  }`}
>
                        {activeChat?.messages?.length === 0 ? (
              <div className="w-full max-w-2xl text-center px-6 flex flex-col items-center justify-center h-full -mt-20">
                                <h1 className="text-2xl md:text-4xl font-semibold tracking-tight mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                  Waar wil je vandaag mee verder?
                </h1>
                <p className="text-sm opacity-30">
                  Begin met een vraag
                </p>
                
              </div>
            ) : (
              <>
                                                {activeChat?.messages
                  .filter(
                    (msg: any) =>
                      msg.content !==
                      "🤖 Bedankt voor je feedback. Ik sla dit op en gebruik het om toekomstige antwoorden te verbeteren."
                  )
                  .map((msg: any, i: number, arr: any[]) => {
                    const isLastAI =
                      msg.role === "ai" &&
                      i === arr.length - 1;

                    return (
                                            <div key={i}>
                                                <div className={`p-3 rounded-2xl max-w-[75%] whitespace-pre-line ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-purple-500 to-blue-500 ml-auto text-white"
                            : "bg-white/20"
                        }`}>
                          {msg.image && (
                            <img
                              src={msg.image}
                              alt="Uploaded"
                              className="block w-full max-w-[240px] max-h-[260px] object-cover rounded-2xl border border-white/10"
                            />
                          )}

                          {msg.content ? (
                            <div className={msg.image ? "mt-3" : ""}>{msg.content}</div>
                          ) : null}
                        </div>

                        {msg.role === "ai" &&
                          i !== 0 &&
                          !msg.disableFeedback &&
                          msg.content !== "🤖 Wat kan ik beter doen?" &&
                          msg.content !== "🤖 Bedankt voor je feedback. Ik sla dit op en gebruik het om toekomstige antwoorden te verbeteren." && (
                            <>
                              {isLastAI && (
                                <div className="mt-2 p-2 rounded-xl bg-white/5 text-xs opacity-70">
                                  <p className="mb-1">🧠 AI Learning actief:</p>
                                  {getActiveLearningDebug().length === 0 ? (
                                    <p>geen actieve learning regels</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {getActiveLearningDebug().map((rule, idx) => (
                                        <p key={idx}>- {rule}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                                                            <div className="flex gap-2 mt-1 text-sm opacity-70 items-center">
                                {!feedbackGiven[activeChatId + "-" + i] && (
                                  <>
                                    <button onClick={() => handleFeedback(activeChatId!, i, "up")}>👍</button>
                                    <button onClick={() => handleFeedback(activeChatId!, i, "down")}>👎</button>
                                  </>
                                )}

                                {feedbackUI[activeChatId + "-" + i] && (
                                  <span className="text-xs opacity-70 ml-2">
                                    {feedbackUI[activeChatId + "-" + i]}
                                  </span>
                                )}
                              </div>

                {Array.isArray(msg.sources) && msg.sources.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-white/35">
              🔎 Bronnen
            </p>

            <div className="space-y-2">
              {msg.sources.map((source: any, sourceIndex: number) => {
                let domain = "";

                try {
                  domain = new URL(source.url).hostname.replace(/^www\./, "");
                } catch {
                  domain = source.url || "";
                }

                const title = source.title || "Bekijk bron";

                return (
                  <a
                    key={source.url || sourceIndex}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                    title={source.title || source.url}
                  >
                    <p className="text-sm text-white/90 truncate">{title}</p>
                    <p className="text-xs text-white/40 mt-1">{domain}</p>
                  </a>
                );
              })}
            </div>
          </div>
        )}
                            </>
                          )}
                      </div>
                    );
                  })}

                                {loading && (
                  <div className="opacity-70 text-sm">
                    {loadingStage === "analyzing"
                      ? "OpenLura is analyzing image..."
                      : "OpenLura is typing..."}
                  </div>
                )}
              </>
            )}
          </div>

                                        <div className={`${
  activeChat?.messages?.length === 0
    ? "mt-6 w-full max-w-2xl"
    : "fixed bottom-0 left-0 right-0 md:static z-[90] p-3 pb-4 border-t border-white/10 bg-[#050510] md:bg-transparent"
} flex items-end gap-2 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.25)]`}>

                        <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-white/8 text-lg hover:bg-white/12 transition-colors"
            >
              +
            </button>

                        <input 
              type="file" 
              accept="image/*"
              ref={fileRef} 
              onChange={handleFile}
              className="hidden" 
            />

                        {/* ✅ IMAGE PREVIEW */}
            {image && (
              <div className="relative shrink-0">
                <img
                  src={image}
                  className="w-16 h-16 object-cover rounded-2xl border border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/70 border border-white/10 text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            )}

                        <textarea
  value={input}
  onFocus={() => {
    if (window.innerWidth < 768) {
      setMobileMenu(false);
    }
  }}
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
    className="flex-1 bg-transparent rounded-2xl resize-none min-h-[52px] max-h-[140px] outline-none px-2 py-3 placeholder:text-white/35"
    placeholder={activeChat?.messages?.length === 0 ? "Ask anything" : "Message OpenLura..."}
  rows={1}
/>

                           <button
  type="button"
  disabled={!loading && !input.trim() && !image}
  onClick={loading ? stopStreaming : sendMessage}
  onTouchEnd={(e) => {
    if (!loading && !input.trim() && !image) return;
    e.preventDefault();
    loading ? stopStreaming() : sendMessage();
  }}
    className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-full text-xl shadow-lg touch-manipulation transition-all active:scale-95 ${
      loading
        ? "bg-red-500 text-white"
        : !input.trim() && !image
        ? "bg-white/10 text-white/30 shadow-none"
        : "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-purple-500/20"
    }`}
>
  {loading ? "■" : "↑"}
</button>
          </div>

        </div>
      </div>

    </main>
  );
}