"use client";
import Sidebar from "@/components/chat/Sidebar";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const PERSONAL_ENV_WELCOME_MESSAGE =
  "👋 Welkom in je persoonlijke omgeving. Hier testen we privé memory, verbeterpunten en training van jouw AI-gedrag.";

export default function ChatPage() {
  const pathname = usePathname();
  const isPersonalRoute = pathname === "/persoonlijke-omgeving";
  const [userScopedStorageId, setUserScopedStorageId] = useState("");

  const makeUserBoundStorageKey = (baseKey: string) =>
    isPersonalRoute || !userScopedStorageId
      ? baseKey
      : `${baseKey}__${userScopedStorageId}`;

  const chatStorageKey = isPersonalRoute
    ? "openlura_personal_chats"
    : makeUserBoundStorageKey("openlura_chats");
  const memoryStorageKey = isPersonalRoute
    ? "openlura_personal_memory"
    : makeUserBoundStorageKey("openlura_memory");
  const [personalStateLoaded, setPersonalStateLoaded] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
const [workflowPrefill, setWorkflowPrefill] = useState<{
  value: string;
  source: "prompt" | "result" | "message";
  label: string;
} | null>(null);

const clearWorkflowPrefill = () => {
  setWorkflowPrefill(null);
};

const applyComposerInput = (
  nextContent: string,
  options?: {
    source?: "prompt" | "result" | "message";
    label?: string;
    mode?: "replace" | "append";
  }
) => {
  const nextValue = String(nextContent || "").trim();

  if (!nextValue) return;

  const mode = options?.mode || "replace";

  setInput((prev) => {
    const previousValue = String(prev || "").trim();
    const resolvedValue =
      mode === "append" && previousValue
        ? `${previousValue}\n\n${nextValue}`
        : nextValue;

    requestAnimationFrame(() => {
      resizeComposerTextarea();
      inputRef.current?.focus();

      try {
        inputRef.current?.setSelectionRange(
          resolvedValue.length,
          resolvedValue.length
        );
      } catch {}
    });

    return resolvedValue;
  });

  setWorkflowPrefill({
    value: nextValue,
    source: options?.source || "message",
    label:
      options?.label ||
      (options?.source === "prompt"
        ? "Prompt ready"
        : options?.source === "result"
        ? "Result ready"
        : "Input ready"),
  });

  setImage(null);

  if (savePromptSuccess) {
    setSavePromptSuccess(false);
  }

  if (savePromptError) {
    setSavePromptError("");
  }
};

const handleUseAsInput = (content: string) => {
  applyComposerInput(content, {
    source: "message",
    label: "Input ready",
    mode: "replace",
  });
};

// =============================
// EXPORT HELPERS
// =============================

const getActiveChat = () => {
  return chats.find((c) => c.id === activeChatId) || null;
};

const buildMarkdownExport = (chat: any) => {
  if (!chat) return "";

  const title = String(chat.title || "Chat").trim() || "Chat";
  const exportableMessages = (chat.messages || []).filter((msg: any) => {
    const content = String(msg?.content || "").trim();

    if (!msg) return false;
    if (msg.disableFeedback && content === "🤖 What can I improve?") return false;
    if (content === "🤖 Thanks for your feedback. I’ll use this to improve future answers.") {
      return false;
    }
    if (msg.isStreaming && content === "…") return false;
    if (!content && !msg.image) return false;

    return true;
  });

  const lines: string[] = [`# ${title}`, ""];

  for (const msg of exportableMessages) {
    if (msg.role === "user") {
      lines.push("## You");
    } else if (msg.role === "ai") {
      lines.push("## OpenLura");
    } else {
      lines.push("## Message");
    }

    if (msg.image) {
      lines.push("_[Image attached]_");
    }

    const content = String(msg.content || "").trim();
    if (content) {
      lines.push(content);
    }

    lines.push("");
  }

  return lines.join("\n").trim();
};

const copyChatToClipboard = async () => {
  const chat = getActiveChat();
  if (!chat) return;

  const markdown = buildMarkdownExport(chat);
  if (!markdown.trim()) return;

  try {
    await navigator.clipboard.writeText(markdown);
    setFeedbackUI((prev) => ({
      ...prev,
      __chat_export__: "Chat copied",
    }));

    window.setTimeout(() => {
      setFeedbackUI((prev) => {
        const copy = { ...prev };
        delete copy.__chat_export__;
        return copy;
      });
    }, 1400);
  } catch (error) {
    console.error("OpenLura chat export copy failed:", error);
  }
};

const downloadMarkdown = () => {
  const chat = getActiveChat();
  if (!chat) return;

  const markdown = buildMarkdownExport(chat);
  if (!markdown.trim()) return;

  const fileName = `${String(chat.title || "chat")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "chat"}.md`;

  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
const [savingPrompt, setSavingPrompt] = useState(false);
const [savePromptSuccess, setSavePromptSuccess] = useState(false);
const [savePromptError, setSavePromptError] = useState("");

const getLastUserPrompt = () => {
  const activeChat = chats.find(c => c.id === activeChatId);
  if (!activeChat) return "";

  const reversed = [...(activeChat.messages || [])].reverse();
  const lastUserMsg = reversed.find(m => m.role === "user");

  return lastUserMsg?.content || "";
};

const handleSavePrompt = async (explicitContent?: string) => {
  const content = explicitContent || input || getLastUserPrompt();
  const trimmedContent = String(content || "").trim();

  if (!trimmedContent) {
    setSavePromptError("Nothing to save");
    setSavePromptSuccess(false);
    return;
  }

  try {
    setSavingPrompt(true);
    setSavePromptSuccess(false);
    setSavePromptError("");

    const resolvedUserId = getOrCreateOpenLuraUserId();

    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(resolvedUserId
          ? { "x-openlura-user-id": resolvedUserId }
          : {}),
      },
      credentials: "same-origin",
      body: JSON.stringify({
        name: trimmedContent.slice(0, 60),
        description: "",
        content: trimmedContent,
      }),
    });

    const responseText = await res.text();
    let responseJson: any = null;

    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseJson = null;
    }

    if (!res.ok) {
      const message =
        responseJson?.error ||
        responseJson?.message ||
        responseText ||
        `Save failed (${res.status})`;

      setSavePromptError(String(message).slice(0, 160));
      console.error("OpenLura prompt save failed:", {
        status: res.status,
        body: responseJson || responseText,
        userIdIncluded: !!resolvedUserId,
        contentLength: trimmedContent.length,
      });
      return;
    }

    setSavePromptSuccess(true);
    setSavePromptError("");
    setOpenUserMessageMenuKey(null);

    window.dispatchEvent(new Event("openlura_prompts_refresh"));

    window.setTimeout(() => {
      setSavePromptSuccess(false);
    }, 2000);
  } catch (e) {
    setSavePromptError("Network error");
    console.error("Save prompt failed", e);
  } finally {
    setSavingPrompt(false);
  }
};
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamController, setStreamController] = useState<AbortController | null>(null);
  

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
  const [awaitingImprovement, setAwaitingImprovement] = useState<{
    [key: number]: {
      targetMsgIndex: number;
      originalUserMessage: string;
      originalAiMessage: string;
    } | null;
  }>({});
  const [showLoginBox, setShowLoginBox] = useState(false);
  const [loginTab, setLoginTab] = useState<"login" | "register">("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState<{
  visible: boolean;
  message: string;
  tier: string;
  limitType?: string;
}>({
  visible: false,
  message: "",
  tier: "",
  limitType: "monthly",
});

const ANON_MSG_LIMIT = 3;
const ANON_STORAGE_KEY = "openlura_anon_usage";
const ANON_WINDOW_MS = 5 * 60 * 60 * 1000; // 5 uur

const getAnonUsage = (): { count: number; resetAt: number } => {
  try {
    const raw = localStorage.getItem(ANON_STORAGE_KEY);
    if (!raw) return { count: 0, resetAt: 0 };
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (!parsed.resetAt || parsed.resetAt <= now) {
      return { count: 0, resetAt: 0 };
    }
    return { count: parsed.count || 0, resetAt: parsed.resetAt };
  } catch { return { count: 0, resetAt: 0 }; }
};

const incrementAnonUsage = (): { count: number; resetAt: number } => {
  try {
    const now = Date.now();
    const existing = getAnonUsage();
    const resetAt = existing.resetAt > now ? existing.resetAt : now + ANON_WINDOW_MS;
    const next = { count: existing.count + 1, resetAt };
    localStorage.setItem(ANON_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch { return { count: 0, resetAt: 0 }; }
};

const [usage, setUsage] = useState<{
  used: number;
  limit: number;
  percentage: number;
} | null>(null);

const settingsStorageKey = isPersonalRoute
  ? "openlura_personal_settings"
  : makeUserBoundStorageKey("openlura_settings");

const feedbackStorageKey = isPersonalRoute
  ? "openlura_personal_feedback"
  : makeUserBoundStorageKey("openlura_feedback");

const ideasStorageKey = isPersonalRoute
  ? "openlura_personal_ideas"
  : makeUserBoundStorageKey("openlura_ideas");

const [showSettingsBox, setShowSettingsBox] = useState(false);
const [showDashboard, setShowDashboard] = useState(false);
const [dashboardData, setDashboardData] = useState<{
  usageStats: Record<string, unknown> | null;
} | null>(null);
const [dashboardLoading, setDashboardLoading] = useState(false);
const [settingsPreferences, setSettingsPreferences] = useState<string[]>([]);
const [settingsSaving, setSettingsSaving] = useState(false);
const [settingsSaved, setSettingsSaved] = useState(false);
const [settingsError, setSettingsError] = useState<string | null>(null);
const [settingsNewPref, setSettingsNewPref] = useState("");

// EXPORT UI STATE
const [showExportMenu, setShowExportMenu] = useState(false);

const [chatSettings, setChatSettings] = useState<{
  tone: "default" | "friendly" | "direct" | "professional";
  style: "default" | "concise" | "structured" | "detailed";
  memoryEnabled: boolean;
}>({
  tone: "default",
  style: "default",
  memoryEnabled: true,
});
  
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  
  const preferredActiveChatIdRef = useRef<number | null>(null);
  const pendingActiveChatIdRef = useRef<number | null>(null);
  const forcedActiveChatIdRef = useRef<number | null>(null);
  const isBootstrappingChatRef = useRef(false);
  const personalSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasManualChatSelectionRef = useRef(false);
  const latestChatsRef = useRef<any[]>([]);
  const latestActiveChatIdRef = useRef<number | null>(null);
  const [initialStateReady, setInitialStateReady] = useState(false);
  const [openChatMenuId, setOpenChatMenuId] = useState<number | null>(null);
  const [openUserMessageMenuKey, setOpenUserMessageMenuKey] = useState<string | null>(null);
  const [openAiMessageMenuKey, setOpenAiMessageMenuKey] = useState<string | null>(null);

  const hasBlockingOverlay =
    showFeedbackBox ||
    showClearDeletedConfirm ||
    deleteTargetChatId !== null ||
    showLoginBox ||
    showSettingsBox ||
    showDashboard;

  const closeMobileSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileMenu(false);
    }
  };

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

