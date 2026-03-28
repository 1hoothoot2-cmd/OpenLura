"use client";
import Sidebar from "@/components/chat/Sidebar";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function Home() {
  const pathname = usePathname();
  const isPersonalRoute = pathname === "/persoonlijke-omgeving";
  const chatStorageKey = isPersonalRoute
    ? "openlura_personal_chats"
    : "openlura_chats";
  const memoryStorageKey = isPersonalRoute
    ? "openlura_personal_memory"
    : "openlura_memory";
  const [personalStateLoaded, setPersonalStateLoaded] = useState(false);
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
  const [awaitingImprovement, setAwaitingImprovement] = useState<{
    [key: number]: {
      targetMsgIndex: number;
      originalUserMessage: string;
      originalAiMessage: string;
    } | null;
  }>({});
  const [showLoginBox, setShowLoginBox] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState<{
  visible: boolean;
  message: string;
  tier: string;
}>({
  visible: false,
  message: "",
  tier: "",
});

const [usage, setUsage] = useState<{
  used: number;
  limit: number;
  percentage: number;
} | null>(null);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const preferredActiveChatIdRef = useRef<number | null>(null);
  const pendingActiveChatIdRef = useRef<number | null>(null);
  const forcedActiveChatIdRef = useRef<number | null>(null);
  const isBootstrappingChatRef = useRef(false);
  const personalSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedInitialStateRef = useRef(false);
  const hasManualChatSelectionRef = useRef(false);
  const latestChatsRef = useRef<any[]>([]);
  const latestActiveChatIdRef = useRef<number | null>(null);
  const [initialStateReady, setInitialStateReady] = useState(false);
  const [openChatMenuId, setOpenChatMenuId] = useState<number | null>(null);

  const greetings = [
    "👋 Hey! Waar kan ik je mee helpen?",
    "👋 Nieuwe chat gestart! Stel gerust je vraag 😊",
    "👋 Ik ben er! Waar wil je hulp bij?",
  ];

  const getGreeting = () =>
    greetings[Math.floor(Math.random() * greetings.length)];

const buildFallbackChat = (overrides?: Partial<any>) => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  title: isPersonalRoute ? "Persoonlijke omgeving" : "New Chat",
  messages: isPersonalRoute
    ? [
        {
          role: "ai",
          content:
            "👋 Welkom in je persoonlijke omgeving. Hier testen we privé memory, verbeterpunten en training van jouw AI-gedrag.",
        },
      ]
    : [],
  pinned: false,
  archived: false,
  deleted: false,
  ...overrides,
});

  const activateChat = (chatId: number) => {
  const chatExists = chats.some(
    (c) => c.id === chatId && !c.deleted
  );

  if (!chatExists) return;

  hasManualChatSelectionRef.current = true;
  pendingActiveChatIdRef.current = chatId;
  preferredActiveChatIdRef.current = chatId;
  forcedActiveChatIdRef.current = chatId;

  setActiveChatId(chatId);
  setOpenChatMenuId(null);
};

  const createNewChat = (
    preset?: Partial<{
      title: string;
      messages: { role: string; content: string; image?: string | null }[];
    }>
  ) => {
    isBootstrappingChatRef.current = false;

    const baseTitle =
      preset?.title || (isPersonalRoute ? "Persoonlijke chat" : "New Chat");

    const newChatId = Date.now() + Math.floor(Math.random() * 1000);

    hasManualChatSelectionRef.current = true;
    pendingActiveChatIdRef.current = newChatId;
    preferredActiveChatIdRef.current = newChatId;
    forcedActiveChatIdRef.current = newChatId;
    setOpenChatMenuId(null);

    setChats((prev) => {
      const existingTitles = prev.map((chat: any) =>
        String(chat.title || "").trim()
      );

      const buildUniqueTitle = (rawBaseTitle: string) => {
        if (!existingTitles.includes(rawBaseTitle)) return rawBaseTitle;

        let counter = 2;
        while (existingTitles.includes(`${rawBaseTitle} ${counter}`)) {
          counter += 1;
        }

        return `${rawBaseTitle} ${counter}`;
      };

      const newChat = {
        id: newChatId,
        title: buildUniqueTitle(baseTitle),
        messages: preset?.messages ? [...preset.messages] : [],
        pinned: false,
        archived: false,
        deleted: false,
      };

      return [newChat, ...prev];
    });

    setActiveChatId(newChatId);
  };

  useEffect(() => {
    const loadState = async () => {
      try {
        let loadedFromServer = false;

        if (isPersonalRoute) {
          try {
            const res = await fetch("/api/personal-state", {
              method: "GET",
              headers: getOpenLuraRequestHeaders(false),
              cache: "no-store",
            });

            if (res.ok) {
  const data = await res.json();
  const serverChats = Array.isArray(data?.chats) ? data.chats : [];
  const serverMemory = Array.isArray(data?.memory) ? data.memory : [];

  const normalizedChats = serverChats.map((chat: any) => ({
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

  const hasServerState =
    normalizedChats.length > 0 || serverMemory.length > 0;

  if (hasServerState && !hasManualChatSelectionRef.current) {
    setChats(normalizedChats);

    const nextActiveChatId =
      normalizedChats.find((chat: any) => !chat.archived && !chat.deleted)?.id ??
      normalizedChats.find((chat: any) => !chat.deleted)?.id ??
      null;

    preferredActiveChatIdRef.current = nextActiveChatId;
    setActiveChatId(nextActiveChatId);
  }

  if (hasServerState) {
    if (serverMemory.length > 0) {
      if (typeof serverMemory[0] === "string") {
        setMemory(serverMemory.map((m: string) => ({ text: m, weight: 0.5 })));
      } else {
        setMemory(serverMemory);
      }
    } else {
      setMemory([]);
    }
  }

  loadedFromServer = hasServerState;
}

            setPersonalStateLoaded(true);
          } catch (error) {
            console.error("OpenLura personal server load failed:", error);
            setPersonalStateLoaded(true);
          }
        }

        const saved = localStorage.getItem(chatStorageKey);
        const mem = localStorage.getItem(memoryStorageKey);

        if (!loadedFromServer && saved) {
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

  if (!hasManualChatSelectionRef.current) {
    setChats(normalizedChats);

    const nextActiveChatId =
      normalizedChats.find((chat: any) => !chat.archived && !chat.deleted)?.id ??
      normalizedChats.find((chat: any) => !chat.deleted)?.id ??
      null;

    preferredActiveChatIdRef.current = nextActiveChatId;
    setActiveChatId(nextActiveChatId);
  }
} else if (!saved && !isPersonalRoute && !hasManualChatSelectionRef.current) {
  createNewChat();
}

        if (!loadedFromServer && mem) {
          const parsed = JSON.parse(mem);
          if (parsed.length && typeof parsed[0] === "string") {
            setMemory(parsed.map((m: string) => ({ text: m, weight: 0.5 })));
          } else {
            setMemory(parsed);
          }
        }
      } catch (error) {
        console.error("OpenLura load failed:", error);
        localStorage.removeItem(chatStorageKey);
        if (!isPersonalRoute) {
          createNewChat();
        }
      }

      if (window.innerWidth >= 768) {
        setMobileMenu(true);
      } else {
        setMobileMenu(false);
      }
    };

    loadState().finally(() => {
      hasLoadedInitialStateRef.current = true;
      setInitialStateReady(true);
    });
  }, [chatStorageKey, memoryStorageKey, isPersonalRoute]);

  useEffect(() => {
    latestChatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    latestActiveChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    if (!initialStateReady) {
      return;
    }

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

    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(safeChats));
    } catch (error) {
      console.error("OpenLura local chat persistence failed:", error);
    }

    if (!isPersonalRoute || !personalStateLoaded) {
  return;
}

const hasMeaningfulPersonalState =
  safeChats.some((chat: any) => {
    const normalizedTitle = String(chat?.title || "").trim();
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];

    const hasRealMessageContent = messages.some(
      (msg: any) =>
        typeof msg?.content === "string" &&
        msg.content.trim() &&
        msg.content !==
          "👋 Welkom in je persoonlijke omgeving. Hier testen we privé memory, verbeterpunten en training van jouw AI-gedrag."
    );

    const isPersonalFallbackPlaceholder =
      normalizedTitle === "Persoonlijke omgeving" &&
      messages.length === 1 &&
      messages[0]?.role === "ai" &&
      messages[0]?.content ===
        "👋 Welkom in je persoonlijke omgeving. Hier testen we privé memory, verbeterpunten en training van jouw AI-gedrag.";

    return hasRealMessageContent || !isPersonalFallbackPlaceholder;
  }) || memory.length > 0;

    if (!hasMeaningfulPersonalState) {
      return;
    }

    if (personalSyncTimeoutRef.current) {
      clearTimeout(personalSyncTimeoutRef.current);
    }

    personalSyncTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/personal-state", {
          method: "POST",
          headers: getOpenLuraRequestHeaders(true),
          body: JSON.stringify({
            chats: safeChats,
            memory,
          }),
        });
      } catch (error) {
        console.error("OpenLura personal sync failed:", error);
      }
    }, 700);

    return () => {
      if (personalSyncTimeoutRef.current) {
        clearTimeout(personalSyncTimeoutRef.current);
      }
    };
  }, [chats, chatStorageKey, isPersonalRoute, memory, personalStateLoaded, initialStateReady]);

  useEffect(() => {
    return () => {
      if (personalSyncTimeoutRef.current) {
        clearTimeout(personalSyncTimeoutRef.current);
      }
    };
  }, []);

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
    resizeComposerTextarea();
  }, [input, image]);

  useEffect(() => {
    if (!isPersonalRoute) return;

    const loadPersonalStateFromServer = async (forceApply = false) => {
      try {
        const res = await fetch("/api/personal-state", {
          method: "GET",
          headers: getOpenLuraRequestHeaders(false),
          cache: "no-store",
        });

        if (res.status === 401) {
          window.location.href = "/";
          return;
        }

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        const serverChats = Array.isArray(data?.chats) ? data.chats : [];
        const serverMemory = Array.isArray(data?.memory) ? data.memory : [];

        const normalizedChats = serverChats.map((chat: any) => ({
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

        const latestChats = latestChatsRef.current;
        const latestActiveChatId = latestActiveChatIdRef.current;

        const hasLocalMeaningfulChats = latestChats.some(
          (chat: any) =>
            Array.isArray(chat.messages) &&
            chat.messages.some(
              (msg: any) =>
                typeof msg?.content === "string" &&
                msg.content.trim() &&
                msg.content !==
                  "👋 Welkom in je persoonlijke omgeving. Hier testen we privé memory, verbeterpunten en training van jouw AI-gedrag."
            )
        );

        const shouldApplyChats =
          (!hasLocalMeaningfulChats && latestChats.length === 0) ||
          (!hasLocalMeaningfulChats && normalizedChats.length > 0);

        const hasServerChats = normalizedChats.length > 0;

        if (shouldApplyChats && (hasServerChats || !hasLocalMeaningfulChats)) {
          setChats(normalizedChats);

          const currentStillExists =
            latestActiveChatId !== null &&
            normalizedChats.some(
              (chat: any) =>
                chat.id === latestActiveChatId && !chat.archived && !chat.deleted
            );

          const nextActiveChatId = currentStillExists
            ? latestActiveChatId
            : normalizedChats.find((chat: any) => !chat.archived && !chat.deleted)?.id ??
              normalizedChats.find((chat: any) => !chat.deleted)?.id ??
              null;

          preferredActiveChatIdRef.current=nextActiveChatId;
          pendingActiveChatIdRef.current = nextActiveChatId;
          forcedActiveChatIdRef.current = nextActiveChatId;
          setActiveChatId(nextActiveChatId);
        }

        if (serverMemory.length > 0) {
          if (typeof serverMemory[0] === "string") {
            setMemory(serverMemory.map((m: string) => ({ text: m, weight: 0.5 })));
          } else {
            setMemory(serverMemory);
          }
        } else if (forceApply) {
          setMemory([]);
        }

        setPersonalStateLoaded(true);
      } catch (error) {
        console.error("OpenLura personal access verify failed:", error);
      }
    };

    const handleWindowFocus = () => {
      loadPersonalStateFromServer(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadPersonalStateFromServer(false);
      }
    };

    loadPersonalStateFromServer(false);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPersonalRoute]);

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

const messageShellClass =
  "w-full min-w-0 max-w-full overflow-hidden";
const messageBubbleClass =
  "min-w-0 max-w-full overflow-hidden break-words [overflow-wrap:anywhere] break-all";
const composerShellClass =
  "w-full min-w-0 max-w-full shrink-0 overflow-x-hidden border-t border-white/10 bg-black/70 backdrop-blur";
const composerInnerClass =
  "mx-auto w-full max-w-4xl min-w-0 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:px-4";
const composerInputClass =
  "w-full min-w-0 max-w-full resize-none overflow-x-hidden break-words [overflow-wrap:anywhere]";

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

const getOpenLuraRequestHeaders = (includeJson = true) => {
  const headers: Record<string, string> = includeJson
    ? { "Content-Type": "application/json" }
    : {};

  const resolvedUserId = getOrCreateOpenLuraUserId();

  if (resolvedUserId) {
    headers["x-openlura-user-id"] = resolvedUserId;
  }

  if (isPersonalRoute) {
    headers["x-openlura-personal-env"] = "true";
  }

  return headers;
};

const normalizedSearch = search.toLowerCase().trim();

const visibleChats = chats.filter(
  (chat: any) => !chat.archived && !chat.deleted
);

const pinnedChats = visibleChats.filter((chat: any) => chat.pinned);

const searchedPinnedChats = pinnedChats.filter((chat: any) =>
  String(chat.title || "").toLowerCase().includes(normalizedSearch)
);

const regularChats = visibleChats.filter(
  (chat: any) =>
    !chat.pinned &&
    String(chat.title || "").toLowerCase().includes(normalizedSearch)
);

const archivedChats = chats.filter(
  (chat: any) => chat.archived === true && chat.deleted !== true
);

const deletedChats = chats.filter(
  (chat: any) => chat.deleted === true
);

const activeChat =
  visibleChats.find((c: any) => c.id === activeChatId) ??
  visibleChats[0] ??
  null;

const resizeComposerTextarea = () => {
  const el = inputRef.current;
  if (!el) return;

  el.style.height = "0px";
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
};

  useEffect(() => {
    const visibleChats = chats.filter(
      (chat: any) => !chat.archived && !chat.deleted
    );

    if (!initialStateReady) {
      return;
    }

    if (isPersonalRoute && !personalStateLoaded && chats.length === 0) {
      return;
    }

    if (visibleChats.length === 0) {
  if (isPersonalRoute) {
    isBootstrappingChatRef.current = false;
    return;
  }

  const hasAnyChats = chats.length > 0;
  const hasArchivedOrDeletedChats = chats.some(
    (chat: any) => chat.archived || chat.deleted
  );

  if (hasAnyChats || hasArchivedOrDeletedChats) {
    isBootstrappingChatRef.current = false;
    preferredActiveChatIdRef.current = null;
    pendingActiveChatIdRef.current = null;
    forcedActiveChatIdRef.current = null;
    setActiveChatId(null);
    return;
  }

  if (isBootstrappingChatRef.current) {
    return;
  }

  isBootstrappingChatRef.current = true;

  const bootstrapChat = buildFallbackChat();
  const bootstrapChatId = bootstrapChat.id;

  hasManualChatSelectionRef.current = false;
  pendingActiveChatIdRef.current = bootstrapChatId;
  preferredActiveChatIdRef.current = bootstrapChatId;
  forcedActiveChatIdRef.current = bootstrapChatId;
  setOpenChatMenuId(null);
  setChats([bootstrapChat]);
  setActiveChatId(bootstrapChatId);
  return;
}

    isBootstrappingChatRef.current = false;

    const forcedId = forcedActiveChatIdRef.current;

    if (forcedId !== null) {
      const forcedVisible = visibleChats.some(
        (chat: any) => chat.id === forcedId
      );

      if (forcedVisible) {
        if (activeChatId !== forcedId) {
          setActiveChatId(forcedId);
          return;
        }

        preferredActiveChatIdRef.current = forcedId;
        pendingActiveChatIdRef.current = null;
        return;
      }
    }

    const pendingId = pendingActiveChatIdRef.current;

    if (pendingId !== null) {
      const pendingVisible = visibleChats.some(
        (chat: any) => chat.id === pendingId
      );

      if (!pendingVisible) {
        return;
      }

      if (activeChatId !== pendingId) {
        setActiveChatId(pendingId);
        return;
      }

      preferredActiveChatIdRef.current = pendingId;
      pendingActiveChatIdRef.current = null;
      forcedActiveChatIdRef.current = pendingId;
      return;
    }

    const currentActiveStillVisible =
      activeChatId !== null &&
      visibleChats.some((chat: any) => chat.id === activeChatId);

    if (currentActiveStillVisible) {
      preferredActiveChatIdRef.current = activeChatId;
      forcedActiveChatIdRef.current = activeChatId;
      return;
    }

    const preferredId = preferredActiveChatIdRef.current;

    if (
      preferredId !== null &&
      visibleChats.some((chat: any) => chat.id === preferredId)
    ) {
      if (activeChatId !== preferredId) {
        setActiveChatId(preferredId);
        return;
      }

      forcedActiveChatIdRef.current = preferredId;
      return;
    }

    const fallbackId = visibleChats[0]?.id ?? null;
    preferredActiveChatIdRef.current = fallbackId;
    forcedActiveChatIdRef.current = fallbackId;
    setActiveChatId(fallbackId);
  }, [isPersonalRoute, personalStateLoaded, chats, activeChatId, initialStateReady]);

  const updateChatMeta = (
    chatId: number,
    updates: Partial<{
      pinned: boolean;
      archived: boolean;
      deleted: boolean;
    }>
  ) => {
    setChats((prev) => {
      const updatedChats = prev.map((chat: any) => {
        if (chat.id !== chatId) return chat;

        return {
          ...chat,
          ...updates,
        };
      });

      const targetChat = updatedChats.find((chat: any) => chat.id === chatId) || null;
      const targetIsVisible = !!targetChat && !targetChat.archived && !targetChat.deleted;

      if (targetIsVisible) {
        preferredActiveChatIdRef.current = chatId;
        pendingActiveChatIdRef.current = chatId;
        forcedActiveChatIdRef.current = chatId;
        setActiveChatId(chatId);
      } else if (activeChatId === chatId || updates.archived || updates.deleted) {
        const nextVisibleChat = updatedChats.find(
          (chat: any) => !chat.archived && !chat.deleted
        );
        const nextFallbackChat = updatedChats.find(
          (chat: any) => !chat.deleted
        );
        const nextActiveChatId =
          nextVisibleChat?.id ?? nextFallbackChat?.id ?? null;

        preferredActiveChatIdRef.current = nextActiveChatId;
        pendingActiveChatIdRef.current = nextActiveChatId;
        forcedActiveChatIdRef.current = nextActiveChatId;
        setActiveChatId(nextActiveChatId);
      }

      return updatedChats;
    });

    setOpenChatMenuId(null);
  };

  const togglePinnedChat = (chatId: number) => {
    const target = chats.find((chat: any) => chat.id === chatId);
    if (!target) return;

    updateChatMeta(chatId, { pinned: !target.pinned });
  };

  const archiveChat = (chatId: number) => {
    const nextVisibleChat = chats.find(
      (chat: any) => chat.id !== chatId && !chat.archived && !chat.deleted
    );
    const nextFallbackChat = chats.find(
      (chat: any) => chat.id !== chatId && !chat.deleted
    );
    const nextActiveChatId =
      nextVisibleChat?.id ?? nextFallbackChat?.id ?? null;

    if (activeChatId === chatId) {
      preferredActiveChatIdRef.current = nextActiveChatId;
      pendingActiveChatIdRef.current = nextActiveChatId;
      forcedActiveChatIdRef.current = nextActiveChatId;
      setActiveChatId(nextActiveChatId);
    }

    updateChatMeta(chatId, {
      archived: true,
      deleted: false,
      pinned: false,
    });
  };

  const restoreArchivedChat = (chatId: number) => {
    preferredActiveChatIdRef.current = chatId;
    pendingActiveChatIdRef.current = chatId;
    forcedActiveChatIdRef.current = chatId;
    setActiveChatId(chatId);

    updateChatMeta(chatId, {
      archived: false,
      deleted: false,
    });
  };

   const deleteChat = (chatId: number) => {
  // ensure menu sluit en state clean is
  setOpenChatMenuId(null);
  setDeleteTargetChatId(chatId);
};

  const confirmDeleteChat = () => {
    if (deleteTargetChatId === null) return;

    const nextVisibleChat = chats.find(
      (chat: any) => chat.id !== deleteTargetChatId && !chat.archived && !chat.deleted
    );
    const nextFallbackChat = chats.find(
      (chat: any) => chat.id !== deleteTargetChatId && !chat.deleted
    );
    const nextActiveChatId =
      nextVisibleChat?.id ?? nextFallbackChat?.id ?? null;

    if (activeChatId === deleteTargetChatId) {
      preferredActiveChatIdRef.current = nextActiveChatId;
      pendingActiveChatIdRef.current = nextActiveChatId;
      forcedActiveChatIdRef.current = nextActiveChatId;
      setActiveChatId(nextActiveChatId);
    }

    updateChatMeta(deleteTargetChatId, {
      deleted: true,
      archived: false,
      pinned: false,
    });

    setDeleteTargetChatId(null);
  };

  const restoreDeletedChat = (chatId: number) => {
    preferredActiveChatIdRef.current = chatId;
    pendingActiveChatIdRef.current = chatId;
    forcedActiveChatIdRef.current = chatId;
    setActiveChatId(chatId);

    updateChatMeta(chatId, {
      deleted: false,
      archived: false,
    });
  };

    const clearDeletedChats = () => {
    setShowClearDeletedConfirm(true);
  };

    const confirmClearDeletedChats = () => {
    const remainingChats = chats.filter((chat: any) => !chat.deleted);

    if (remainingChats.length === 0) {
      const fallbackChat = buildFallbackChat();

      isBootstrappingChatRef.current = false;
      setChats([fallbackChat]);
      preferredActiveChatIdRef.current = fallbackChat.id;
      pendingActiveChatIdRef.current = fallbackChat.id;
      forcedActiveChatIdRef.current = fallbackChat.id;
      setActiveChatId(fallbackChat.id);
    } else {
      setChats(remainingChats);

      const nextVisibleChat = remainingChats.find(
        (chat: any) => !chat.archived && !chat.deleted
      );

      const nextFallbackChat = remainingChats.find(
        (chat: any) => !chat.deleted
      );

      const nextActiveChatId =
        nextVisibleChat?.id ?? nextFallbackChat?.id ?? null;
      isBootstrappingChatRef.current = false;
      preferredActiveChatIdRef.current = nextActiveChatId;
      pendingActiveChatIdRef.current = nextActiveChatId;
      forcedActiveChatIdRef.current = nextActiveChatId;
      setActiveChatId(nextActiveChatId);
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

  const getUsageLimitMessage = async (res: Response) => {
    try {
      const text = (await res.text()).trim();
      if (text) return text;
    } catch {}

    const tier = res.headers.get("X-OpenLura-Usage-Tier") || "free";

    return tier === "free"
      ? "Je hebt je maandelijkse limiet bereikt voor je persoonlijke AI. Upgrade je plan om verder te chatten."
      : "Je huidige gebruikslimiet is bereikt. Controleer je plan of verhoog je limiet.";
  };

  const getStoredFeedback = () => {
    try {
      return JSON.parse(
        localStorage.getItem(
          isPersonalRoute ? "openlura_personal_feedback" : "openlura_feedback"
        ) || "[]"
      );
    } catch (error) {
      console.error("OpenLura feedback parse failed:", error);
      return [];
    }
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
      localStorage.setItem(memoryStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const classifyLearningSignal = (text: string) => {
    const normalized = (text || "").toLowerCase();

    const isStyleSignal = /korter|te lang|shorter|too long|duidelijker|onduidelijk|clearer|unclear|structuur|structure|te vaag|vaag|vague|meer context|more context|more depth|te serieus|te formeel|menselijker|spontaner|luchtiger|more natural|too formal|too long for chat/.test(
      normalized
    );

    return isStyleSignal ? "style" : "content";
  };

  const isPersonalEnvironment = isPersonalRoute;

  const getPersonalEnvironmentInsights = () => {
    if (!activeChatId) {
      return {
        memoryCount: 0,
        improvementCount: 0,
        negativeCount: 0,
        positiveCount: 0,
        styleSignals: [] as string[],
        contentSignals: [] as string[],
      };
    }

    const rawFeedback = getStoredFeedback();
    const personalFeedback = rawFeedback.filter(
      (f: any) =>
        f.chatId === activeChatId ||
        f.environment === "personal" ||
        f.source === "personal_environment"
    );

    const combinedText = personalFeedback
      .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
      .join(" ");

    const styleSignals = [
      (combinedText.includes("korter") || combinedText.includes("te lang")) && "korter antwoorden",
      (combinedText.includes("duidelijker") || combinedText.includes("onduidelijk")) && "duidelijkere uitleg",
      (combinedText.includes("structuur") || combinedText.includes("structure")) && "betere structuur",
      (combinedText.includes("te vaag") || combinedText.includes("vaag")) && "concreter antwoorden",
      (combinedText.includes("meer context") || combinedText.includes("more context")) && "meer context geven",
    ].filter(Boolean) as string[];

    const contentSignals = [
      memory.some((m) => m.weight > 0.6) && "persoonlijke memory actief",
      personalFeedback.some((f: any) => f.type === "up") && "positieve antwoordpatronen aanwezig",
      personalFeedback.some((f: any) => f.type === "improve") && "verbeterfeedback aanwezig",
    ].filter(Boolean) as string[];

    return {
      memoryCount: memory.filter((m) => m.weight > 0.6).length,
      improvementCount: personalFeedback.filter((f: any) => f.type === "improve").length,
      negativeCount: personalFeedback.filter((f: any) => f.type === "down").length,
      positiveCount: personalFeedback.filter((f: any) => f.type === "up").length,
      styleSignals: styleSignals.slice(0, 4),
      contentSignals: contentSignals.slice(0, 3),
    };
  };

            const stopStreaming = () => {
    if (streamController) {
      streamController.abort();
      setStreamController(null);
    }
    setLoading(false);
    setLoadingStage("idle");
  };

  const handlePersonalLogin = async () => {
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true),
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setLoginError(data?.error || "Inloggen mislukt");
        return;
      }

      setShowLoginBox(false);
      setLoginUsername("");
      setLoginPassword("");
      window.location.href = "/persoonlijke-omgeving";
    } catch {
      setLoginError("Inloggen mislukt");
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePersonalLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "DELETE",
        headers: getOpenLuraRequestHeaders(false),
      });
    } catch (error) {
      console.error("OpenLura logout failed:", error);
    } finally {
      window.location.href = "/";
    }
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

  const isRefinementInstruction = (text: string) => {
    const normalized = text.toLowerCase().trim();

    return /^(en )?(nu )?(nog )?(korter|kort|duidelijker|simpeler|meer concreet|concreter|anders|opnieuw maar korter|maak korter|maak het korter|korter graag|duidelijker graag|simpel(er)? graag|meer context|minder tekst)([.!?])?$/.test(
      normalized
    );
  };

  const resolveFeedbackTargetContext = (messages: any[], aiMsgIndex: number) => {
    const targetAiMessage = messages[aiMsgIndex];
    let userIndex = aiMsgIndex - 1;

    while (userIndex >= 0 && messages[userIndex]?.role !== "user") {
      userIndex -= 1;
    }

    const directUserMessage =
      userIndex >= 0 ? String(messages[userIndex]?.content || "") : "";

    if (!directUserMessage || !isRefinementInstruction(directUserMessage)) {
      return {
        originalUserMessage: directUserMessage,
        originalAiMessage: String(targetAiMessage?.content || ""),
        targetMsgIndex: aiMsgIndex,
      };
    }

    let rootUserIndex = userIndex - 1;
    while (rootUserIndex >= 0) {
      const candidate = messages[rootUserIndex];

      if (
        candidate?.role === "user" &&
        !isRefinementInstruction(String(candidate.content || ""))
      ) {
        break;
      }

      rootUserIndex -= 1;
    }

    let rootAiIndex = userIndex - 1;
    while (rootAiIndex >= 0) {
      const candidate = messages[rootAiIndex];

      if (
        candidate?.role === "ai" &&
        !candidate.disableFeedback &&
        candidate.content !== "🤖 Wat kan ik beter doen?"
      ) {
        break;
      }

      rootAiIndex -= 1;
    }

    return {
      originalUserMessage:
        rootUserIndex >= 0 ? String(messages[rootUserIndex]?.content || "") : directUserMessage,
      originalAiMessage:
        rootAiIndex >= 0
          ? String(messages[rootAiIndex]?.content || "")
          : String(targetAiMessage?.content || ""),
      targetMsgIndex: rootAiIndex >= 0 ? rootAiIndex : aiMsgIndex,
    };
  };

  const resolveRefinementRequestContext = (messages: any[]) => {
    let lastAiIndex = messages.length - 1;

    while (lastAiIndex >= 0) {
      const candidate = messages[lastAiIndex];

      if (
        candidate?.role === "ai" &&
        !candidate.disableFeedback &&
        candidate.content !== "🤖 Wat kan ik beter doen?"
      ) {
        break;
      }

      lastAiIndex -= 1;
    }

    if (lastAiIndex < 0) {
      return null;
    }

    return resolveFeedbackTargetContext(messages, lastAiIndex);
  };

  const sendMessage = async () => {
    if (!input.trim() && !image) return;

    try {

    const currentChatId = activeChatId!;
    const pendingImprovement = awaitingImprovement[currentChatId];
    const isImprovementReply = !!pendingImprovement && !!input.trim();

        if (isImprovementReply) {
      let updated = [...chats];
      const index = updated.findIndex((c) => c.id === currentChatId);
      const retryRequest = isRetryInstruction(input);

      if (index === -1) {
        setLoading(false);
        setLoadingStage("idle");
        return;
      }

      updated[index].messages.push({
        role: "user",
        content: input,
      });

      const originalUserMessage =
        pendingImprovement?.originalUserMessage || "";

      const originalAiMessage =
        pendingImprovement?.originalAiMessage || "";

      if (!retryRequest) {
        const localFeedbackKey = isPersonalRoute
          ? "openlura_personal_feedback"
          : "openlura_feedback";
        const existingFeedback = JSON.parse(localStorage.getItem(localFeedbackKey) || "[]");

        existingFeedback.push({
          chatId: currentChatId,
          msgIndex: pendingImprovement?.targetMsgIndex ?? updated[index].messages.length - 1,
          type: "improve",
          message: input,
          userMessage: originalUserMessage || "Direct improvement feedback",
          timestamp: Date.now(),
          source: "improvement_reply",
          learningType: classifyLearningSignal(input),
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
            headers: getOpenLuraRequestHeaders(true),
            body: JSON.stringify({
              chatId: currentChatId,
              msgIndex: pendingImprovement?.targetMsgIndex ?? null,
              type: "improve",
              message: input,
              userMessage: originalUserMessage || "Direct improvement feedback",
              source: "improvement_reply",
              learningType: classifyLearningSignal(input),
              environment: isPersonalRoute ? "personal" : "default",
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
        [currentChatId]: null,
      }));

      setLoading(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      let improveRes: Response;

      try {
        improveRes = await fetch("/api/chat", {
          method: "POST",
          headers: getOpenLuraRequestHeaders(true),
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
      } catch (error) {
        console.error("OpenLura improvement request failed:", error);
        updated[index].messages.push({
          role: "ai",
          content: "OpenLura kon de verbeterde versie nu niet ophalen. Probeer het opnieuw.",
        });
        setChats([...updated]);
        setStreamController(null);
        setLoading(false);
        setLoadingStage("idle");
        return;
      }

      if (improveRes.status === 429) {
        const limitMessage = await getUsageLimitMessage(improveRes);
        const usageTier = improveRes.headers.get("X-OpenLura-Usage-Tier") || "free";

        setUpgradeNotice({
          visible: true,
          message: limitMessage,
          tier: usageTier,
        });

        updated[index].messages.push({
          role: "ai",
          content: limitMessage,
          disableFeedback: true,
        });
        setChats([...updated]);
        setStreamController(null);
        setLoading(false);
        setLoadingStage("idle");
        return;
      }

      if (!improveRes.ok || !improveRes.body) {
        updated[index].messages.push({
          role: "ai",
          content: "OpenLura kon de verbeterde versie nu niet ophalen. Probeer het opnieuw.",
        });
        setChats([...updated]);
        setStreamController(null);
        setLoading(false);
        setLoadingStage("idle");
        return;
      }

                  const improveReader = improveRes.body.getReader();
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
        content: "…",
        variant: improveVariant,
        sources: improveSources,
        isStreaming: true,
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
          ].content = improvedText || "…";

          setChats([...updated]);
        }
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("OpenLura improve stream failed:", error);
        }
      }

      if (!improvedText.trim()) {
        updated[index].messages[
          updated[index].messages.length - 1
        ] = {
          ...updated[index].messages[updated[index].messages.length - 1],
          content: "OpenLura kon de verbeterde versie nu niet genereren. Probeer het opnieuw.",
          isStreaming: false,
        };

        setChats([...updated]);
      }

            setStreamController(null);
      setLoading(false);
      setLoadingStage("idle");

      return;
    }
        if (!input && !image) return;

    if (upgradeNotice.visible) {
      setUpgradeNotice({
        visible: false,
        message: "",
        tier: "",
      });
    }

    let updated = [...chats];
    let index = updated.findIndex((c) => c.id === activeChatId);

    if (index === -1) {
      const fallbackChat = buildFallbackChat({
        title: isPersonalRoute ? "Persoonlijke chat" : "New Chat",
        messages: [],
      });

      updated = [fallbackChat, ...updated];
      index = 0;
      setChats(updated);
      pendingActiveChatIdRef.current = fallbackChat.id;
      preferredActiveChatIdRef.current = fallbackChat.id;
      forcedActiveChatIdRef.current = fallbackChat.id;
      setActiveChatId(fallbackChat.id);
    }

    const rawInputToSend = input;
    const imageToSend = image;
    const refinementContext =
      !imageToSend && isRefinementInstruction(rawInputToSend)
        ? resolveRefinementRequestContext(updated[index]?.messages || [])
        : null;

    const inputToSend = refinementContext
      ? `De gebruiker wil dat je je vorige antwoord verfijnt, niet dat je een nieuwe vraag beantwoordt.

Oorspronkelijke vraag:
${refinementContext.originalUserMessage}

Je meest recente relevante antwoord:
${refinementContext.originalAiMessage}

Nieuwe instructie van de gebruiker:
${rawInputToSend}

Voer deze instructie direct uit op je vorige antwoord.

BELANGRIJK:
- Behoud exact hetzelfde onderwerp
- Stel geen wedervraag zoals "wat wil je korter hebben?"
- Doe de aanpassing direct
- Als de instructie "nog korter" of "korter" is: maak de bestaande versie duidelijk compacter
- Als de instructie "duidelijker" of "simpeler" is: herschrijf hetzelfde antwoord helderder
- Verander niet van onderwerp
- Geef alleen het aangepaste antwoord`
      : rawInputToSend;

    updated[index].messages.push({
      role: "user",
      content: rawInputToSend,
      image: imageToSend,
    });

    // ✅ AUTO TITLE
    if (updated[index].messages.length === 1) {
      if (rawInputToSend.trim()) {
        updated[index].title = rawInputToSend.trim().slice(0, 30);
      } else if (imageToSend) {
        updated[index].title = "Afbeelding";
      }
    }

    setChats(updated);
    setInput("");
    setImage(null);
    setLoading(true);
setLoadingStage(imageToSend ? "analyzing" : "typing");

// instant visual feedback (feels faster)
updated[index].messages.push({
  role: "ai",
  content: "…",
  isStreaming: true,
});

setChats([...updated]);

    if (imageToSend) {
            setTimeout(() => {
        setLoadingStage((current) => (current === "analyzing" ? "typing" : current));
      }, 700);
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const rawFeedback = JSON.parse(
      localStorage.getItem(
        isPersonalRoute ? "openlura_personal_feedback" : "openlura_feedback"
      ) || "[]"
    ).slice(-20);

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

    const resolvedMemoryText = memory
      .filter((m) => m.weight > 0.6)
      .map((m) => m.text)
      .join(" | ");

    const res = await fetch("/api/chat", {
      method: "POST",
      signal: controller.signal,
      headers: getOpenLuraRequestHeaders(true),
      body: JSON.stringify({
        message: inputToSend,
        image: imageToSend,
        memory: resolvedMemoryText,
        personalMemory: isPersonalRoute ? resolvedMemoryText : "",
        feedback: feedbackSummary,
        recentMessages: (updated[index]?.messages || [])
          .filter(
            (msg: any) =>
              msg &&
              (msg.role === "user" || msg.role === "ai") &&
              !msg.disableFeedback &&
              typeof msg.content === "string" &&
              msg.content.trim() &&
              msg.content !== "Thinking..." &&
              msg.content !== "Analyzing image..." &&
              msg.content !== "🤖 Wat kan ik beter doen?"
          )
          .slice(-6)
          .map((msg: any) => ({
            role: msg.role,
            content: msg.content,
          })),
      }),
    });

    if (res.status === 429) {
      const limitMessage = await getUsageLimitMessage(res);
      const usageTier = res.headers.get("X-OpenLura-Usage-Tier") || "free";

      setUpgradeNotice({
        visible: true,
        message: limitMessage,
        tier: usageTier,
      });

      updated[index].messages[
        updated[index].messages.length - 1
      ] = {
        ...updated[index].messages[
          updated[index].messages.length - 1
        ],
        content: limitMessage,
        isStreaming: false,
        disableFeedback: true,
      };

      setChats([...updated]);
      setStreamController(null);
      setLoading(false);
      setLoadingStage("idle");
      return;
    }

    if (!res.ok || !res.body) {
      updated[index].messages[
        updated[index].messages.length - 1
      ] = {
        ...updated[index].messages[
          updated[index].messages.length - 1
        ],
        content: "OpenLura kon nu geen antwoord ophalen. Probeer het opnieuw.",
        isStreaming: false,
      };
      setChats([...updated]);
      setStreamController(null);
      setLoading(false);
      setLoadingStage("idle");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const usageUsed = Number(res.headers.get("X-OpenLura-Usage-Used") || 0);
    const usageLimit = Number(res.headers.get("X-OpenLura-Usage-Limit") || 0);

    if (usageLimit > 0) {
      const percentage = usageUsed / usageLimit;

      setUsage({
        used: usageUsed,
        limit: usageLimit,
        percentage,
      });
    }

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

    // placeholder already added above → only attach metadata
updated[index].messages[
  updated[index].messages.length - 1
] = {
  ...updated[index].messages[
    updated[index].messages.length - 1
  ],
  variant: responseVariant,
  sources: responseSources,
};
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
        ] = {
          ...updated[index].messages[updated[index].messages.length - 1],
          content: aiText || "…",
          isStreaming: !aiText.trim(),
        };

        setChats([...updated]);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("OpenLura chat stream failed:", error);
      }
    }

    if (!aiText.trim()) {
      updated[index].messages[
        updated[index].messages.length - 1
      ] = {
        ...updated[index].messages[updated[index].messages.length - 1],
        content: "OpenLura kon nu geen antwoord genereren. Probeer het opnieuw.",
        isStreaming: false,
      };

      setChats([...updated]);
    }

    setStreamController(null);
    setLoadingStage("idle");

    // ✅ MEMORY SAVE
    if (rawInputToSend.length < 60 && !isRefinementInstruction(rawInputToSend)) {
      const existing = memory.find((m) => m.text === rawInputToSend);

      let newMemory;

      if (existing) {
        newMemory = memory.map((m) =>
          m.text === rawInputToSend
            ? { ...m, weight: Math.min(m.weight + 0.2, 1) }
            : m
        );
      } else {
        newMemory = [...memory, { text: rawInputToSend, weight: 0.5 }];
      }

      newMemory = newMemory
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 10);

      setMemory(newMemory);

      if (initialStateReady) {
        localStorage.setItem(memoryStorageKey, JSON.stringify(newMemory));
      }
    }

    setLoading(false);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("OpenLura sendMessage failed:", error);
      }
    } finally {
      setStreamController(null);
      setLoading(false);
      setLoadingStage("idle");
    }
  };
  const handleFeedback = async (chatId: number, msgIndex: number, type: string) => {
console.log("FEEDBACK CLICKED", { chatId, msgIndex, type });
  const key = isPersonalRoute
    ? "openlura_personal_feedback"
    : "openlura_feedback";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");

  const chat = chats.find(c => c.id === chatId);
  const message = chat?.messages[msgIndex];
  const resolvedTarget = resolveFeedbackTargetContext(chat?.messages || [], msgIndex);
  const prevMessage = {
    content: resolvedTarget.originalUserMessage,
  };

    existing.push({
    chatId,
    msgIndex,
    type,
    message: message?.content,
    userMessage: prevMessage?.content,
    source: message?.variant ? `ab_test_${message.variant}` : null,
    timestamp: Date.now(),
    learningType:
      type === "down"
        ? classifyLearningSignal(`${prevMessage?.content || ""} ${message?.content || ""}`)
        : "content",
  });

    localStorage.setItem(key, JSON.stringify(existing));

  if (prevMessage?.content) {
    updateMemoryWeight(prevMessage.content, type === "up" ? 0.2 : -0.2);
  }

      try {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: getOpenLuraRequestHeaders(true),
        body: JSON.stringify({
      chatId,
      msgIndex,
      type,
      message: message?.content,
      userMessage: prevMessage?.content,
      source: message?.variant ? `ab_test_${message.variant}` : null,
      learningType:
        type === "down"
          ? classifyLearningSignal(`${prevMessage?.content || ""} ${message?.content || ""}`)
          : "content",
      environment: isPersonalRoute ? "personal" : "default",
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
    const targetMessages = updatedChats[chatIndex]?.messages || [];

    const resolvedTarget = resolveFeedbackTargetContext(targetMessages, msgIndex);

    updatedChats[chatIndex].messages.push({
      role: "ai",
      content: "🤖 Wat kan ik beter doen?",
      disableFeedback: true,
    });

    setChats(updatedChats);

    setAwaitingImprovement(prev => ({
      ...prev,
      [chatId]: {
        targetMsgIndex: resolvedTarget.targetMsgIndex,
        originalUserMessage: resolvedTarget.originalUserMessage,
        originalAiMessage: resolvedTarget.originalAiMessage,
      }
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
    source: isPersonalEnvironment ? "personal_environment" : `idea_${feedbackCategory}`,
    category: feedbackCategory,
    chatId: activeChatId,
    environment: isPersonalEnvironment ? "personal" : "default",
    timestamp: Date.now(),
  };

  existing.push(ideaEntry);

  localStorage.setItem(key, JSON.stringify(existing));

    fetch("/api/feedback", {
      method: "POST",
      headers: getOpenLuraRequestHeaders(true),
      body: JSON.stringify({
        chatId: activeChatId,
        type: "idea",
        message: feedbackText.trim(),
        userMessage: isPersonalEnvironment ? "Persoonlijke omgeving feedback" : "Feedback / Idee",
        source: isPersonalEnvironment ? "personal_environment" : `idea_${feedbackCategory}`,
        environment: isPersonalEnvironment ? "personal" : "default",
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Idea feedback POST failed");
        }
        window.dispatchEvent(new Event("openlura_feedback_update"));
      })
      .catch((error) => {
        console.error("OpenLura idea feedback save failed:", error);
      });

    setFeedbackText("");
  setFeedbackCategory("adjustment");
  setShowFeedbackBox(false);
};

  return (
    <main className="fixed inset-0 flex bg-[#050510] text-white overflow-hidden">
      <button
  onClick={() => setMobileMenu(!mobileMenu)}
  className="fixed left-4 top-4 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/88 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition hover:bg-white/[0.11] md:hidden"
>
  ☰
</button>

<Sidebar
  mobileMenu={mobileMenu}
  setMobileMenu={setMobileMenu}
  createNewChat={createNewChat}
  search={search}
  setSearch={setSearch}
  searchedPinnedChats={searchedPinnedChats}
  regularChats={regularChats}
  archivedChats={archivedChats}
  deletedChats={deletedChats}
  activeChatId={activeChatId}
  activateChat={activateChat}
  openChatMenuId={openChatMenuId}
  setOpenChatMenuId={setOpenChatMenuId}
  togglePinnedChat={togglePinnedChat}
  archiveChat={archiveChat}
  deleteChat={deleteChat}
  restoreArchivedChat={restoreArchivedChat}
  restoreDeletedChat={restoreDeletedChat}
  clearDeletedChats={clearDeletedChats}
  isPersonalRoute={isPersonalRoute}
  setShowFeedbackBox={setShowFeedbackBox}
  setShowLoginBox={setShowLoginBox}
/>

{mobileMenu && (
  <div
    onClick={() => setMobileMenu(false)}
    className="fixed inset-0 z-30 bg-black/50 md:hidden"
  />
)}
                  {showClearDeletedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[340px] rounded-[28px] border border-white/10 bg-[#0a0a1f]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <h2 className="mb-2 text-lg font-semibold text-white/95">Are you sure?</h2>
            <p className="mb-5 text-sm leading-6 text-white/60">
              All deleted chats will be permanently removed.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowClearDeletedConfirm(false)}
                className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.05] p-3 text-white/90 transition hover:bg-white/[0.08]"
              >
                Cancel
              </button>

              <button
                onClick={confirmClearDeletedChats}
                className="flex-1 rounded-[20px] border border-red-400/20 bg-red-500/80 p-3 text-white shadow-[0_10px_24px_rgba(239,68,68,0.28)] transition hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetChatId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[340px] rounded-[28px] border border-white/10 bg-[#0a0a1f]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <h2 className="mb-2 text-lg font-semibold text-white/95">Are you sure?</h2>
            <p className="mb-5 text-sm leading-6 text-white/60">
              This chat will be moved to Deleted chats.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTargetChatId(null)}
                className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.05] p-3 text-white/90 transition hover:bg-white/[0.08]"
              >
                Annuleren
              </button>

              <button
                onClick={confirmDeleteChat}
                className="flex-1 rounded-[20px] border border-red-400/20 bg-red-500/80 p-3 text-white shadow-[0_10px_24px_rgba(239,68,68,0.28)] transition hover:bg-red-500"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

            {showFeedbackBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-[28px] border border-white/10 bg-[#0a0a1f]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <h2 className="mb-4 text-lg font-semibold text-white/95">Feedback / Idea</h2>

            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value)}
              className="mb-3 w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3 text-sm text-white/90 outline-none transition focus:border-white/18 focus:bg-white/[0.07]"
            >
              <option value="bug">Bug</option>
              <option value="adjustment">Adjustment</option>
              <option value="feedback_learning">AI feedback</option>
            </select>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="mb-4 min-h-[120px] w-full rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-3 text-sm text-white/92 outline-none transition placeholder:text-white/28 focus:border-white/18 focus:bg-white/[0.07]"
              placeholder="Tell us what you want to improve or add..."
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowFeedbackBox(false);
                  setFeedbackText("");
                  setFeedbackCategory("adjustment");
                }}
                className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.05] p-3 text-white/90 transition hover:bg-white/[0.08]"
              >
                Cancel
              </button>

              <button
                onClick={handleIdeaSubmit}
                disabled={!feedbackText.trim()}
                className={`flex-1 rounded-[20px] p-3 transition ${
                  feedbackText.trim()
                    ? "bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-[0_10px_24px_rgba(59,130,246,0.28)] hover:brightness-110"
                    : "bg-white/10 text-white/30"
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex items-stretch justify-center xl:justify-start md:p-4 pt-0">
        <div className="flex h-full w-full min-w-0 max-w-2xl xl:max-w-[920px] xl:ml-6 flex-col border border-white/10 bg-white/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:h-[90%] md:rounded-[32px]">

          {usage && usage.percentage >= 0.8 && !upgradeNotice.visible && (
            <div className="mx-4 mt-4 rounded-[24px] border border-yellow-300/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl">
              <div className="font-medium">
                Near usage limit
              </div>
              <div className="mt-1 opacity-90">
                {Math.round(usage.percentage * 100)}% gebruikt ({usage.used}/{usage.limit})
              </div>
            </div>
          )}

          {upgradeNotice.visible && (
            <div className="mx-4 mt-4 rounded-[24px] border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl">
              <div className="font-medium">
                Limit reached {upgradeNotice.tier ? `(${upgradeNotice.tier})` : ""}
              </div>
              <div className="mt-1 opacity-90">{upgradeNotice.message}</div>
            </div>
          )}

          <div
  ref={messagesRef}
  className={`${messageShellClass} flex-1 overflow-x-hidden overflow-y-auto pb-52 md:pb-5 ${
    activeChat?.messages?.length ? "p-4 pt-20 md:px-5 md:pt-5 space-y-3.5" : "p-4 pt-20 md:px-5 md:pt-5 flex items-center justify-center"
  }`}
>
                        {activeChat?.messages?.length === 0 ? (
              <div className="flex h-full w-full max-w-2xl -mt-20 flex-col items-center justify-center px-6 text-center">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.035] px-8 py-8 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                  <h1 className="mb-3 bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-4xl">
                    What do you want to work on today?
                  </h1>
                  <p className="mx-auto max-w-md text-sm leading-6 text-white/42">
                    Ask a question, upload an image, or continue an earlier chat.
                  </p>
                </div>
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
                    return (
                      <div
                        key={i}
                        className={`${messageShellClass} animate-[fadeInUp_0.22s_ease-out] transition-[opacity,transform] duration-200 ${
                          msg.role === "user" ? "mb-2" : "mb-4"
                        }`}
                      >
                                                <div
                          className={`${messageBubbleClass} min-w-0 max-w-[78%] overflow-hidden whitespace-pre-line rounded-[24px] px-4 py-3.5 transition-[box-shadow,transform,background-color,border-color] duration-200 ${
                            msg.role === "user"
                              ? "ml-auto bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white shadow-[0_10px_28px_rgba(37,99,235,0.24)]"
                              : "border border-white/10 bg-white/[0.06] text-white/92 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
                          }`}
                        >
                          {msg.image && (
                            <img
                              src={msg.image}
                              alt="Uploaded"
                              className="block w-full max-w-[240px] max-h-[260px] object-cover rounded-2xl border border-white/10"
                            />
                          )}

                          {msg.content ? (
  <div
    className={`${msg.image ? "mt-3 " : ""}${messageBubbleClass} min-w-0 max-w-full overflow-hidden`}
  >
    {msg.isStreaming && msg.content === "…" ? (
      <span className="inline-flex items-center gap-2 text-white/55">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/55" />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/45"
            style={{ animationDelay: "120ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35"
            style={{ animationDelay: "240ms" }}
          />
        </span>
        <span className="text-sm">OpenLura denkt na</span>
      </span>
    ) : (
      <>
        {msg.content.split(/(\s+)/).map((part: string, idx: number) => {
          const isUrl = /^https?:\/\/\S+$/i.test(part);

          if (isUrl) {
            return (
              <a
                key={idx}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="inline break-all max-w-full text-blue-300 underline"
                style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {part}
              </a>
            );
          }

          return (
            <span
              key={idx}
              className="break-words"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {part}
            </span>
          );
        })}

        {msg.isStreaming && msg.content !== "…" && (
          <span
            className="ml-0.5 inline-block h-5 w-[2px] translate-y-[3px] rounded-full bg-white/60 align-bottom animate-pulse"
            aria-hidden="true"
          />
        )}
      </>
    )}
  </div>
) : null}
                        </div>

                        {msg.role === "ai" &&
                          i !== 0 &&
                          !msg.disableFeedback &&
                          msg.content !== "🤖 Wat kan ik beter doen?" &&
                          msg.content !== "🤖 Bedankt voor je feedback. Ik sla dit op en gebruik het om toekomstige antwoorden te verbeteren." && (
                            <>
                              <div className="mt-3 flex flex-wrap items-center gap-2 pl-1">
                                {!feedbackGiven[activeChatId + "-" + i] && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleFeedback(activeChatId!, i, "up")}
                                      aria-label="Good answer"
                                      title="Good answer"
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#3b82f6]/30 bg-white/[0.035] text-white/72 transition hover:border-[#3b82f6]/55 hover:bg-[#3b82f6]/10 hover:text-white"
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        className="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.9"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M7 11v9" />
                                        <path d="M14 5.5 13 11h5.2a2 2 0 0 1 2 2.4l-1.1 5.5A2 2 0 0 1 17.1 20H7a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 .6-1.4l5.7-5.6a1.5 1.5 0 0 1 2.7 1.3Z" />
                                      </svg>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleFeedback(activeChatId!, i, "down")}
                                      aria-label="Needs improvement"
                                      title="Needs improvement"
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#3b82f6]/30 bg-white/[0.035] text-white/72 transition hover:border-[#3b82f6]/55 hover:bg-[#3b82f6]/10 hover:text-white"
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        className="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.9"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M17 13V4" />
                                        <path d="m10 18.5 1-5.5H5.8a2 2 0 0 1-2-2.4l1.1-5.5A2 2 0 0 1 6.9 4H17a2 2 0 0 1 2 2v5.5a2 2 0 0 1-.6 1.4l-5.7 5.6a1.5 1.5 0 0 1-2.7-1.3Z" />
                                      </svg>
                                    </button>
                                  </>
                                )}

                                {feedbackUI[activeChatId + "-" + i] && (
                                  <span className="rounded-full border border-[#3b82f6]/25 bg-[#3b82f6]/10 px-3 py-2 text-xs text-white/72">
                                    {feedbackUI[activeChatId + "-" + i]}
                                  </span>
                                )}
                              </div>

                {Array.isArray(msg.sources) && msg.sources.length > 0 && (
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[12px] text-white/36">🔎</span>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Sources
              </p>
            </div>

            <div className="space-y-2.5">
              {msg.sources.map((source: any, sourceIndex: number) => {
                let domain = "";

                try {
                  domain = new URL(source.url).hostname.replace(/^www\./, "");
                } catch {
                  domain = source.url || "";
                }

                const title = source.title || "View source";

                return (
                  <a
                    key={source.url || sourceIndex}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.045] p-3.5 shadow-[0_8px_20px_rgba(0,0,0,0.10)] transition-all hover:border-white/16 hover:bg-white/[0.075]"
                    title={source.title || source.url}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm leading-6 text-white/92 break-words"
                          style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                        >
                          {title}
                        </p>
                        <p
                          className="mt-1 text-xs text-white/42 break-all max-w-full overflow-hidden"
                          style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                        >
                          {domain}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white/48">
                        Visit
                      </span>
                    </div>
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

                                {loading && null}
              </>
            )}
          </div>

                                        <div
  className={`${
    activeChat?.messages?.length === 0
      ? "mt-6 w-full max-w-2xl"
      : composerShellClass + " fixed bottom-0 left-0 right-0 md:static z-[90] p-3 pb-4 md:border-0 bg-[#050510] md:bg-transparent"
  } flex w-full min-w-0 max-w-full overflow-x-hidden items-end gap-2 rounded-[32px] border border-white/10 bg-white/[0.055] px-3 py-3 shadow-[0_20px_56px_rgba(0,0,0,0.26)] backdrop-blur-2xl`}
>

                        <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.05] text-lg text-white/80 transition-colors hover:bg-white/[0.10]"
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
                  className="h-16 w-16 rounded-2xl border border-white/10 object-cover shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/70 text-xs"
                >
                  ×
                </button>
              </div>
            )}

                        <textarea
  ref={inputRef}
  value={input}
  onFocus={() => {
    if (window.innerWidth < 768) {
      setMobileMenu(false);
    }
  }}
  onChange={(e) => {
    setInput(e.target.value);
  }}
  onKeyDown={(e) => {
    const nativeEvent = e.nativeEvent as KeyboardEvent & {
      isComposing?: boolean;
    };

    if (nativeEvent.isComposing) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (loading) {
        return;
      }

      sendMessage();
    }
  }}
  className={`${composerInputClass} flex-1 rounded-2xl bg-transparent px-2 py-3 text-[15px] leading-6 text-white/95 outline-none placeholder:text-white/32 min-h-[52px] max-h-[140px]`}
  placeholder={activeChat?.messages?.length === 0 ? "Ask anything" : "Message OpenLura..."}
  rows={1}
/>

                           <button
  type="button"
  disabled={!loading && !input.trim() && !image}
  onClick={loading ? stopStreaming : sendMessage}
  className={`flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-full text-xl transition-all active:scale-95 ${
    loading
      ? "bg-red-500 text-white shadow-[0_8px_24px_rgba(239,68,68,0.35)]"
      : !input.trim() && !image
      ? "bg-white/[0.08] text-white/28 shadow-none"
      : "bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-[0_12px_28px_rgba(59,130,246,0.34)] hover:brightness-110"
  }`}
>
  {loading ? "■" : "↑"}
</button>
          </div>

        </div>
      </div>

      {isPersonalEnvironment && (
        <aside className="hidden xl:flex w-[320px] p-4 pr-5">
          <div className="flex h-full w-full flex-col rounded-[32px] border border-white/10 bg-white/[0.055] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:h-[90%]">
            <div className="mb-5 rounded-[28px] border border-white/8 bg-white/[0.035] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                Personal environment
              </p>
              <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-white/95">
                Training dashboard
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/56">
                Only visible in this environment on desktop.
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Memory</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white/95">
                  {getPersonalEnvironmentInsights().memoryCount}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Verbeteringen</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white/95">
                  {getPersonalEnvironmentInsights().improvementCount}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Negatief</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white/95">
                  {getPersonalEnvironmentInsights().negativeCount}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Positief</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white/95">
                  {getPersonalEnvironmentInsights().positiveCount}
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-[28px] border border-white/8 bg-white/[0.035] px-4 py-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-white/38">
                Actieve stijlpunten
              </p>
              {getPersonalEnvironmentInsights().styleSignals.length === 0 ? (
                <p className="text-sm leading-6 text-white/50">Nog geen duidelijke stijl-signalen</p>
              ) : (
                <div className="space-y-2 text-sm text-white/78">
                  {getPersonalEnvironmentInsights().styleSignals.map((item, idx) => (
                    <p key={idx}>• {item}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4 rounded-[28px] border border-white/8 bg-white/[0.035] px-4 py-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-white/38">
                Persoonlijke AI status
              </p>
              {getPersonalEnvironmentInsights().contentSignals.length === 0 ? (
                <p className="text-sm leading-6 text-white/50">Nog geen persoonlijke content-signalen</p>
              ) : (
                <div className="space-y-2 text-sm text-white/78">
                  {getPersonalEnvironmentInsights().contentSignals.map((item, idx) => (
                    <p key={idx}>• {item}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-auto space-y-2.5">
              <button
                onClick={() => setShowFeedbackBox(true)}
                className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] p-3 text-left text-white/90 backdrop-blur-xl transition hover:bg-white/[0.08]"
              >
                Add personal improvement note
              </button>

              <button
                onClick={() => {
                  window.open("/analytics", "_blank", "noopener,noreferrer");
                }}
                className="w-full rounded-[24px] border border-white/10 bg-white/[0.05] p-3 text-left text-white/90 backdrop-blur-xl transition hover:bg-white/[0.08]"
              >
                Open analytics
              </button>

              <button
                onClick={handlePersonalLogout}
                className="w-full rounded-[24px] border border-red-400/20 bg-red-500/16 p-3 text-left text-red-200 transition hover:bg-red-500/24"
              >
                Log out
              </button>
            </div>
          </div>
        </aside>
      )}

      {showLoginBox && !isPersonalRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#0b1020]/95 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
            <div className="mb-5 rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                Secure access
              </p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white/95">
                Log in
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/56">
                Sign in to open your personal environment.
              </p>
            </div>

            <div className="space-y-3">
              <input
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Username"
                className="w-full rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white/95 outline-none transition placeholder:text-white/30 focus:border-white/18 focus:bg-white/[0.07]"
              />

              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white/95 outline-none transition placeholder:text-white/30 focus:border-white/18 focus:bg-white/[0.07]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loginLoading) {
                    handlePersonalLogin();
                  }
                }}
              />

              {loginError && (
                <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {loginError}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setShowLoginBox(false);
                  setLoginError("");
                  setLoginUsername("");
                  setLoginPassword("");
                }}
                className="flex-1 rounded-[22px] border border-white/10 bg-white/[0.05] p-3 text-white/90 backdrop-blur-xl transition hover:bg-white/[0.08]"
              >
                Annuleren
              </button>

              <button
                onClick={handlePersonalLogin}
                disabled={loginLoading}
                className="flex-1 rounded-[22px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] p-3 text-white shadow-[0_12px_30px_rgba(59,130,246,0.28)] transition hover:brightness-110 disabled:opacity-60"
              >
                {loginLoading ? "Inloggen..." : "Log in"}
              </button>
            </div>
          </div>
        </div>
      )}
    <style jsx global>{`
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `}</style>
    </main>
  );
}