const isReplaceableStarterChat = (chat: any) => {
  if (!chat || chat.pinned || chat.archived || chat.deleted) return false;

  const title = String(chat.title || "").trim();
  const messages = Array.isArray(chat.messages) ? chat.messages : [];

  if (isPersonalRoute) {
    return (
      title === "Persoonlijke omgeving" &&
      messages.length === 1 &&
      messages[0]?.role === "ai" &&
      messages[0]?.content === PERSONAL_ENV_WELCOME_MESSAGE
    );
  }

  return title === "New Chat" && messages.length === 0;
};

  const activateChat = (chatId: number) => {
  const chatExists = chats.some(
    (c) => c.id === chatId && !c.deleted
  );

  if (!chatExists) return;

  closeMobileSidebar();
  isBootstrappingChatRef.current = false;
  hasManualChatSelectionRef.current = true;
  pendingActiveChatIdRef.current = chatId;
  preferredActiveChatIdRef.current = chatId;
  forcedActiveChatIdRef.current = chatId;

  setActiveChatId(chatId);
  setOpenChatMenuId(null);
  setOpenUserMessageMenuKey(null);
  setOpenAiMessageMenuKey(null);
};

    const createNewChat = (
    preset?: Partial<{
      title: string;
      messages: { role: string; content: string; image?: string | null }[];
    }>
  ) => {
    closeMobileSidebar();
    isBootstrappingChatRef.current = false;

    const baseTitle =
      preset?.title || (isPersonalRoute ? "Persoonlijke chat" : "New Chat");

    const newChatId = Date.now() + Math.floor(Math.random() * 1000);

    hasManualChatSelectionRef.current = true;
    pendingActiveChatIdRef.current = newChatId;
    preferredActiveChatIdRef.current = newChatId;
    forcedActiveChatIdRef.current = newChatId;
    setOpenChatMenuId(null);
    setOpenUserMessageMenuKey(null);
    setOpenAiMessageMenuKey(null);

    setChats((prev) => {
      const replaceableStarterIndex = prev.findIndex((chat: any) =>
        isReplaceableStarterChat(chat)
      );

      const existingTitles = prev
        .filter((_: any, index: number) => index !== replaceableStarterIndex)
        .map((chat: any) => String(chat.title || "").trim());

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

      if (replaceableStarterIndex !== -1) {
        const nextChats = [...prev];
        nextChats[replaceableStarterIndex] = newChat;
        return nextChats;
      }

      return [newChat, ...prev];
    });

    setActiveChatId(newChatId);
  };

  useEffect(() => {
    if (!isPersonalRoute && !userScopedStorageId) {
      return;
    }

    const loadState = async () => {
      try {
        let loadedFromServer = false;

        if (isPersonalRoute) {
          setPersonalStateLoaded(false);
          setChats([]);
          setMemory([]);
          setActiveChatId(null);
          preferredActiveChatIdRef.current = null;
          pendingActiveChatIdRef.current = null;
          forcedActiveChatIdRef.current = null;
        }

        if (isPersonalRoute) {
          try {
            const res = await fetch("/api/personal-state", {
              method: "GET",
              headers: getOpenLuraRequestHeaders(false, {
                personalEnv: true,
                includeUserId: false,
              }),
              cache: "no-store",
              credentials: "same-origin",
            });

            if (res.status === 401) {
              preferredActiveChatIdRef.current = null;
              pendingActiveChatIdRef.current = null;
              forcedActiveChatIdRef.current = null;

              setChats([]);
              setMemory([]);
              setActiveChatId(null);
              setPersonalStateLoaded(true);
              loadedFromServer = true;
              return;
            }

            if (!res.ok) {
              preferredActiveChatIdRef.current = null;
              pendingActiveChatIdRef.current = null;
              forcedActiveChatIdRef.current = null;

              setChats([]);
              setMemory([]);
              setActiveChatId(null);
              setPersonalStateLoaded(true);
              loadedFromServer = true;
              return;
            }

            const data = await res.json();
            const serverChats = Array.isArray(data?.chats) ? data.chats : [];
            const serverMemory = Array.isArray(data?.memory) ? data.memory : [];

            // Sync persisted profile to chatSettings
            if (data?.profile) {
              const p = data.profile;
              setChatSettings((prev) => ({
                tone:
                  p.tone === "friendly" || p.tone === "direct" || p.tone === "professional"
                    ? p.tone
                    : prev.tone,
                style:
                  p.style === "concise" || p.style === "structured" || p.style === "detailed"
                    ? p.style
                    : prev.style,
                memoryEnabled: typeof p.memoryEnabled === "boolean" ? p.memoryEnabled : prev.memoryEnabled,
              }));
              if (Array.isArray(p.preferences)) {
                setSettingsPreferences(p.preferences);
              }
            }

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

            const hasServerChats = normalizedChats.length > 0;
            const hasServerMemory = serverMemory.length > 0;

            if (!hasManualChatSelectionRef.current) {
              if (hasServerChats) {
                setChats(normalizedChats);

                const preferredVisibleChatId =
                  preferredActiveChatIdRef.current !== null &&
                  normalizedChats.some(
                    (chat: any) =>
                      chat.id === preferredActiveChatIdRef.current &&
                      !chat.archived &&
                      !chat.deleted
                  )
                    ? preferredActiveChatIdRef.current
                    : null;

                const nextActiveChatId =
                  preferredVisibleChatId ??
                  normalizedChats.find((chat: any) => !chat.archived && !chat.deleted)?.id ??
                  normalizedChats.find((chat: any) => !chat.deleted)?.id ??
                  null;

                preferredActiveChatIdRef.current = nextActiveChatId;
                pendingActiveChatIdRef.current = nextActiveChatId;
                forcedActiveChatIdRef.current = nextActiveChatId;
                setActiveChatId(nextActiveChatId);
              } else {
                setChats([]);
                preferredActiveChatIdRef.current = null;
                pendingActiveChatIdRef.current = null;
                forcedActiveChatIdRef.current = null;
                setActiveChatId(null);
              }
            }

            if (hasServerMemory) {
              if (typeof serverMemory[0] === "string") {
                setMemory(serverMemory.map((m: string) => ({ text: m, weight: 0.5 })));
              } else {
                setMemory(serverMemory);
              }
            } else if (!hasManualChatSelectionRef.current) {
              setMemory([]);
            }

            loadedFromServer = true;
            setPersonalStateLoaded(true);
          } catch (error) {
            console.error("OpenLura personal server load failed:", error);
            setPersonalStateLoaded(true);
          }
        }

        const saved = localStorage.getItem(chatStorageKey);
        const mem = localStorage.getItem(memoryStorageKey);

        if (!loadedFromServer && !isPersonalRoute && saved) {
          const parsed = safeParseJson<any[]>(saved, []);
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

            const preferredVisibleChatId =
              preferredActiveChatIdRef.current !== null &&
              normalizedChats.some(
                (chat: any) =>
                  chat.id === preferredActiveChatIdRef.current &&
                  !chat.archived &&
                  !chat.deleted
              )
                ? preferredActiveChatIdRef.current
                : null;

            const nextActiveChatId =
              preferredVisibleChatId ??
              normalizedChats.find((chat: any) => !chat.archived && !chat.deleted)?.id ??
              normalizedChats.find((chat: any) => !chat.deleted)?.id ??
              null;

            preferredActiveChatIdRef.current = nextActiveChatId;
            pendingActiveChatIdRef.current = nextActiveChatId;
            forcedActiveChatIdRef.current = nextActiveChatId;
            setActiveChatId(nextActiveChatId);
          }
        } else if (!saved && !isPersonalRoute && !hasManualChatSelectionRef.current) {
          createNewChat();
        }

        if (!loadedFromServer && !isPersonalRoute && mem) {
          const parsed = safeParseJson<any[]>(mem, []);
          if (parsed.length && typeof parsed[0] === "string") {
            setMemory(parsed.map((m: string) => ({ text: m, weight: 0.5 })));
          } else {
            setMemory(parsed);
          }
        } else if (!loadedFromServer && isPersonalRoute) {
          setMemory([]);
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
      setInitialStateReady(true);
    });
  }, [chatStorageKey, memoryStorageKey, isPersonalRoute, userScopedStorageId]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;

    if (hasBlockingOverlay) {
      body.style.overflow = "hidden";
      body.style.touchAction = isMobile ? "none" : "";
    } else {
      body.style.overflow = "";
      body.style.touchAction = "";
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, [hasBlockingOverlay]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;

      if (window.innerWidth >= 768) {
        setMobileMenu(true);
        return;
      }

      setMobileMenu(false);
      setOpenChatMenuId(null);
      setOpenUserMessageMenuKey(null);
      setOpenAiMessageMenuKey(null);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isPersonalRoute && !userScopedStorageId) {
      return;
    }

    try {
      const saved = localStorage.getItem(settingsStorageKey);
      const parsed = safeParseJson<{
        tone?: "default" | "friendly" | "direct" | "professional";
        style?: "default" | "concise" | "structured" | "detailed";
        memoryEnabled?: boolean;
      } | null>(saved, null);

      if (!parsed) return;

      setChatSettings({
        tone:
          parsed.tone === "friendly" ||
          parsed.tone === "direct" ||
          parsed.tone === "professional"
            ? parsed.tone
            : "default",
        style:
          parsed.style === "concise" ||
          parsed.style === "structured" ||
          parsed.style === "detailed"
            ? parsed.style
            : "default",
        memoryEnabled:
          typeof parsed.memoryEnabled === "boolean"
            ? parsed.memoryEnabled
            : true,
      });
    } catch (error) {
      console.error("OpenLura settings load failed:", error);
    }
  }, [settingsStorageKey, isPersonalRoute, userScopedStorageId]);

  useEffect(() => {
    if (!isPersonalRoute && !userScopedStorageId) {
      return;
    }

    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify(chatSettings));
    } catch (error) {
      console.error("OpenLura settings persistence failed:", error);
    }
  }, [chatSettings, settingsStorageKey, isPersonalRoute, userScopedStorageId]);

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

    if (!isPersonalRoute) {
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(safeChats));
      } catch (error) {
        console.error("OpenLura local chat persistence failed:", error);
      }
    }

    if (!isPersonalRoute || !personalStateLoaded) {
  return;
}

const personalPlaceholderMessage = PERSONAL_ENV_WELCOME_MESSAGE;

const hasOnlyPersonalFallbackPlaceholder =
  safeChats.length === 1 &&
  String(safeChats[0]?.title || "").trim() === "Persoonlijke omgeving" &&
  Array.isArray(safeChats[0]?.messages) &&
  safeChats[0].messages.length === 1 &&
  safeChats[0].messages[0]?.role === "ai" &&
  safeChats[0].messages[0]?.content === personalPlaceholderMessage;

const shouldSkipPersonalStateSync =
  hasOnlyPersonalFallbackPlaceholder && memory.length === 0;

    if (shouldSkipPersonalStateSync) {
      return;
    }

    if (personalSyncTimeoutRef.current) {
      clearTimeout(personalSyncTimeoutRef.current);
    }

    personalSyncTimeoutRef.current = setTimeout(async () => {
      const attemptSync = async (attempt = 1): Promise<void> => {
        try {
          const res = await fetch("/api/personal-state", {
            method: "POST",
            headers: getOpenLuraRequestHeaders(true, {
              personalEnv: true,
              includeUserId: false,
            }),
            credentials: "same-origin",
            body: JSON.stringify({
              chats: safeChats,
              memory,
              profile: {
                tone: chatSettings.tone,
                style: chatSettings.style,
                memoryEnabled: chatSettings.memoryEnabled,
                preferences: settingsPreferences,
              },
            }),
          });

          if (res.status === 401) return; // niet ingelogd, niet retrien
          if (!res.ok && attempt < 3) {
            await new Promise((r) => setTimeout(r, 1200 * attempt));
            return attemptSync(attempt + 1);
          }
          if (!res.ok) {
            console.error(`OpenLura personal sync failed after ${attempt} attempts (status ${res.status})`);
          }
        } catch (error) {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1200 * attempt));
            return attemptSync(attempt + 1);
          }
          console.error("OpenLura personal sync failed:", error);
        }
      };

      await attemptSync();
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
    setOpenChatMenuId(null);
    setOpenUserMessageMenuKey(null);
    setOpenAiMessageMenuKey(null);
  }, [activeChatId]);

  useEffect(() => {
    if (!showExportMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const exportTrigger = document.querySelector(
        "[data-openlura-export-trigger]"
      );
      const exportMenu = document.querySelector(
        "[data-openlura-export-menu]"
      );

      if (exportTrigger?.contains(target) || exportMenu?.contains(target)) {
        return;
      }

      setShowExportMenu(false);
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showExportMenu]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (showExportMenu) {
        setShowExportMenu(false);
        return;
      }

      if (showLoginBox) {
        setShowLoginBox(false);
        setLoginError("");
        setLoginUsername("");
        setLoginPassword("");
        return;
      }

      if (showFeedbackBox) {
        setShowFeedbackBox(false);
        setFeedbackText("");
        setFeedbackCategory("adjustment");
        return;
      }

      if (showClearDeletedConfirm) {
        setShowClearDeletedConfirm(false);
        return;
      }

      if (showSettingsBox) {
        setShowSettingsBox(false);
        return;
      }

      if (showDashboard) {
        setShowDashboard(false);
        return;
      }

      if (deleteTargetChatId !== null) {
        setDeleteTargetChatId(null);
        return;
      }

      if (openUserMessageMenuKey !== null) {
        setOpenUserMessageMenuKey(null);
        return;
      }

      if (openAiMessageMenuKey !== null) {
        setOpenAiMessageMenuKey(null);
        return;
      }

      if (openChatMenuId !== null) {
        setOpenChatMenuId(null);
        return;
      }

      if (
        mobileMenu &&
        typeof window !== "undefined" &&
        window.innerWidth < 768
      ) {
        setMobileMenu(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    mobileMenu,
    openChatMenuId,
    openUserMessageMenuKey,
    openAiMessageMenuKey,
    showLoginBox,
    showFeedbackBox,
    showClearDeletedConfirm,
    showSettingsBox,
    showDashboard,
    showExportMenu,
    deleteTargetChatId,
  ]);

  useEffect(() => {
  const el = messagesRef.current;
  if (!el) return;

  const handleViewportResize = () => {
    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "auto",
      });
    });
  };

  window.addEventListener("resize", handleViewportResize);

  const visibleChats = chats.filter(
    (chat: any) => !chat.archived && !chat.deleted
  );

  const resolvedActiveChat =
    visibleChats.find((chat: any) => chat.id === activeChatId) ??
    visibleChats[0] ??
    null;

  const lastMessage =
    resolvedActiveChat?.messages?.[
      (resolvedActiveChat?.messages?.length || 1) - 1
    ] || null;

  requestAnimationFrame(() => {
    el.scrollTo({
      top: el.scrollHeight,
      behavior: lastMessage?.isStreaming ? "auto" : "smooth",
    });
  });
  return () => {
    window.removeEventListener("resize", handleViewportResize);
  };
}, [activeChatId, chats, loading]);

  useEffect(() => {
    resizeComposerTextarea();
  }, [input, image]);

  useEffect(() => {
    if (!isPersonalRoute || !initialStateReady || !personalStateLoaded) return;

    const loadPersonalStateFromServer = async (forceApply = false) => {
      try {
        const res = await fetch("/api/personal-state", {
          method: "GET",
          headers: getOpenLuraRequestHeaders(false, {
            personalEnv: true,
            includeUserId: false,
          }),
          cache: "no-store",
          credentials: "same-origin",
        });

        if (res.status === 401) {
          console.warn("OpenLura personal verify unauthorized");
          setPersonalStateLoaded(true);
          preferredActiveChatIdRef.current = null;
          pendingActiveChatIdRef.current = null;
          forcedActiveChatIdRef.current = null;
          setActiveChatId(null);
          setChats([]);
          setMemory([]);
          return;
        }

        if (!res.ok) {
          preferredActiveChatIdRef.current = null;
          pendingActiveChatIdRef.current = null;
          forcedActiveChatIdRef.current = null;
          setActiveChatId(null);
          setChats([]);
          setMemory([]);
          setPersonalStateLoaded(true);
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
                msg.content !== PERSONAL_ENV_WELCOME_MESSAGE
            )
        );

        const shouldApplyChats =
          forceApply ||
          (!hasLocalMeaningfulChats && latestChats.length === 0) ||
          (!hasLocalMeaningfulChats && normalizedChats.length > 0);

        const hasServerChats = normalizedChats.length > 0;

        if (shouldApplyChats) {
          setChats(normalizedChats);

          const currentStillExists =
            latestActiveChatId !== null &&
            normalizedChats.some(
              (chat: any) =>
                chat.id === latestActiveChatId && !chat.archived && !chat.deleted
            );

          const preferredVisibleChatId =
            preferredActiveChatIdRef.current !== null &&
            normalizedChats.some(
              (chat: any) =>
                chat.id === preferredActiveChatIdRef.current &&
                !chat.archived &&
                !chat.deleted
            )
              ? preferredActiveChatIdRef.current
              : null;

          const nextActiveChatId =
            hasServerChats
              ? preferredVisibleChatId ??
                (currentStillExists
                  ? latestActiveChatId
                  : normalizedChats.find((chat: any) => !chat.archived && !chat.deleted)?.id ??
                    normalizedChats.find((chat: any) => !chat.deleted)?.id ??
                    null)
              : null;

          preferredActiveChatIdRef.current = nextActiveChatId;
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

    const pollId = window.setInterval(() => {
      loadPersonalStateFromServer(false);
    }, 5000);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPersonalRoute, initialStateReady, personalStateLoaded]);

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

    const handleUsePrompt = (event: Event) => {
      const customEvent = event as CustomEvent<{
        content?: string;
        promptId?: string;
        source?: string;
        mode?: "replace" | "append";
      }>;

      const nextContent = String(customEvent.detail?.content || "").trim();

      if (!nextContent) return;

      applyComposerInput(nextContent, {
        source: "prompt",
        label: "Prompt ready",
        mode: customEvent.detail?.mode || "replace",
      });

      closeMobileSidebar();
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("openlura_use_prompt", handleUsePrompt as EventListener);

    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("openlura_use_prompt", handleUsePrompt as EventListener);
    };
  }, []);

const messageShellClass =
  "flex w-full min-w-0 max-w-full";
const messageBubbleClass =
  "min-w-0 max-w-full break-words [overflow-wrap:anywhere] leading-7 tracking-[-0.01em]";
const composerInputClass =
  "w-full min-w-0 max-w-full resize-none overflow-x-hidden break-words [overflow-wrap:anywhere]";
const messageActionButtonClass =
  "inline-flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-white/66 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-[#3b82f6]/28 hover:bg-[#3b82f6]/8 hover:text-white hover:shadow-[0_8px_18px_rgba(59,130,246,0.12)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

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

useEffect(() => {
  if (isPersonalRoute) {
    setUserScopedStorageId("");
    return;
  }

  const resolvedUserId = getOrCreateOpenLuraUserId();
  setUserScopedStorageId(resolvedUserId);
}, [isPersonalRoute]);

const getOpenLuraRequestHeaders = (
  includeJson = true,
  options?: { personalEnv?: boolean; includeUserId?: boolean }
) => {
  const headers: Record<string, string> = includeJson
    ? { "Content-Type": "application/json" }
    : {};

  if (options?.includeUserId === true) {
    const resolvedUserId = getOrCreateOpenLuraUserId();

    if (resolvedUserId) {
      headers["x-openlura-user-id"] = resolvedUserId;
    }
  }

  if (options?.personalEnv ?? isPersonalRoute) {
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

const activeMessages = Array.isArray(activeChat?.messages)
  ? activeChat.messages
  : [];

const renderedChatId = activeChat?.id ?? null;

const getFeedbackUiKey = (chatId: number | null, msgIndex: number) =>
  `${chatId ?? "no-chat"}-${msgIndex}`;
const resizeComposerTextarea = () => {
  const el = inputRef.current;
  if (!el) return;

  el.style.height = "0px";
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
};

const handleUseResultAsInput = (
  content: string,
  chatId: number | null,
  msgIndex: number
) => {
  const nextValue = String(content || "").trim();

  if (!nextValue) return;

  applyComposerInput(nextValue, {
    source: "result",
    label: "Result ready",
    mode: "replace",
  });

  const keyId = getFeedbackUiKey(chatId, msgIndex);

  setFeedbackUI((prev) => ({
    ...prev,
    [keyId]: "Added to input",
  }));

  window.setTimeout(() => {
    setFeedbackUI((prev) => {
      const copy = { ...prev };
      delete copy[keyId];
      return copy;
    });
  }, 1400);
};

const tokenizeMessageContent = (content: string) => content.split(/(\s+)/);

const isUrlToken = (part: string) => /^https?:\/\/\S+$/i.test(part);

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
    preferredActiveChatIdRef.current = null;
    pendingActiveChatIdRef.current = null;
    forcedActiveChatIdRef.current = null;
    if (activeChatId !== null) {
      setActiveChatId(null);
    }
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

    const targetChat =
      updatedChats.find((chat: any) => chat.id === chatId) || null;
    const targetIsVisible =
      !!targetChat && !targetChat.archived && !targetChat.deleted;

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
  closeMobileSidebar();

  updateChatMeta(chatId, {
    archived: false,
    deleted: false,
  });
};

const deleteChat = (chatId: number) => {
  setOpenChatMenuId(null);
  setDeleteTargetChatId(chatId);
};

const confirmDeleteChat = () => {
  if (deleteTargetChatId === null) return;

  const nextVisibleChat = chats.find(
    (chat: any) =>
      chat.id !== deleteTargetChatId && !chat.archived && !chat.deleted
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
  closeMobileSidebar();

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
      if (isPersonalRoute) {
        isBootstrappingChatRef.current = false;
        setChats([]);
        preferredActiveChatIdRef.current = null;
        pendingActiveChatIdRef.current = null;
        forcedActiveChatIdRef.current = null;
        setActiveChatId(null);
      } else {
        const fallbackChat = buildFallbackChat();

        isBootstrappingChatRef.current = false;
        setChats([fallbackChat]);
        preferredActiveChatIdRef.current = fallbackChat.id;
        pendingActiveChatIdRef.current = fallbackChat.id;
        forcedActiveChatIdRef.current = fallbackChat.id;
        setActiveChatId(fallbackChat.id);
      }
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
      ? "You have reached your monthly limit for your personal AI. Upgrade your plan to keep chatting."
      : "Your current usage limit has been reached. Check your plan or increase your limit.";
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

      if (!isPersonalRoute) {
        try {
          localStorage.setItem(memoryStorageKey, JSON.stringify(next));
        } catch (error) {
          console.error("OpenLura memory persistence failed:", error);
        }
      }

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
  const getScopedRequestHeaders = (
  includeJson = true,
  personalEnv = isPersonalRoute
) =>
  getOpenLuraRequestHeaders(includeJson, {
    personalEnv,
    includeUserId: !personalEnv,
  });

            const stopStreaming = () => {
    if (streamController) {
      streamController.abort();
      setStreamController(null);
    }

    setChats((prev) =>
      prev.map((chat: any) => {
        if (chat.id !== activeChatId) return chat;

        const nextMessages = [...(chat.messages || [])];
        const lastIndex = nextMessages.length - 1;

        if (lastIndex >= 0 && nextMessages[lastIndex]?.isStreaming) {
          nextMessages[lastIndex] = {
            ...nextMessages[lastIndex],
            isStreaming: false,
          };
        }

        return {
          ...chat,
          messages: nextMessages,
        };
      })
    );

    setLoading(false);
  };

  const handlePersonalLogin = async () => {
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true, {
          includeUserId: false,
        }),
        credentials: "same-origin",
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setLoginError(data?.error || "Login failed");
        return;
      }

      const verifyRes = await fetch("/api/personal-state", {
        method: "GET",
        headers: getScopedRequestHeaders(true, true),
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!verifyRes.ok) {
        setLoginError("Your personal session could not be verified.");
        return;
      }

      setShowLoginBox(false);
      setLoginUsername("");
      setLoginPassword("");
      window.location.href = "/persoonlijke-omgeving";
    } catch {
      setLoginError("Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegisterError("");
    setRegisterSuccess("");
    if (!registerEmail.trim()) { setRegisterError("Vul een e-mailadres in"); return; }
    if (!registerPassword) { setRegisterError("Vul een wachtwoord in"); return; }
    if (registerPassword.length < 6) { setRegisterError("Wachtwoord moet minimaal 6 tekens zijn"); return; }
    if (registerPassword !== registerPasswordConfirm) { setRegisterError("Wachtwoorden komen niet overeen"); return; }
    setRegisterLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "signup", email: registerEmail.trim(), password: registerPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) { setRegisterError(data?.error || "Registratie mislukt"); return; }
      if (data.requiresConfirmation) { setRegisterSuccess("Controleer je e-mail om je account te bevestigen."); return; }
      setShowLoginBox(false);
      setRegisterEmail(""); setRegisterPassword(""); setRegisterPasswordConfirm("");
      window.location.href = "/persoonlijke-omgeving";
    } catch { setRegisterError("Registratie mislukt"); }
    finally { setRegisterLoading(false); }
  };

  const handlePersonalLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "DELETE",
        headers: getOpenLuraRequestHeaders(false, {
          includeUserId: false,
        }),
        credentials: "same-origin",
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
      "retry",
      "again",
      "one more time",
      "try again",
      "do it again",
      "continue",
      "go on",
      "finish it",
      "complete it",
      "keep going",
    ].includes(normalized);
  };

  const isRefinementInstruction = (text: string) => {
    const normalized = text.toLowerCase().trim();

    return /^(and )?(now )?(even )?(shorter|short|clearer|simpler|more concrete|different|retry but shorter|make it shorter|shorter please|clearer please|simpler please|more context|less text)([.!?])?$/.test(
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

  const resendAiAnswer = async (chatId: number, msgIndex: number) => {
    if (loading) return;

    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    const resolvedTarget = resolveFeedbackTargetContext(chat.messages || [], msgIndex);
    const originalUserMessage = resolvedTarget.originalUserMessage || "";
    const originalAiMessage = resolvedTarget.originalAiMessage || "";

    if (!originalUserMessage.trim()) {
      return;
    }

    let updated = [...chats];
    const index = updated.findIndex((c) => c.id === chatId);

    if (index === -1) {
      return;
    }

    closeMobileSidebar();
    setLoading(true);

    updated[index].messages.push({
      role: "ai",
      content: "…",
      isStreaming: true,
    });

    setChats([...updated]);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    let improveRes: Response;

    try {
      improveRes = await fetch("/api/chat", {
        method: "POST",
        headers: getOpenLuraRequestHeaders(true, {
  personalEnv: false,
  includeUserId: true,
}),
        body: JSON.stringify({
          message: `The user wants you to answer the same question again.
Original question:
${originalUserMessage}

Your previous incomplete or rejected answer:
${originalAiMessage}

Now give a complete, good answer to the original question.
Do not mention that this is a new attempt.`,
          memory: chatSettings.memoryEnabled
            ? memory
                .filter((m) => m.weight > 0.6)
                .map((m) => m.text)
                .join(" | ")
            : "",
          tone: chatSettings.tone,
          style: chatSettings.style,
          memoryEnabled: chatSettings.memoryEnabled,
          feedback: {
            likes: 0,
            dislikes: 0,
            issues: [],
            recentIssues: [originalUserMessage],
          },
        }),
      });
    } catch (error) {
      console.error("OpenLura resend request failed:", error);
      updated[index].messages[updated[index].messages.length - 1] = {
        ...updated[index].messages[updated[index].messages.length - 1],
        content: "OpenLura could not fetch a better retry right now. Please try again.",
        isStreaming: false,
      };
      setChats([...updated]);
      setLoading(false);
      setStreamController(null);
      return;
    }

    if (improveRes.status === 429) {
      const limitMessage = await getUsageLimitMessage(improveRes);
      const usageTier = improveRes.headers.get("X-OpenLura-Usage-Tier") || "free";
      const limitType = improveRes.headers.get("X-OpenLura-Limit-Type") || "monthly";

      setUpgradeNotice({
        visible: true,
        message: limitMessage,
        tier: usageTier,
        limitType,
      });

      updated[index].messages[updated[index].messages.length - 1] = {
        ...updated[index].messages[updated[index].messages.length - 1],
        content: limitMessage,
        isStreaming: false,
        disableFeedback: true,
      };
      setChats([...updated]);
      setLoading(false);
      setStreamController(null);
      return;
    }

    if (!improveRes.ok || !improveRes.body) {
      updated[index].messages[updated[index].messages.length - 1] = {
        ...updated[index].messages[updated[index].messages.length - 1],
        content: "OpenLura kon nu geen nieuwe poging ophalen. Probeer het opnieuw.",
        isStreaming: false,
      };
      setChats([...updated]);
      setLoading(false);
      setStreamController(null);
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

    updated[index].messages[updated[index].messages.length - 1] = {
      ...updated[index].messages[updated[index].messages.length - 1],
      variant: improveVariant,
      sources: improveSources,
    };

    setChats([...updated]);

    let improvedText = "";

    try {
      while (true) {
        const { done, value } = await improveReader.read();
        if (done) break;

        let chunk = improveDecoder.decode(value);

        chunk = chunk
          .replace(/\(blank line\)/gi, "")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/\n\s*\n/g, "\n\n");

        improvedText += chunk;

        updated[index].messages[updated[index].messages.length - 1] = {
          ...updated[index].messages[updated[index].messages.length - 1],
          content: improvedText || "…",
          isStreaming: !improvedText.trim(),
        };

        setChats([...updated]);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("OpenLura resend stream failed:", error);
      }
    }

    updated[index].messages[updated[index].messages.length - 1] = {
      ...updated[index].messages[updated[index].messages.length - 1],
      content: improvedText.trim()
        ? improvedText
        : "OpenLura could not generate a better retry right now. Please try again.",
      isStreaming: false,
    };

    setChats([...updated]);
    setLoading(false);
    setStreamController(null);
  };

  const sendMessage = async () => {
    if (!input.trim() && !image) return;

    if (!isPersonalRoute) {
      const anonUsage = getAnonUsage();
      if (anonUsage.count >= ANON_MSG_LIMIT) {
        const resetAt = anonUsage.resetAt > Date.now() ? anonUsage.resetAt : Date.now() + ANON_WINDOW_MS;
        const resetTime = new Date(resetAt);
        const resetLabel = resetTime.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
        setUpgradeNotice({
          visible: true,
          message: `Je kunt weer chatten om ${resetLabel}, of meld je aan voor onbeperkt chatten.`,
          tier: "free",
          limitType: "anon_window",
        });
        return;
      }
      incrementAnonUsage();
    }

    closeMobileSidebar();

    try {

      let currentChatId = activeChatId ?? activeChat?.id ?? null;

      if (currentChatId === null) {
        const fallbackChat = buildFallbackChat({
          title: isPersonalRoute ? "Persoonlijke chat" : "New Chat",
          messages: [],
        });

        currentChatId = fallbackChat.id;

        hasManualChatSelectionRef.current = true;
        pendingActiveChatIdRef.current = currentChatId;
        preferredActiveChatIdRef.current = currentChatId;
        forcedActiveChatIdRef.current = currentChatId;

        setChats((prev) => [fallbackChat, ...prev]);
        setActiveChatId(currentChatId);
      }

    const pendingImprovement = awaitingImprovement[currentChatId];
    const isImprovementReply = !!pendingImprovement && !!input.trim();

        if (isImprovementReply) {
      let updated = [...chats];
      const index = updated.findIndex((c) => c.id === currentChatId);
      const retryRequest = isRetryInstruction(input);

      if (index === -1 || currentChatId === null) {
        setLoading(false);
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
        const existingFeedback = safeParseJson<any[]>(
          localStorage.getItem(feedbackStorageKey),
          []
        );

        existingFeedback.push({
          chatId: currentChatId,
          msgIndex: pendingImprovement?.targetMsgIndex ?? updated[index].messages.length - 1,
          type: "improve",
          message: input,
          userMessage: originalUserMessage || "Direct improvement feedback",
          timestamp: Date.now(),
          source: "improvement_reply",
          learningType: classifyLearningSignal(input),
          environment: isPersonalRoute ? "personal" : "default",
        });

        try {
          localStorage.setItem(feedbackStorageKey, JSON.stringify(existingFeedback));
        } catch (error) {
          console.error("OpenLura local improvement feedback persistence failed:", error);
        }

        const keyId = getFeedbackUiKey(
          currentChatId,
          updated[index].messages.length - 1
        );

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
            headers: getScopedRequestHeaders(true, isPersonalEnvironment),
            body: JSON.stringify({
              chatId: String(currentChatId),
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
      clearWorkflowPrefill();
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
          headers: getScopedRequestHeaders(true, isPersonalEnvironment),
          body: JSON.stringify({
            message: retryRequest
              ? `The user wants you to answer the same question again.

Original question:
${originalUserMessage}

Your previous incomplete or rejected answer:
${originalAiMessage}

Now give a complete, good answer to the original question.
Do not mention that this is a new attempt.`
              : `The user was not satisfied with your previous answer.

Original question:
${originalUserMessage}

Your previous answer:
${originalAiMessage}

User improvement request:
${input}

Now immediately give a better version of the same answer.

IMPORTANT:
- Follow the user's improvement request literally
- If the user says "shorter" or "too long": make the answer at most 50% of the original length
- If the user says "clearer": make the answer simpler and more concrete
- If the user criticizes the structure: visibly improve the structure
- Do not repeat the same mistake as in the previous answer

Do not mention that this is an improved version.
Only give the improved answer directly.`,
            memory: chatSettings.memoryEnabled
              ? memory
                  .filter((m) => m.weight > 0.6)
                  .map((m) => m.text)
                  .join(" | ")
              : "",
            tone: chatSettings.tone,
            style: chatSettings.style,
            memoryEnabled: chatSettings.memoryEnabled,
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
          content: "OpenLura could not fetch the improved version right now. Please try again.",
        });
        setChats([...updated]);
        setStreamController(null);
        setLoading(false);
        return;
      }

      if (improveRes.status === 429) {
        const limitMessage = await getUsageLimitMessage(improveRes);
        const usageTier = improveRes.headers.get("X-OpenLura-Usage-Tier") || "free";
        const limitType = improveRes.headers.get("X-OpenLura-Limit-Type") || "monthly";

        setUpgradeNotice({
          visible: true,
          message: limitMessage,
          tier: usageTier,
          limitType,
        });

        updated[index].messages.push({
          role: "ai",
          content: limitMessage,
          disableFeedback: true,
        });
        setChats([...updated]);
        setStreamController(null);
        setLoading(false);
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
          ] = {
            ...updated[index].messages[updated[index].messages.length - 1],
            content: improvedText || "…",
            isStreaming: false,
          };

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
          content: "OpenLura could not generate the improved version right now. Please try again.",
          isStreaming: false,
        };
      } else {
        updated[index].messages[
          updated[index].messages.length - 1
        ] = {
          ...updated[index].messages[updated[index].messages.length - 1],
          content: improvedText,
          isStreaming: false,
        };
      }

      setChats([...updated]);

            setStreamController(null);
      setLoading(false);
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
    let index = updated.findIndex((c) => c.id === currentChatId);

    if (index === -1) {
      const fallbackChat = buildFallbackChat({
        id: currentChatId,
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
      ? `The user wants you to refine your previous answer, not answer a new question.

Original question:
${refinementContext.originalUserMessage}

Your most recent relevant answer:
${refinementContext.originalAiMessage}

New user instruction:
${rawInputToSend}

Apply this instruction directly to your previous answer.

IMPORTANT:
- Keep exactly the same topic
- Do not ask a follow-up question like "what do you want shorter?"
- Apply the change directly
- If the instruction is "even shorter" or "shorter": make the existing version clearly more compact
- If the instruction is "clearer" or "simpler": rewrite the same answer more clearly
- Do not change the topic
- Only give the adjusted answer`
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
    clearWorkflowPrefill();
    setImage(null);
    setLoading(true);

// instant visual feedback (feels faster)
updated[index].messages.push({
  role: "ai",
  content: "…",
  isStreaming: true,
});

setChats([...updated]);

    if (imageToSend) {
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const rawFeedback = safeParseJson<any[]>(
      localStorage.getItem(feedbackStorageKey),
      []
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

    const resolvedMemoryText = chatSettings.memoryEnabled
      ? memory
          .filter((m) => m.weight > 0.6)
          .map((m) => m.text)
          .join(" | ")
      : "";

    let res: Response;

    try {
      res = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: getScopedRequestHeaders(true, isPersonalEnvironment),
        body: JSON.stringify({
          message: inputToSend,
          image: imageToSend,
          memory: resolvedMemoryText,
          personalMemory:
            isPersonalRoute && chatSettings.memoryEnabled
              ? resolvedMemoryText
              : "",
          tone: chatSettings.tone,
          style: chatSettings.style,
          memoryEnabled: chatSettings.memoryEnabled,
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
    } catch (error) {
      updated[index].messages[
        updated[index].messages.length - 1
      ] = {
        ...updated[index].messages[
          updated[index].messages.length - 1
        ],
        content: "OpenLura could not fetch an answer right now. Please try again.",
        isStreaming: false,
      };
      setChats([...updated]);
      setStreamController(null);
      setLoading(false);
      return;
    }

    if (res.status === 429) {
      const limitMessage = await getUsageLimitMessage(res);
      const usageTier = res.headers.get("X-OpenLura-Usage-Tier") || "free";
      const limitType = res.headers.get("X-OpenLura-Limit-Type") || "monthly";

      setUpgradeNotice({
        visible: true,
        message: limitMessage,
        tier: usageTier,
        limitType,
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
      return;
    }

    if (!res.ok || !res.body) {
      updated[index].messages[
        updated[index].messages.length - 1
      ] = {
        ...updated[index].messages[
          updated[index].messages.length - 1
        ],
        content: "OpenLura could not fetch an answer right now. Please try again.",
        isStreaming: false,
      };
      setChats([...updated]);
      setStreamController(null);
      setLoading(false);
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
    } else {
      updated[index].messages[
        updated[index].messages.length - 1
      ] = {
        ...updated[index].messages[updated[index].messages.length - 1],
        content: aiText,
        isStreaming: false,
      };
    }

    setChats([...updated]);

    setStreamController(null);

    // ✅ MEMORY SAVE
    if (
      chatSettings.memoryEnabled &&
      rawInputToSend.length < 60 &&
      !isRefinementInstruction(rawInputToSend)
    ) {
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

      if (initialStateReady && !isPersonalRoute) {
        try {
          localStorage.setItem(memoryStorageKey, JSON.stringify(newMemory));
        } catch (error) {
          console.error("OpenLura memory persistence failed:", error);
        }
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
    }
  };
  const handleFeedback = async (chatId: number, msgIndex: number, type: string) => {
  const existing = safeParseJson<any[]>(
    localStorage.getItem(feedbackStorageKey),
    []
  );

  const chat = chats.find((c) => c.id === chatId);
  const message = chat?.messages[msgIndex];
  const resolvedTarget = resolveFeedbackTargetContext(chat?.messages || [], msgIndex);
  const prevMessage = {
    content: resolvedTarget.originalUserMessage,
  };

  existing.push({
    chatId: String(chatId),
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
    environment: isPersonalRoute ? "personal" : "default",
  });

  try {
    localStorage.setItem(feedbackStorageKey, JSON.stringify(existing));
  } catch (error) {
    console.error("OpenLura local feedback persistence failed:", error);
  }

  if (prevMessage?.content) {
    updateMemoryWeight(prevMessage.content, type === "up" ? 0.2 : -0.2);
  }

      try {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: getScopedRequestHeaders(true, isPersonalEnvironment),
        body: JSON.stringify({
      chatId: String(chatId),
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

  const keyId = getFeedbackUiKey(chatId, msgIndex);

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
    const chatIndex = updatedChats.findIndex((c) => c.id === chatId);

    if (chatIndex === -1) {
      return;
    }

    const targetMessages = updatedChats[chatIndex]?.messages || [];

    const resolvedTarget = resolveFeedbackTargetContext(targetMessages, msgIndex);

    updatedChats[chatIndex].messages.push({
      role: "ai",
      content: "🤖 What can I improve?",
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

    const handleIdeaSubmit = () => {
  if (!feedbackText.trim()) return;

  if (!isPersonalEnvironment) {
    const existing = safeParseJson<any[]>(
      localStorage.getItem(ideasStorageKey),
      []
    );

    const ideaEntry = {
      text: feedbackText.trim(),
      source: `idea_${feedbackCategory}`,
      category: feedbackCategory,
      chatId: activeChatId,
      environment: "default",
      timestamp: Date.now(),
    };

    existing.push(ideaEntry);
    localStorage.setItem(ideasStorageKey, JSON.stringify(existing));
  }

    fetch("/api/feedback", {
      method: "POST",
      headers: getScopedRequestHeaders(true, isPersonalEnvironment),
      body: JSON.stringify({
        chatId: activeChatId !== null ? String(activeChatId) : null,
        type: "idea",
        message: feedbackText.trim(),
        userMessage: isPersonalEnvironment ? "Persoonlijke omgeving feedback" : "Feedback / Idee",
        source: isPersonalEnvironment ? "personal_environment" : `idea_${feedbackCategory}`,
        environment: isPersonalEnvironment ? "personal" : "default",
        learningType:
          feedbackCategory === "feedback_learning" ? "style" : "content",
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
    <main className="fixed inset-0 flex overflow-hidden bg-[#050510] text-white">
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
  onOpenSettings={() => setShowSettingsBox(true)}
  onOpenDashboard={async () => {
    setShowDashboard(true);
    setDashboardLoading(true);
    try {
      const res = await fetch("/api/personal-state", {
        method: "GET",
        credentials: "same-origin",
        headers: { "x-openlura-personal-env": "true" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData({ usageStats: data?.usageStats ?? null });
      }
    } catch {}
    setDashboardLoading(false);
  }}
  onCopyActiveChatMarkdown={copyChatToClipboard}
  onDownloadActiveChatMarkdown={downloadMarkdown}
/>
      <button
  onClick={() => setMobileMenu(!mobileMenu)}
  aria-label={mobileMenu ? "Close menu" : "Open menu"}
  className={`fixed left-4 top-[max(env(safe-area-inset-top),16px)] z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-white/8 bg-white/[0.055] text-white/82 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur-2xl ol-interactive transition-[opacity,transform,background-color,border-color] duration-200 hover:border-white/12 hover:bg-white/[0.085] hover:text-white active:scale-95 md:hidden ${
    mobileMenu ? "pointer-events-none scale-95 opacity-0" : "opacity-100"
  }`}
>
  ☰
</button>

{showDashboard && (
  <div className="fixed inset-0 z-[160] flex items-end justify-center sm:items-center bg-black/60 p-4 backdrop-blur-sm">
    <div className="w-full max-w-[420px] rounded-t-3xl sm:rounded-[28px] border border-white/10 bg-[#0a0f1d]/98 shadow-[0_22px_60px_rgba(0,0,0,0.40)] backdrop-blur-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-medium text-white/90">Mijn profiel</h2>
          <p className="text-[11px] text-white/36 mt-0.5">Persoonlijke omgeving overzicht</p>
        </div>
        <button type="button" onClick={() => setShowDashboard(false)} className="rounded-full p-1.5 text-white/36 hover:bg-white/8 hover:text-white/70 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="max-h-[72vh] overflow-y-auto px-5 py-4 space-y-4">
        {dashboardLoading ? (
          <div className="py-8 text-center text-sm text-white/36">Laden...</div>
        ) : (
          <>
            {/* Profiel instellingen */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/36 mb-2">Instellingen</div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/54">Toon</span>
                <span className="text-[13px] text-white/80 capitalize">{chatSettings.tone === "default" ? "Default" : chatSettings.tone === "friendly" ? "Vriendelijk" : chatSettings.tone === "direct" ? "Direct" : "Professioneel"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/54">Stijl</span>
                <span className="text-[13px] text-white/80">{chatSettings.style === "default" ? "Default" : chatSettings.style === "concise" ? "Kort" : chatSettings.style === "structured" ? "Gestructureerd" : "Uitgebreid"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/54">Geheugen</span>
                <span className={`text-[13px] ${chatSettings.memoryEnabled ? "text-emerald-400/80" : "text-white/40"}`}>{chatSettings.memoryEnabled ? "Actief" : "Uit"}</span>
              </div>
            </div>

            {/* Chat overzicht */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
                <div className="text-xl font-semibold text-white/90">{chats.filter((c: any) => !c.deleted).length}</div>
                <div className="text-[11px] text-white/36 mt-0.5">Chats</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
                <div className="text-xl font-semibold text-white/90">{memory.length}</div>
                <div className="text-[11px] text-white/36 mt-0.5">Geheugen</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
                <div className="text-xl font-semibold text-white/90">{settingsPreferences.length}</div>
                <div className="text-[11px] text-white/36 mt-0.5">Voorkeuren</div>
              </div>
            </div>

            {/* Usage */}
            {usage && usage.limit > 0 && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/36 mb-2">Gebruik deze maand</div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-white/54">{usage.used} / {usage.limit} berichten</span>
                  <span className={`text-[13px] font-medium ${usage.percentage >= 0.8 ? "text-amber-400/80" : "text-white/60"}`}>{Math.round(usage.percentage * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${usage.percentage >= 0.8 ? "bg-amber-400/60" : "bg-emerald-400/60"}`}
                    style={{ width: `${Math.min(usage.percentage * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Memory items */}
            {memory.length > 0 && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/36 mb-2">Geheugen items</div>
                <div className="space-y-1.5">
                  {memory.slice(0, 5).map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />
                      <span className="text-[12px] text-white/54 truncate">{m.text}</span>
                    </div>
                  ))}
                  {memory.length > 5 && (
                    <div className="text-[11px] text-white/30 mt-1">+{memory.length - 5} meer</div>
                  )}
                </div>
              </div>
            )}

            {/* Lege state */}
            {memory.length === 0 && chats.filter((c: any) => !c.deleted).length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/8 px-4 py-6 text-center">
                <p className="text-sm text-white/36">Nog geen activiteit. Start een chat om te beginnen.</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-white/8 px-5 py-4 space-y-3">
        <button
          type="button"
          onClick={async () => {
            setShowDashboard(false);
            try {
              const res = await fetch("/api/stripe/portal", {
                method: "POST",
                credentials: "include",
              });
              if (res.ok) {
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }
            } catch (err) {
              console.error("Portal error:", err);
            }
          }}
          className="w-full rounded-2xl border border-blue-400/16 bg-blue-400/[0.04] px-4 py-2.5 text-sm text-blue-200/80 hover:border-blue-400/24 hover:bg-blue-400/[0.08] hover:text-blue-100 transition-all"
        >
          Manage subscription
        </button>
        <div className="flex justify-between items-center">
          <button type="button" onClick={() => { setShowDashboard(false); setShowSettingsBox(true); }}
            className="text-[12px] text-white/42 hover:text-white/70 transition-colors">
            Naar instellingen →
          </button>
          <button type="button" onClick={() => setShowDashboard(false)}
            className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-white/60 hover:text-white/80 transition-colors">
            Sluiten
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{showSettingsBox && (
  <div className="fixed inset-0 z-[160] flex items-end justify-center sm:items-center bg-black/60 p-4 backdrop-blur-sm">

    <div className="w-full max-w-[420px] rounded-t-3xl sm:rounded-[28px] border border-white/10 bg-[#0a0f1d]/98 shadow-[0_22px_60px_rgba(0,0,0,0.40)] backdrop-blur-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-medium text-white/90">Instellingen</h2>
          <p className="text-[11px] text-white/36 mt-0.5">
            {isPersonalRoute ? "Persoonlijke omgeving — opgeslagen per account" : "Globaal voor deze sessie"}
          </p>
        </div>
        <button type="button" onClick={() => setShowSettingsBox(false)} className="rounded-full p-1.5 text-white/36 hover:bg-white/8 hover:text-white/70 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="max-h-[72vh] overflow-y-auto px-5 py-4 space-y-5">

        {/* Personal vs global badge */}
        <div className={`rounded-2xl border px-4 py-3 ${isPersonalRoute ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-white/8 bg-white/[0.03]"}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`h-1.5 w-1.5 rounded-full ${isPersonalRoute ? "bg-emerald-400/80" : "bg-white/30"}`} />
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">
              {isPersonalRoute ? "Persoonlijk actief" : "Globale sessie"}
            </span>
          </div>
          <p className="text-[12px] text-white/44 leading-relaxed">
            {isPersonalRoute
              ? "Instellingen worden opgeslagen in je account en gebruikt bij elke chat."
              : "Instellingen gelden alleen voor deze sessie en worden niet opgeslagen."}
          </p>
        </div>

        {/* Tone */}
        <div>
          <div className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-white/34">Toon</div>
          <div className="grid grid-cols-2 gap-2">
            {(["default", "friendly", "direct", "professional"] as const).map((opt) => (
              <button key={opt} type="button"
                onClick={() => setChatSettings((prev) => ({ ...prev, tone: opt }))}
                className={`rounded-2xl border px-3 py-2.5 text-left transition-all duration-150 ${
                  chatSettings.tone === opt
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/8 bg-white/[0.03] text-white/50 hover:border-white/12 hover:bg-white/[0.05] hover:text-white/70"
                }`}
              >
                <div className="text-sm font-medium capitalize">{opt === "default" ? "Default" : opt === "friendly" ? "Vriendelijk" : opt === "direct" ? "Direct" : "Professioneel"}</div>
                <div className="text-[11px] text-white/32 mt-0.5">{opt === "default" ? "Gebalanceerd" : opt === "friendly" ? "Warm & informeel" : opt === "direct" ? "To the point" : "Formeel & helder"}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div>
          <div className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-white/34">Antwoordstijl</div>
          <div className="grid grid-cols-2 gap-2">
            {(["default", "concise", "structured", "detailed"] as const).map((opt) => (
              <button key={opt} type="button"
                onClick={() => setChatSettings((prev) => ({ ...prev, style: opt }))}
                className={`rounded-2xl border px-3 py-2.5 text-left transition-all duration-150 ${
                  chatSettings.style === opt
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/8 bg-white/[0.03] text-white/50 hover:border-white/12 hover:bg-white/[0.05] hover:text-white/70"
                }`}
              >
                <div className="text-sm font-medium">{opt === "default" ? "Default" : opt === "concise" ? "Kort" : opt === "structured" ? "Gestructureerd" : "Uitgebreid"}</div>
                <div className="text-[11px] text-white/32 mt-0.5">{opt === "default" ? "Gebalanceerd" : opt === "concise" ? "Zo compact mogelijk" : opt === "structured" ? "Met duidelijke opbouw" : "Meer context & diepte"}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Memory toggle */}
        <button type="button"
          onClick={() => setChatSettings((prev) => ({ ...prev, memoryEnabled: !prev.memoryEnabled }))}
          className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-150 ${
            chatSettings.memoryEnabled ? "border-white/16 bg-white/[0.06] text-white" : "border-white/8 bg-white/[0.03] text-white/50"
          }`}
        >
          <div className="text-left">
            <div className="text-sm font-medium">Geheugen</div>
            <div className="text-[11px] text-white/36 mt-0.5">{chatSettings.memoryEnabled ? "Actief — antwoorden leren van jou" : "Uitgeschakeld"}</div>
          </div>
          <div className={`h-5 w-9 rounded-full border transition-all duration-200 ${chatSettings.memoryEnabled ? "border-emerald-400/40 bg-emerald-500/30" : "border-white/12 bg-white/[0.04]"}`}>
            <div className={`mt-[2px] h-3.5 w-3.5 rounded-full bg-white/80 shadow transition-all duration-200 ${chatSettings.memoryEnabled ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
          </div>
        </button>

        {/* Preferences — only personal route */}
        {isPersonalRoute && (
          <div>
            <div className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-white/34">Extra voorkeuren</div>
            {settingsPreferences.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {settingsPreferences.map((pref) => (
                  <span key={pref} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[12px] text-white/70">
                    {pref}
                    <button type="button" onClick={() => setSettingsPreferences((prev) => prev.filter((x) => x !== pref))} className="text-white/30 hover:text-white/70">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={settingsNewPref}
                onChange={(e) => setSettingsNewPref(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const t = settingsNewPref.trim();
                    if (t && !settingsPreferences.includes(t)) {
                      setSettingsPreferences((prev) => [...prev, t]);
                      setSettingsNewPref("");
                    }
                  }
                }}
                placeholder="Bijv. gebruik altijd bullet points"
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 placeholder-white/24 outline-none focus:border-white/18 focus:bg-white/[0.06]"
                maxLength={120}
              />
              <button type="button"
                onClick={() => {
                  const t = settingsNewPref.trim();
                  if (t && !settingsPreferences.includes(t)) {
                    setSettingsPreferences((prev) => [...prev, t]);
                    setSettingsNewPref("");
                  }
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-colors"
              >+</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/8 px-5 py-4 flex items-center gap-3">
        {settingsError && <span className="text-[12px] text-red-300/80 flex-1">{settingsError}</span>}
        {!settingsError && <span className="text-[12px] text-white/26 flex-1">
          {isPersonalRoute ? "Wijzigingen gelden direct" : "Niet opgeslagen"}
        </span>}
        <button type="button" onClick={() => setShowSettingsBox(false)}
          className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-white/60 hover:text-white/80 transition-colors"
        >Sluiten</button>
        {isPersonalRoute && (
          <button type="button" disabled={settingsSaving}
            onClick={async () => {
              setSettingsSaving(true);
              setSettingsError(null);
              try {
                const res = await fetch("/api/personal-state", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json", "x-openlura-personal-env": "true" },
                  body: JSON.stringify({
                    chats: chats.map((chat: any) => ({
                      ...chat,
                      messages: (chat.messages || []).map((msg: any) => ({
                        ...msg,
                        image: typeof msg.image === "string" && msg.image.startsWith("data:")
                          ? "[image-uploaded]"
                          : msg.image ?? null,
                      })),
                    })),
                    memory,
                    profile: {
                      tone: chatSettings.tone,
                      style: chatSettings.style,
                      memoryEnabled: chatSettings.memoryEnabled,
                      preferences: settingsPreferences,
                    },
                  }),
                });
                if (!res.ok) throw new Error();
                setSettingsSaved(true);
                setTimeout(() => setSettingsSaved(false), 2000);
              } catch {
                setSettingsError("Opslaan mislukt");
              } finally {
                setSettingsSaving(false);
              }
            }}
            className="rounded-2xl border border-white/14 bg-white/[0.08] px-5 py-2 text-sm text-white/90 hover:bg-white/[0.12] hover:text-white disabled:opacity-50 transition-all"
          >
            {settingsSaving ? "Opslaan..." : settingsSaved ? "✓ Opgeslagen" : "Opslaan"}
          </button>
        )}
      </div>
    </div>
  </div>
)}
                     {showClearDeletedConfirm && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[340px] rounded-[28px] border border-white/8 bg-[#0a0f1d]/95 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
            <h2 className="mb-2 text-lg font-semibold text-white/95">Are you sure?</h2>
            <p className="mb-5 text-sm leading-6 text-white/60">
              All deleted chats will be permanently removed.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowClearDeletedConfirm(false)}
                className="flex-1 rounded-[20px] border border-white/8 bg-white/[0.04] p-3 text-white/88 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.99]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmClearDeletedChats}
                className="flex-1 rounded-[20px] border border-red-400/18 bg-red-500/80 p-3 text-white shadow-[0_10px_22px_rgba(239,68,68,0.24)] ol-interactive transition-[transform,background-color,box-shadow] duration-200 hover:bg-red-500 hover:shadow-[0_12px_26px_rgba(239,68,68,0.28)] active:scale-[0.99]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetChatId !== null && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[340px] rounded-[28px] border border-white/8 bg-[#0a0f1d]/95 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
            <h2 className="mb-2 text-lg font-semibold text-white/95">Are you sure?</h2>
            <p className="mb-5 text-sm leading-6 text-white/60">
              This chat will be moved to Deleted chats.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetChatId(null)}
                className="flex-1 rounded-[20px] border border-white/8 bg-white/[0.04] p-3 text-white/88 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.99]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteChat}
                className="flex-1 rounded-[20px] border border-red-400/18 bg-red-500/80 p-3 text-white shadow-[0_10px_22px_rgba(239,68,68,0.24)] ol-interactive transition-[transform,background-color,box-shadow] duration-200 hover:bg-red-500 hover:shadow-[0_12px_26px_rgba(239,68,68,0.28)] active:scale-[0.99]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackBox && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-[28px] border border-white/8 bg-[#0a0f1d]/95 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
            <h2 className="mb-4 text-lg font-semibold text-white/95">Feedback / Idea</h2>

            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value)}
              className="mb-3 w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-3 py-3 text-sm text-white/90 outline-none ol-surface focus:border-white/14 focus:bg-white/[0.06]"
            >
              <option value="bug">Bug</option>
              <option value="adjustment">Adjustment</option>
              <option value="feedback_learning">AI feedback</option>
            </select>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="mb-4 min-h-[120px] w-full rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-3 text-sm text-white/92 outline-none placeholder:text-white/28 ol-surface focus:border-white/14 focus:bg-white/[0.06]"
              placeholder="Tell us what you want to improve or add..."
            />

            <div className="flex gap-2">
  <button
    onClick={() => {
      setShowFeedbackBox(false);
      setFeedbackText("");
      setFeedbackCategory("adjustment");
    }}
                className="flex-1 rounded-[20px] border border-white/8 bg-white/[0.04] p-3 text-white/88 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.99]"
              >
                Cancel
              </button>

              <button
                onClick={handleIdeaSubmit}
                disabled={!feedbackText.trim()}
                className={`flex-1 rounded-[20px] p-3 ol-interactive transition-[transform,filter,box-shadow,background-color,color] duration-200 ${
                  feedbackText.trim()
                    ? "bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-[0_12px_24px_rgba(59,130,246,0.26)] hover:brightness-110 hover:shadow-[0_14px_28px_rgba(59,130,246,0.30)] active:scale-[0.99]"
                    : "bg-white/10 text-white/30"
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 min-h-0 flex-1 items-stretch justify-start pt-0 md:h-screen md:p-4">
        <div className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-2xl flex-col border border-white/8 bg-white/[0.042] shadow-[0_20px_56px_rgba(0,0,0,0.20)] backdrop-blur-2xl md:min-h-0 md:rounded-[28px] xl:max-w-[920px]">

          <div className="flex items-center justify-between gap-3 border-b border-white/8 pl-16 pr-4 py-3 md:px-6">
            <div className="hidden md:flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#3b82f6]/18 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.16),rgba(29,78,216,0.06)_52%,transparent_78%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_10px_22px_rgba(29,78,216,0.12)]">
  <img
    src="/openlura-logo.png"
    alt="OpenLura logo"
    className="h-full w-full object-contain"
  />
</div>

              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-[-0.02em] text-white/94">
                  OpenLura
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">
                  Adaptive AI workspace
                </div>
                <div className="mt-1 text-[11px] text-white/42">
                  {isPersonalRoute
                    ? "Private account workspace"
                    : userScopedStorageId
                    ? "Browser workspace tied to this user on this device"
                    : "Preparing user workspace"}
                </div>
              </div>
            </div>

            <div className="relative hidden md:flex items-center gap-2">
              <span className="rounded-full border border-[#3b82f6]/16 bg-[#3b82f6]/8 px-3 py-1 text-[11px] font-medium text-[#bfdbfe]">
                Chat
              </span>

              {isPersonalRoute && (
              <button
                type="button"
                data-openlura-export-trigger
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-3 py-1 text-[11px] font-semibold text-[#bfdbfe] shadow-[0_8px_18px_rgba(59,130,246,0.12)] ol-interactive transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-[#3b82f6]/30 hover:bg-[#3b82f6]/16 hover:text-white"
              >
                Export chat
              </button>
              )}

              <button
                type="button"
                onClick={() => setShowSettingsBox(true)}
                className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/74 ol-interactive transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white"
              >
                Settings
              </button>

              {showExportMenu && (
                <div
                  data-openlura-export-menu
                  className="absolute right-0 top-10 z-[120] flex min-w-[180px] flex-col gap-1 rounded-[16px] border border-white/8 bg-[#0c1120]/96 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      copyChatToClipboard();
                      setShowExportMenu(false);
                    }}
                    disabled={!activeChat}
                    className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm text-white/86 ol-interactive transition-[background-color,color] duration-200 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>Copy as Markdown</span>
                    <span className="text-xs text-white/34">⌘</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      downloadMarkdown();
                      setShowExportMenu(false);
                    }}
                    disabled={!activeChat}
                    className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm text-white/86 ol-interactive transition-[background-color,color] duration-200 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>Download .md</span>
                    <span className="text-xs text-white/34">↓</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {usage && usage.percentage >= 0.8 && !upgradeNotice.visible && (
            <div className="mx-4 mt-4 rounded-[24px] border border-amber-300/12 bg-amber-500/[0.065] px-4 py-3 text-sm text-amber-100 shadow-[0_10px_22px_rgba(0,0,0,0.10)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Bijna op je limiet</div>
                  <div className="mt-0.5 text-[12px] opacity-80">
                    {usage.used} / {usage.limit} berichten gebruikt ({Math.round(usage.percentage * 100)}%)
                  </div>
                </div>
                <a href="/#plans" className="shrink-0 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-400/16 hover:text-white">
                  Bekijk plannen →
                </a>
              </div>
            </div>
          )}

          {upgradeNotice.visible && (
            <div className="mx-4 mt-4 rounded-[24px] border border-blue-400/18 bg-blue-500/[0.07] px-4 py-4 text-sm text-blue-100 shadow-[0_10px_22px_rgba(0,0,0,0.10)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-blue-100">
                    {isPersonalRoute
                      ? upgradeNotice.limitType === "window"
                        ? "Even pauzeren ☕"
                        : "Maandlimiet bereikt"
                      : "Gratis berichten op"}
                  </div>
                  <div className="mt-1 text-[12px] text-blue-200/80 leading-5">
                    {upgradeNotice.message}
                  </div>
                </div>
                {isPersonalRoute ? (
                  <a href="/#plans" className="shrink-0 rounded-full border border-blue-300/20 bg-blue-400/14 px-3 py-1.5 text-[11px] font-medium text-blue-100 transition-colors hover:bg-blue-400/22 hover:text-white">
                    Bekijk Go →
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLoginBox(true)}
                    className="shrink-0 rounded-full border border-blue-300/20 bg-blue-400/14 px-3 py-1.5 text-[11px] font-medium text-blue-100 transition-colors hover:bg-blue-400/22 hover:text-white"
                  >
                    Aanmelden →
                  </button>
                )}
              </div>
            </div>
          )}

          <div
  ref={messagesRef}
  style={{ overscrollBehavior: "contain" }}
  className={`${messageShellClass} flex-1 min-h-0 w-full overflow-x-hidden overflow-y-auto pb-5 md:pb-6 ${
  activeMessages.length
    ? "flex-col gap-6 px-4 pt-6 md:gap-7 md:px-6 md:pt-6"
    : "items-center justify-center p-4 pt-6 md:px-6 md:pt-6"
}`}
>
                        {activeMessages.length === 0 ? (
              <div className="flex h-full w-full max-w-2xl -mt-20 flex-col items-center justify-center px-4 md:px-6 text-center">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.032] px-8 py-8 shadow-[0_16px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl md:px-10 md:py-10">
                  <h1 className="mb-3 bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-4xl">
                    What do you want to work on today?
                  </h1>
                  <p className="mx-auto max-w-md text-sm leading-6 text-white/44">
                    Ask a question, upload an image, or continue an earlier chat.
                  </p>
                  {!isPersonalRoute && (
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <a
                        href="/"
                        className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/58 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
                      >
                        Back to home
                      </a>

                      <button
                        type="button"
                        onClick={() => setShowLoginBox(true)}
                        className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/58 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
                      >
                        Login
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
               {activeMessages
                  .map((msg: any, originalIndex: number) => ({
                    msg,
                    originalIndex,
                  }))
                  .filter(
                    (entry: { msg: any; originalIndex: number }) =>
                      entry.msg.content !==
                      "🤖 Thanks for your feedback. I’ll use this to improve future answers."
                  )
                  .map((entry: { msg: any; originalIndex: number }) => {
                    const msg = entry.msg;
                    const originalIndex = entry.originalIndex;

                    return (
  <div
    key={`${msg.role}-${originalIndex}-${msg.content || ""}`}
    className={`${messageShellClass} relative flex-col gap-1.5 md:gap-2 animate-[fadeInUp_0.22s_ease-out] transition-[opacity,transform] duration-200 ${
      msg.role === "user" ? "items-end" : "items-start"
    }`}
  >
    {msg.role === "user" &&
      !msg.isStreaming &&
      String(msg.content || "").trim() && (
        <div className="mb-1 flex w-full max-w-[90%] justify-end md:max-w-[78%]">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const menuKey = `${renderedChatId}-${originalIndex}`;
                setOpenUserMessageMenuKey(
                  openUserMessageMenuKey === menuKey ? null : menuKey
                );
                setSavePromptSuccess(false);
                setSavePromptError("");
              }}
              aria-label="Open message options"
              title="Message options"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-white/56 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white active:scale-95"
            >
              <span className="translate-y-[-1px] text-[16px] leading-none">⋯</span>
            </button>

            {openUserMessageMenuKey === `${renderedChatId}-${originalIndex}` && (
              <div className="absolute right-0 top-9 z-[90] min-w-[190px] overflow-hidden rounded-[16px] border border-white/8 bg-[#0c1120]/96 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                {isPersonalRoute && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleSavePrompt(String(msg.content || ""));
                      }}
                      disabled={savingPrompt || !String(msg.content || "").trim()}
                      className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm text-white/86 ol-interactive transition-[background-color,color] duration-200 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span>{savingPrompt ? "Saving..." : "Save as prompt"}</span>
                      <span className="text-xs text-white/34">↗</span>
                    </button>

                    {savePromptSuccess && (
                      <div className="px-3 pb-1 pt-1 text-xs text-green-400">
                        Saved
                      </div>
                    )}

                    {!!savePromptError && (
                      <div className="px-3 pb-1 pt-1 text-xs text-red-400">
                        {savePromptError || "Failed to save prompt"}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    <div
      className={`${messageBubbleClass} min-w-0 max-w-[90%] md:max-w-[78%] whitespace-pre-line rounded-[24px] px-4 py-3.5 text-[15px] md:px-5 md:py-4 md:text-[16px] transition-[box-shadow,transform,background-color,border-color] duration-200 ${
    msg.role === "user"
      ? "ml-auto rounded-[26px] bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white shadow-[0_0_0_1px_rgba(96,165,250,0.14),0_0_28px_rgba(37,99,235,0.20),0_12px_24px_rgba(37,99,235,0.18)]"
      : "border border-white/8 bg-white/[0.045] text-white/90 backdrop-blur-xl shadow-[0_10px_22px_rgba(0,0,0,0.10)]"
  }`}
>
                          {msg.image && (
                            <img
                              src={msg.image}
                              alt="Uploaded"
                              className="block w-full max-w-[240px] max-h-[260px] object-cover rounded-2xl border border-white/8"
                            />
                          )}

                          {msg.content ? (
  <div
  className={`${msg.image ? "mt-3 " : ""}${messageBubbleClass} min-w-0 max-w-full text-[15px] leading-7 text-inherit select-text md:text-[16px]`}
>
    {msg.isStreaming && msg.content === "…" ? (
      <span className="inline-flex items-center gap-2 text-white/56">
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
        <span className="text-sm">OpenLura is thinking</span>
      </span>
    ) : (
      <>
        {tokenizeMessageContent(msg.content).map((part: string, idx: number) => {
          const isUrl = isUrlToken(part);

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
                          renderedChatId !== null &&
                          originalIndex !== 0 &&
                          !msg.disableFeedback &&
                          msg.content !== "🤖 What can I improve?" &&
                          msg.content !== "🤖 Thanks for your feedback. I’ll use this to improve future answers." && (
                            <>
                              <div className="mt-1 flex w-full max-w-[90%] flex-wrap items-center gap-1.5 px-0.5 md:mt-1.5 md:max-w-[78%] md:gap-2 md:px-2">
                                {!feedbackGiven[
                                  getFeedbackUiKey(renderedChatId, originalIndex)
                                ] && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={renderedChatId === null}
                                      onClick={() => {
                                        if (renderedChatId !== null) {
                                          handleFeedback(
                                            renderedChatId,
                                            originalIndex,
                                            "up"
                                          );
                                        }
                                      }}
                                      aria-label="Good answer"
                                      title="Good answer"
                                      className={messageActionButtonClass}
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
                                      disabled={renderedChatId === null}
                                      onClick={() => {
                                        if (renderedChatId !== null) {
                                          handleFeedback(
                                            renderedChatId,
                                            originalIndex,
                                            "down"
                                          );
                                        }
                                      }}
                                      aria-label="Needs improvement"
                                      title="Needs improvement"
                                      className={messageActionButtonClass}
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

                                    <button
  type="button"
  onClick={() => {
    setOpenUserMessageMenuKey(null);
    setOpenAiMessageMenuKey(null);
    handleUseResultAsInput(
      String(msg.content || ""),
      renderedChatId,
      originalIndex
    );
  }}
  disabled={!String(msg.content || "").trim() || msg.isStreaming}
  aria-label="Use result as input"
  title="Use result as input"
  className={messageActionButtonClass}
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
    <path d="M4 12h11" />
    <path d="M11 5l7 7-7 7" />
  </svg>
</button>

<button
  type="button"
  onClick={async () => {
    try {
      await navigator.clipboard.writeText(
        String(msg.content || "")
      );

      const keyId = getFeedbackUiKey(
        renderedChatId,
        originalIndex
      );

      setFeedbackUI((prev) => ({
        ...prev,
        [keyId]: "Copied"
      }));

      setTimeout(() => {
        setFeedbackUI((prev) => {
          const copy = { ...prev };
          delete copy[keyId];
          return copy;
        });
      }, 1400);
    } catch (error) {
      console.error("OpenLura copy failed:", error);
    }
  }}
  aria-label="Copy answer"
  title="Copy answer"
  className={messageActionButtonClass}
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
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <rect x="4" y="4" width="11" height="11" rx="2" />
  </svg>
</button>

                                    <button
  type="button"
  onClick={() => {
    if (renderedChatId !== null) {
      resendAiAnswer(renderedChatId, originalIndex);
    }
  }}
  aria-label="Resend answer"
  title="Resend answer"
  className={messageActionButtonClass}
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
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
</button>
                                  </>
                                )}

                                {feedbackUI[
                                  getFeedbackUiKey(renderedChatId, originalIndex)
                                ] && (
                                  <span className="rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/8 px-3 py-2 text-xs text-white/70 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.03)]">
                                    {
                                      feedbackUI[
                                        getFeedbackUiKey(
                                          renderedChatId,
                                          originalIndex
                                        )
                                      ]
                                    }
                                  </span>
                                )}
                              </div>

                {Array.isArray(msg.sources) && msg.sources.length > 0 && (
          <div className="mt-2 w-full max-w-[90%] space-y-2.5 px-0.5 md:mt-3 md:max-w-[78%] md:px-2">
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[12px] text-white/30">🔎</span>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                Sources
              </p>
            </div>

            <div className="space-y-2">
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
                    className="block w-full min-w-0 max-w-full rounded-[20px] border border-white/8 bg-white/[0.035] p-3.5 shadow-[0_10px_18px_rgba(0,0,0,0.07)] ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.05] hover:-translate-y-[1px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)]"
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
                          className="mt-1 max-w-full break-all text-xs text-white/42"
                          style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                        >
                          {domain}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[11px] text-white/44">
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
    activeMessages.length === 0
      ? "mx-auto mt-6 w-full max-w-2xl px-3 md:px-4"
      : "sticky bottom-0 z-[40] mt-auto w-full max-w-2xl bg-[#050510]/[0.985] px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-14px_36px_rgba(5,5,16,0.42)] md:static md:z-auto md:w-full md:max-w-none md:border-0 md:bg-transparent md:px-0 md:pt-0 md:pb-0 md:shadow-none"
  } flex w-full min-w-0 max-w-full overflow-x-hidden items-center gap-2 rounded-[28px] border border-white/10 bg-[#0b1020]/88 shadow-[0_16px_34px_rgba(0,0,0,0.22)] backdrop-blur-2xl md:rounded-b-[28px] md:rounded-t-[28px] md:border-x-0 md:border-b-0 md:border-t md:border-white/8 md:bg-white/[0.04] md:px-4 md:py-4`}
>

                        <button
              type="button"
              onClick={() => {
                if (!isPersonalRoute) {
                  setShowLoginBox(true);
                  return;
                }
                fileRef.current?.click();
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.035] text-lg text-white/74 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_10px_22px_rgba(0,0,0,0.10)] active:scale-95"
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
                  className="h-16 w-16 rounded-2xl border border-white/8 object-cover shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/8 bg-black/72 text-xs text-white/82 ol-interactive transition-[transform,background-color,border-color,color] duration-200 hover:bg-black/84 hover:text-white active:scale-95"
                >
                  ×
                </button>
              </div>
            )}

{workflowPrefill && !image && (
  <div className="flex shrink-0 items-center gap-2 max-w-full">
    <span className="max-w-[180px] truncate rounded-full border border-[#3b82f6]/18 bg-[#3b82f6]/8 px-3 py-1 text-[11px] text-[#bfdbfe]">
      {workflowPrefill.label}
    </span>

    <button
      type="button"
      onClick={clearWorkflowPrefill}
      className="shrink-0 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/62 ol-interactive transition-[background-color,border-color,color] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white"
    >
      Clear
    </button>
  </div>
)}

<textarea
  ref={inputRef}
  value={input}
  onFocus={() => {
    if (window.innerWidth < 768) {
      setMobileMenu(false);

      requestAnimationFrame(() => {
        inputRef.current?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });

        messagesRef.current?.scrollTo({
          top: messagesRef.current.scrollHeight,
          behavior: "auto",
        });
      });
    }
  }}
  onChange={(e) => {
    const nextValue = e.target.value;
    setInput(nextValue);

    if (!nextValue.trim() && workflowPrefill) {
      clearWorkflowPrefill();
    }

    if (savePromptSuccess) {
      setSavePromptSuccess(false);
    }

    if (savePromptError) {
      setSavePromptError("");
    }
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
  disabled={upgradeNotice.visible}
  className={`${composerInputClass} min-h-[48px] max-h-[140px] flex-1 rounded-2xl bg-transparent px-2 py-2.5 text-[16px] leading-6 text-white/95 outline-none placeholder:text-white/28 focus:bg-white/[0.02] md:px-3 disabled:opacity-40 disabled:cursor-not-allowed`}
  placeholder={upgradeNotice.visible ? "Limiet bereikt — upgrade om door te gaan" : activeMessages.length === 0 ? "Ask anything" : "Message OpenLura..."}
  enterKeyHint="send"
  rows={1}
/>

<button
  type="button"
  disabled={!loading && !input.trim() && !image}
  onClick={loading ? stopStreaming : sendMessage}
  className={`flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-xl ol-interactive transition-[transform,filter,background-color,color,box-shadow,opacity] duration-200 active:scale-[0.97] disabled:cursor-not-allowed ${
    loading
      ? "bg-red-500 text-white shadow-[0_10px_24px_rgba(239,68,68,0.30)]"
      : !input.trim() && !image
      ? "bg-white/[0.07] text-white/24 shadow-none"
      : "bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-[0_12px_24px_rgba(59,130,246,0.26)] hover:brightness-110"
  }`}
>
  {loading ? "■" : "↑"}
</button>
          </div>

        </div>
      </div>

      {isPersonalRoute ? (
        <button
          type="button"
          onClick={handlePersonalLogout}
          className="fixed right-4 top-[max(env(safe-area-inset-top),16px)] z-[60] hidden rounded-full border border-white/8 bg-white/[0.05] px-3.5 py-2 text-sm text-white/78 shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl ol-interactive transition-[transform,background-color,border-color,color,opacity,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_14px_30px_rgba(0,0,0,0.20)] active:scale-95 md:inline-flex"
        >
          Log out
        </button>
      ) : (
        <div className="fixed right-4 top-[max(env(safe-area-inset-top),16px)] z-[60] hidden items-center gap-2 md:flex">
          <a
            href="/"
            className="rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-2 text-sm text-white/70 shadow-[0_12px_28px_rgba(0,0,0,0.16)] backdrop-blur-2xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.07] hover:text-white hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)] active:scale-95"
          >
            Home
          </a>

        <button
            type="button"
            onClick={() => setShowLoginBox(true)}
            className="rounded-full border border-white/8 bg-white/[0.05] px-3.5 py-2 text-sm text-white/78 shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_14px_30px_rgba(0,0,0,0.20)] active:scale-95"
          >
            Log in
          </button>
        </div>
      )}

      {showLoginBox && !isPersonalRoute && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/8 bg-[#0b1020]/95 shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl overflow-hidden">
            <div className="flex border-b border-white/8">
              <button type="button"
                onClick={() => { setLoginTab("login"); setLoginError(""); setRegisterError(""); setRegisterSuccess(""); }}
                className={`flex-1 py-4 text-sm font-medium transition-colors duration-150 ${loginTab === "login" ? "text-white border-b-2 border-[#3b82f6]" : "text-white/40 hover:text-white/70"}`}
              >Inloggen</button>
              <button type="button"
                onClick={() => { setLoginTab("register"); setLoginError(""); setRegisterError(""); setRegisterSuccess(""); }}
                className={`flex-1 py-4 text-sm font-medium transition-colors duration-150 ${loginTab === "register" ? "text-white border-b-2 border-[#3b82f6]" : "text-white/40 hover:text-white/70"}`}
              >Registreren</button>
            </div>
            <div className="p-6">
              {loginTab === "login" ? (
                <>
                  <div className="mb-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">Persoonlijke omgeving</p>
                    <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white/95">Welkom terug</h2>
                    <p className="mt-1.5 text-sm text-white/50">Log in om je persoonlijke workspace te openen.</p>
                  </div>
                  <div className="space-y-3">
                    <input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="E-mailadres"
                      className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]" />
                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Wachtwoord"
                      className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]"
                      onKeyDown={(e) => { if (e.key === "Enter" && !loginLoading) handlePersonalLogin(); }} />
                    {loginError && <p className="rounded-xl border border-red-400/16 bg-red-500/[0.08] px-3 py-2 text-sm text-red-300">{loginError}</p>}
                  </div>
                  <div className="mt-4">
                    <div className="relative flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-[11px] text-white/28">of</span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `https://imhapciqxtkuefgxkwyv.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + "/auth/callback")}`;
                      }}
                      className="flex w-full items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/88 transition-[background-color,border-color] duration-200 hover:border-white/16 hover:bg-white/[0.07]"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                        <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                      </svg>
                      Doorgaan met Google
                    </button>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => { setShowLoginBox(false); setLoginError(""); setLoginUsername(""); setLoginPassword(""); }}
                      className="flex-1 rounded-[18px] border border-white/8 bg-white/[0.04] p-3 text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white">Annuleren</button>
                    <button type="button" onClick={handlePersonalLogin} disabled={loginLoading}
                      className="flex-1 rounded-[18px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] p-3 text-white shadow-[0_10px_24px_rgba(59,130,246,0.24)] transition-[filter,opacity] hover:brightness-110 disabled:opacity-60">
                      {loginLoading ? "Inloggen..." : "Inloggen"}</button>
                  </div>
                  <p className="mt-4 text-center text-[12px] text-white/36">Nog geen account?{" "}
                    <button type="button" onClick={() => setLoginTab("register")} className="text-[#93c5fd] hover:text-white transition-colors">Registreren</button>
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">Nieuw account</p>
                    <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white/95">Account aanmaken</h2>
                    <p className="mt-1.5 text-sm text-white/50">Maak een account voor je persoonlijke AI workspace.</p>
                  </div>
                  <div className="space-y-3">
                    <input value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="E-mailadres" type="email"
                      className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]" />
                    <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Wachtwoord (min. 6 tekens)"
                      className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]" />
                    <input type="password" value={registerPasswordConfirm} onChange={(e) => setRegisterPasswordConfirm(e.target.value)} placeholder="Herhaal wachtwoord"
                      className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]"
                      onKeyDown={(e) => { if (e.key === "Enter" && !registerLoading) handleRegister(); }} />
                    {registerError && <p className="rounded-xl border border-red-400/16 bg-red-500/[0.08] px-3 py-2 text-sm text-red-300">{registerError}</p>}
                    {registerSuccess && <p className="rounded-xl border border-emerald-400/16 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-300">{registerSuccess}</p>}
                  </div>
                  <div className="mt-4">
                    <div className="relative flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-[11px] text-white/28">of</span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `https://imhapciqxtkuefgxkwyv.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + "/auth/callback")}`;
                      }}
                      className="flex w-full items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/88 transition-[background-color,border-color] duration-200 hover:border-white/16 hover:bg-white/[0.07]"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                        <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                      </svg>
                      Doorgaan met Google
                    </button>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => { setShowLoginBox(false); setRegisterEmail(""); setRegisterPassword(""); setRegisterPasswordConfirm(""); setRegisterError(""); setRegisterSuccess(""); }}
                      className="flex-1 rounded-[18px] border border-white/8 bg-white/[0.04] p-3 text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white">Annuleren</button>
                    <button type="button" onClick={handleRegister} disabled={registerLoading || !!registerSuccess}
                      className="flex-1 rounded-[18px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] p-3 text-white shadow-[0_10px_24px_rgba(59,130,246,0.24)] transition-[filter,opacity] hover:brightness-110 disabled:opacity-60">
                      {registerLoading ? "Account aanmaken..." : "Account aanmaken"}</button>
                  </div>
                  <p className="mt-4 text-center text-[12px] text-white/36">Al een account?{" "}
                    <button type="button" onClick={() => setLoginTab("login")} className="text-[#93c5fd] hover:text-white transition-colors">Inloggen</button>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    <style jsx global>{`
      /* === SCROLLBAR FIX === */
      *::-webkit-scrollbar {
        width: 8px;
      }

      *::-webkit-scrollbar-track {
        background: transparent;
      }

      *::-webkit-scrollbar-thumb {
        background: rgba(59, 130, 246, 0.25);
        border-radius: 999px;
      }

      *::-webkit-scrollbar-thumb:hover {
        background: rgba(59, 130, 246, 0.45);
      }

      /* Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(59,130,246,0.25) transparent;
      }

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

