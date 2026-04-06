"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SidebarChat = {
  id: number;
  title?: string | null;
  pinned?: boolean;
  archived?: boolean;
  deleted?: boolean;
};

type SidebarPrompt = {
  id: string;
  name?: string | null;
  description?: string | null;
  content?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  last_used_at?: string | null;
};

type Props = {
  mobileMenu: boolean;
  setMobileMenu: (v: boolean) => void;
  createNewChat: () => void;
  search: string;
  setSearch: (v: string) => void;
  searchedPinnedChats: SidebarChat[];
  regularChats: SidebarChat[];
  archivedChats: SidebarChat[];
  deletedChats: SidebarChat[];
  activeChatId: number | null;
  activateChat: (id: number) => void;
  openChatMenuId: number | null;
  setOpenChatMenuId: (id: number | null) => void;
  togglePinnedChat: (id: number) => void;
  archiveChat: (id: number) => void;
  deleteChat: (id: number) => void;
  restoreArchivedChat: (id: number) => void;
  restoreDeletedChat: (id: number) => void;
  clearDeletedChats: () => void;
  isPersonalRoute: boolean;
  setShowFeedbackBox: (v: boolean) => void;
  setShowLoginBox: (v: boolean) => void;
  onOpenSettings?: () => void;
  onOpenDashboard?: () => void;
  onCopyActiveChatMarkdown?: () => void;
  onDownloadActiveChatMarkdown?: () => void;
  userTier?: "free" | "pro" | "admin";
  onRenameChat?: (id: number, title: string) => void;
  userName?: string | null;
};

function AnonUsageIndicator() {
  const [count, setCount] = useState(0);
  const limit = 3;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("openlura_anon_usage");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const now = Date.now();
      if (parsed.resetAt && parsed.resetAt > now) {
        setCount(parsed.count || 0);
      }
    } catch {}
  }, []);

  if (count === 0) return null;

  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${count >= limit ? "bg-red-400/60" : "bg-[#3b82f6]/60"}`}
          style={{ width: `${Math.min((count / limit) * 100, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-white/36 shrink-0">{count}/{limit} berichten</span>
    </div>
  );
}

export default function Sidebar({
  mobileMenu,
  setMobileMenu,
  createNewChat,
  search,
  setSearch,
  searchedPinnedChats,
  regularChats,
  archivedChats,
  deletedChats,
  activeChatId,
  activateChat,
  openChatMenuId,
  setOpenChatMenuId,
  togglePinnedChat,
  archiveChat,
  deleteChat,
  restoreArchivedChat,
  restoreDeletedChat,
  clearDeletedChats,
  isPersonalRoute,
  setShowFeedbackBox,
  setShowLoginBox,
  onOpenSettings,
  onOpenDashboard,
  onCopyActiveChatMarkdown,
  onDownloadActiveChatMarkdown,
  userTier = "free",
  onRenameChat,
  userName,
}: Props) {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
const promptMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [prompts, setPrompts] = useState<SidebarPrompt[]>([]);
const [loadingPrompts, setLoadingPrompts] = useState(false);
const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
const [usingPromptId, setUsingPromptId] = useState<string | null>(null);
const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
const [savingPromptId, setSavingPromptId] = useState<string | null>(null);
const [promptDraft, setPromptDraft] = useState<{
  name: string;
  description: string;
  content: string;
  tagsInput: string;
}>({
  name: "",
  description: "",
  content: "",
  tagsInput: "",
});
const [promptActionMessage, setPromptActionMessage] = useState("");
const [editingChatTitleId, setEditingChatTitleId] = useState<number | null>(null);
const [chatTitleDraft, setChatTitleDraft] = useState("");

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

  const getPromptRequestHeaders = () => {
    const headers: Record<string, string> = {};
    const userId = getOrCreateOpenLuraUserId();

    if (userId) {
      headers["x-openlura-user-id"] = userId;
    }

    return headers;
  };

  const hasPromptContent = (prompt: SidebarPrompt) =>
    !!String(prompt.content || "").trim();

  const normalizePromptTags = (value: string) => {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
      .slice(0, 12)
      .map((tag) => tag.slice(0, 40));
  };

  const sortPrompts = (items: SidebarPrompt[]) => {
    return [...items].sort((a, b) => {
      const aDate = new Date(a.last_used_at || a.created_at || 0).getTime();
      const bDate = new Date(b.last_used_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
  };

  const showPromptMessage = useCallback((message: string, duration = 1800) => {
    setPromptActionMessage(message);

    if (promptMessageTimeoutRef.current) {
      clearTimeout(promptMessageTimeoutRef.current);
    }

    promptMessageTimeoutRef.current = setTimeout(() => {
      setPromptActionMessage("");
      promptMessageTimeoutRef.current = null;
    }, duration);
  }, []);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoadingPrompts(true);

      const res = await fetch("/api/prompts", {
        method: "GET",
        headers: getPromptRequestHeaders(),
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      setPrompts(Array.isArray(data) ? sortPrompts(data) : []);
    } catch (error) {
      console.error("OpenLura prompts load failed:", error);
    } finally {
      setLoadingPrompts(false);
    }
  }, []);

  const resetPromptEditor = () => {
    setEditingPromptId(null);
    setSavingPromptId(null);
    setPromptDraft({
      name: "",
      description: "",
      content: "",
      tagsInput: "",
    });
  };

  const startEditingPrompt = (prompt: SidebarPrompt) => {
    setEditingPromptId(prompt.id);
    setPromptDraft({
      name: String(prompt.name || "").trim(),
      description: String(prompt.description || "").trim(),
      content: String(prompt.content || ""),
      tagsInput: Array.isArray(prompt.tags) ? prompt.tags.join(", ") : "",
    });
    setPromptActionMessage("");
  };

  const handleSavePromptEdit = async (promptId: string) => {
    const trimmedContent = String(promptDraft.content || "").trim();
    const trimmedName = String(promptDraft.name || "").trim();
    const trimmedDescription = String(promptDraft.description || "").trim();
    const normalizedTags = normalizePromptTags(promptDraft.tagsInput || "");

    if (!promptId || savingPromptId) return;

    if (!trimmedContent) {
      showPromptMessage("Prompt content is required");
      return;
    }

    try {
      setSavingPromptId(promptId);
      setPromptActionMessage("");

      const res = await fetch("/api/prompts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getPromptRequestHeaders(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id: promptId,
          name: trimmedName,
          description: trimmedDescription,
          content: trimmedContent,
          tags: normalizedTags,
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
        console.error("OpenLura prompt update failed:", responseJson || responseText);
        showPromptMessage(responseJson?.error || "Failed to update prompt");
        return;
      }

      await fetchPrompts();
      resetPromptEditor();
      showPromptMessage("Prompt updated");

      window.dispatchEvent(new Event("openlura_prompts_refresh"));
      window.dispatchEvent(new Event("openlura_prompts_update"));
    } catch (error) {
      console.error("OpenLura prompt update failed:", error);
      showPromptMessage("Failed to update prompt");
    } finally {
      setSavingPromptId(null);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!promptId || deletingPromptId || savingPromptId) return;

    try {
      setDeletingPromptId(promptId);
      setPromptActionMessage("");

      const res = await fetch("/api/prompts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getPromptRequestHeaders(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id: promptId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("OpenLura prompt delete failed:", text);
        showPromptMessage("Failed to delete prompt");
        return;
      }

      if (editingPromptId === promptId) {
        resetPromptEditor();
      }

      await fetchPrompts();
      showPromptMessage("Prompt deleted");

      window.dispatchEvent(new Event("openlura_prompts_refresh"));
      window.dispatchEvent(new Event("openlura_prompts_update"));
    } catch (error) {
      console.error("OpenLura prompt delete failed:", error);
      showPromptMessage("Failed to delete prompt");
    } finally {
      setDeletingPromptId(null);
    }
  };

  const handleUsePrompt = async (prompt: SidebarPrompt) => {
    if (usingPromptId || savingPromptId || editingPromptId === prompt.id) return;

    const content = String(prompt.content || "").trim();

    if (!content) {
      showPromptMessage("Prompt is empty");
      return;
    }

    setUsingPromptId(prompt.id);
    setPromptActionMessage("");

    window.dispatchEvent(
      new CustomEvent("openlura_use_prompt", {
        detail: {
          content,
          promptId: prompt.id,
          source: "sidebar_prompt",
          mode: "replace",
        },
      })
    );

    setPrompts((prev) =>
      sortPrompts(
        prev.map((item) =>
          item.id === prompt.id
            ? {
                ...item,
                last_used_at: new Date().toISOString(),
              }
            : item
        )
      )
    );

    showPromptMessage("Prompt added to input", 1600);
    setMobileMenu(false);

    window.setTimeout(() => {
      setUsingPromptId((current) => (current === prompt.id ? null : current));
    }, 1600);
  };

  useEffect(() => {
    if (openChatMenuId === null) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (!target) return;
      if (sidebarRef.current?.contains(target)) return;

      setOpenChatMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenChatMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openChatMenuId, setOpenChatMenuId]);

  useEffect(() => {
    if (!mobileMenu) {
      setOpenChatMenuId(null);
    }
  }, [mobileMenu, setOpenChatMenuId]);

  useEffect(() => {
    if (editingPromptId && !prompts.some((prompt) => prompt.id === editingPromptId)) {
      resetPromptEditor();
    }
  }, [editingPromptId, prompts]);

  useEffect(() => {
    setOpenChatMenuId(null);
    resetPromptEditor();
  }, [activeChatId, setOpenChatMenuId]);

  useEffect(() => {
    fetchPrompts();

    const handlePromptRefresh = () => {
      fetchPrompts();
    };

    window.addEventListener("openlura_prompts_refresh", handlePromptRefresh);
    window.addEventListener("openlura_prompts_update", handlePromptRefresh);

    return () => {
      window.removeEventListener("openlura_prompts_refresh", handlePromptRefresh);
      window.removeEventListener("openlura_prompts_update", handlePromptRefresh);
    };
  }, [fetchPrompts]);

  useEffect(() => {
    return () => {
      if (promptMessageTimeoutRef.current) {
        clearTimeout(promptMessageTimeoutRef.current);
      }
    };
  }, []);

  const sidebarActionButtonClass =
    "rounded-full border border-[#3b82f6]/18 bg-[#3b82f6]/8 px-3 py-1 text-xs text-white/68 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-[#3b82f6]/34 hover:bg-[#3b82f6]/12 hover:text-white hover:shadow-[0_6px_14px_rgba(59,130,246,0.12)] active:scale-95";

  const emptyStateClass =
    "rounded-2xl border border-dashed border-white/8 bg-white/[0.022] px-3 py-2.5 text-[12px] leading-5 text-white/36 break-words";

  const hasActiveChat =
    activeChatId !== null &&
    [...searchedPinnedChats, ...regularChats].some((chat) => chat.id === activeChatId);

  const renderChatRow = (chat: SidebarChat, isPinned: boolean) => {
  const isActive = activeChatId === chat.id;
  const isMenuOpen = openChatMenuId === chat.id;

  return (
    <div
      key={chat.id}
      className={`group relative overflow-visible rounded-[20px] border transition-[transform,background-color,border-color,box-shadow,opacity] duration-200 ${
        isMenuOpen ? "z-[220]" : "z-0"
      } ${
        isActive
          ? "border-[#60a5fa]/48 bg-[linear-gradient(180deg,rgba(59,130,246,0.28),rgba(37,99,235,0.14))] shadow-[inset_0_0_0_1px_rgba(219,234,254,0.14),0_18px_36px_rgba(15,23,42,0.28)]"
          : isPinned
          ? "border-white/[0.09] bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:-translate-y-[1px] hover:border-white/[0.14] hover:bg-white/[0.065] hover:shadow-[0_12px_24px_rgba(0,0,0,0.14)]"
          : "border-transparent bg-transparent hover:-translate-y-[1px] hover:border-white/[0.08] hover:bg-white/[0.045] hover:shadow-[0_8px_18px_rgba(0,0,0,0.10)]"
      }`}
    >
      {isPinned && !isActive && (
        <div className="pointer-events-none absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-gradient-to-b from-[#dbeafe] via-[#60a5fa] to-[#2563eb] opacity-80" />
      )}

      {isActive && (
        <>
          <div className="pointer-events-none absolute inset-y-[7px] left-0 w-[3px] rounded-full bg-gradient-to-b from-[#eff6ff] via-[#93c5fd] to-[#3b82f6]" />
          <div className="pointer-events-none absolute inset-[1px] rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))]" />
        </>
      )}

      <button
        type="button"
        onClick={() => {
          activateChat(chat.id);
          setMobileMenu(false);
        }}
        className={`relative w-full rounded-[20px] py-3.5 pl-4 pr-12 text-left text-sm transition-colors duration-200 focus-visible:outline-none ${
          isActive
            ? "text-white"
            : isPinned
            ? "text-white/90 group-hover:text-white"
            : "text-white/70 group-hover:text-white/88"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`mt-[1px] h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200 ${
              isActive
                ? "bg-[#eff6ff]"
                : isPinned
                ? "bg-[#60a5fa] group-hover:bg-[#93c5fd]"
                : "bg-white/16 group-hover:bg-white/28"
            }`}
          />
          <span className="min-w-0 flex-1 truncate">
            {editingChatTitleId === chat.id ? (
              <input
                autoFocus
                value={chatTitleDraft}
                onChange={(e) => setChatTitleDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = chatTitleDraft.trim();
                  if (trimmed && onRenameChat) onRenameChat(chat.id, trimmed);
                  setEditingChatTitleId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const trimmed = chatTitleDraft.trim();
                    if (trimmed && onRenameChat) onRenameChat(chat.id, trimmed);
                    setEditingChatTitleId(null);
                  }
                  if (e.key === "Escape") setEditingChatTitleId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full rounded-lg border border-white/14 bg-white/[0.06] px-2 py-0.5 text-sm text-white outline-none"
                maxLength={60}
              />
            ) : (
              <span
                className={`block truncate transition-[color,opacity,font-weight] duration-200 ${
                  isActive
                    ? "font-semibold tracking-[-0.01em] text-white"
                    : isPinned
                    ? "font-medium text-white/92"
                    : "font-normal text-white/78"
                }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setChatTitleDraft(chat.title || "");
                  setEditingChatTitleId(chat.id);
                }}
              >
                {chat.title || "New Chat"}
              </span>
            )}
          </span>
        </span>
      </button>

      <button
        type="button"
        aria-label="Chat opties"
        aria-expanded={isMenuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setOpenChatMenuId(isMenuOpen ? null : chat.id);
        }}
        className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-xl border transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none active:scale-95 touch-manipulation ${
          isMenuOpen
            ? "border-white/12 bg-white/[0.09] text-white opacity-100 shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
            : "border-transparent bg-transparent text-white/40 opacity-100 md:opacity-0 md:scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white/88"
        }`}
      >
        ⋯
      </button>

      {isMenuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-2.5 top-[44px] z-[230] min-w-[182px] overflow-hidden rounded-2xl border border-white/10 bg-[#161b2a]/96 shadow-[0_20px_44px_rgba(0,0,0,0.40),0_2px_10px_rgba(0,0,0,0.18)] ring-1 ring-black/20 backdrop-blur-xl animate-[fadeInUp_0.18s_ease-out]"
        >
          <button
            type="button"
            onClick={() => {
              togglePinnedChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3.5 py-2.5 text-left text-sm text-white/88 transition-[background-color,color] duration-150 hover:bg-white/[0.06] hover:text-white"
          >
            {isPinned ? "Unpin" : "Pin"}
          </button>

          <div className="mx-2 border-t border-white/8" />

          <button
            type="button"
            onClick={() => {
              setChatTitleDraft(chat.title || "");
              setEditingChatTitleId(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3.5 py-2.5 text-left text-sm text-white/88 transition-[background-color,color] duration-150 hover:bg-white/[0.06] hover:text-white"
          >
            Rename
          </button>

          <div className="mx-2 border-t border-white/8" />

          <button
            type="button"
            onClick={() => {
              archiveChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3.5 py-2.5 text-left text-sm text-white/88 transition-[background-color,color] duration-150 hover:bg-white/[0.06] hover:text-white"
          >
            Archive
          </button>

          <div className="mx-2 border-t border-white/8" />

          <button
            type="button"
            onClick={() => {
              deleteChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3.5 py-2.5 text-left text-sm text-red-300 transition-[background-color,color] duration-150 hover:bg-white/[0.06] hover:text-red-200"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

  return (
    <div
      ref={sidebarRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`fixed top-0 left-0 z-50 h-[100dvh] w-[88vw] max-w-[280px] transform overflow-hidden border-r border-white/8 bg-[linear-gradient(180deg,rgba(10,15,29,0.98),rgba(11,18,35,0.95))] p-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_24px_64px_rgba(0,0,0,0.36)] backdrop-blur-2xl transition-transform duration-300 md:relative md:top-auto md:left-auto md:z-auto md:h-full md:w-[292px] md:max-w-none md:translate-x-0 md:rounded-[28px] md:border md:border-white/8 md:p-3 md:shadow-[0_18px_42px_rgba(0,0,0,0.22)] ${
        mobileMenu ? "translate-x-0" : "-translate-x-full"
      }`}
    >
            <div className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-20 -mx-3 mb-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(10,15,29,0.98),rgba(10,15,29,0.92))] px-3 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-2xl md:mx-0 md:border-b-0 md:bg-transparent md:px-0 md:pb-1 md:pt-0">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3 px-1">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#3b82f6]/18 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.16),rgba(29,78,216,0.06)_52%,transparent_78%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_10px_22px_rgba(29,78,216,0.12)]">
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
                {userName && (
                  <div className="mt-0.5 text-[11px] text-white/46">
                    {userName}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => {
                setOpenChatMenuId(null);
                setMobileMenu(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-white/72 ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-95 md:hidden"
            >
              ×
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              createNewChat();
              setOpenChatMenuId(null);
              setMobileMenu(false);
            }}
            className="mb-3 w-full rounded-2xl border border-[#60a5fa]/18 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] px-3.5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(59,130,246,0.26)] ol-interactive transition-[transform,filter,box-shadow,opacity] duration-200 hover:brightness-110 hover:shadow-[0_16px_36px_rgba(59,130,246,0.32)] active:scale-[0.985]"
          >
            + New Chat
          </button>

          <input
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Search chats..."
  className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-sm text-white/88 outline-none placeholder:text-white/28 ol-surface transition-[border-color,background-color,box-shadow] duration-200 focus:border-[#60a5fa]/28 focus:bg-white/[0.06] focus:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.08)]"
/>
        </div>

        <div className="mt-1 min-h-0 flex-1 space-y-6 overflow-x-visible overflow-y-auto pr-1 pb-4 pt-2">
          {searchedPinnedChats.length > 0 && (
            <div>
              <div className="mb-3.5 flex items-center justify-between px-1.5">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/36">
                  Pinned
                </span>
                <span className="rounded-full border border-[#3b82f6]/14 bg-[#3b82f6]/8 px-2 py-0.5 text-[10px] text-[#bfdbfe]">
                  {searchedPinnedChats.length}
                </span>
              </div>
              <div className="space-y-2.5 overflow-visible">
                {searchedPinnedChats.map((chat: SidebarChat) => renderChatRow(chat, true))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1.5">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Chats
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-0.5 text-[10px] text-white/42">
                {regularChats.length}
              </span>
            </div>
            <div className="space-y-2.5 overflow-visible">
              {regularChats.length > 0 ? (
                regularChats.map((chat: SidebarChat) => renderChatRow(chat, false))
              ) : (
                <div className={emptyStateClass}>
                  {isPersonalRoute ? (
                    <button
                      type="button"
                      onClick={() => createNewChat()}
                      className="w-full text-left text-white/40 hover:text-white/70 transition-colors"
                    >
                      + Start je eerste chat
                    </button>
                  ) : "No chats found"}
                </div>
              )}
            </div>
          </div>

          {isPersonalRoute && <div>
            <div className="mb-2.5 flex items-center justify-between px-1.5">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Prompts
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-0.5 text-[10px] text-white/42">
                {prompts.length}
              </span>
            </div>

            {!!promptActionMessage && (
              <div className="mb-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-white/58">
                {promptActionMessage}
              </div>
            )}

            <div className="space-y-2.5">
              {loadingPrompts ? (
                <div className={emptyStateClass}>
                  Loading prompts...
                </div>
              ) : prompts.length > 0 ? (
                prompts.map((prompt: SidebarPrompt) => {
                  const isEditing = editingPromptId === prompt.id;
                  const isSaving = savingPromptId === prompt.id;
                  const isDeleting = deletingPromptId === prompt.id;

                  return (
                    <div
                      key={prompt.id}
                      className={`group rounded-[18px] border px-3 py-2.5 transition-[background-color,border-color,box-shadow,transform] duration-200 ${
                        isEditing
                          ? "border-[#3b82f6]/18 bg-[#3b82f6]/[0.06] shadow-[0_10px_22px_rgba(59,130,246,0.08)]"
                          : "border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.045] hover:shadow-[0_8px_16px_rgba(0,0,0,0.10)]"
                      }`}
                    >
                      {isEditing ? (
                        <div
                          className="space-y-2.5"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          <input
                            value={promptDraft.name}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setPromptDraft((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Prompt name"
                            className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/88 outline-none placeholder:text-white/28"
                          />

                          <input
                            value={promptDraft.description}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setPromptDraft((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Description"
                            className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/88 outline-none placeholder:text-white/28"
                          />

                          <textarea
                            value={promptDraft.content}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setPromptDraft((prev) => ({
                                ...prev,
                                content: e.target.value,
                              }))
                            }
                            placeholder="Prompt content"
                            rows={4}
                            className="w-full resize-none rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/88 outline-none placeholder:text-white/28"
                          />

                          <input
                            value={promptDraft.tagsInput}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setPromptDraft((prev) => ({
                                ...prev,
                                tagsInput: e.target.value,
                              }))
                            }
                            placeholder="Tags (comma separated)"
                            className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/88 outline-none placeholder:text-white/28"
                          />

                          {!!normalizePromptTags(promptDraft.tagsInput).length && (
                            <div className="flex flex-wrap gap-1.5">
                              {normalizePromptTags(promptDraft.tagsInput).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-[#3b82f6]/16 bg-[#3b82f6]/10 px-2 py-1 text-[10px] text-[#bfdbfe]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={resetPromptEditor}
                              disabled={isSaving}
                              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/72 transition-[background-color,border-color,color,opacity] duration-200 hover:border-white/16 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSavePromptEdit(prompt.id)}
                              disabled={isSaving}
                              className="rounded-full border border-[#3b82f6]/16 bg-[#3b82f6]/10 px-3 py-1.5 text-[11px] text-[#bfdbfe] transition-[background-color,border-color,color,opacity] duration-200 hover:border-[#3b82f6]/28 hover:bg-[#3b82f6]/16 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUsePrompt(prompt)}
                            disabled={!hasPromptContent(prompt) || usingPromptId === prompt.id}
                            className="flex w-full min-w-0 items-start justify-between gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform duration-100"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-white/86 group-hover:text-white">
                                {prompt.name || "Untitled prompt"}
                              </div>

                              {!!String(prompt.description || "").trim() && (
                                <div className="mt-1 line-clamp-1 text-[11px] leading-5 text-white/32 group-hover:text-white/46">
                                  {String(prompt.description || "")}
                                </div>
                              )}

                              {!!String(prompt.content || "").trim() && (
                                <div className="mt-1 line-clamp-1 text-[11px] leading-5 text-white/34 group-hover:text-white/50">
                                  {String(prompt.content || "")}
                                </div>
                              )}

                              {!!prompt.tags?.length && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {prompt.tags.slice(0, 2).map((tag) => (
                                    <span
                                      key={`${prompt.id}-${tag}`}
                                      className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {prompt.tags.length > 3 && (
                                    <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/38">
                                      +{prompt.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <span className="shrink-0 text-[11px] text-white/26 group-hover:text-white/42">
                              {usingPromptId === prompt.id
                                ? "Added"
                                : hasPromptContent(prompt)
                                ? "Use in chat"
                                : "Empty"}
                            </span>
                          </button>

                          <div className="mt-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button
                              type="button"
                              onClick={() => startEditingPrompt(prompt)}
                              disabled={isDeleting}
                              className="rounded-full border border-white/10 bg-transparent px-2.5 py-1 text-[10px] text-white/64 transition-[background-color,border-color,color,opacity] duration-200 hover:border-white/18 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePrompt(prompt.id)}
                              disabled={isDeleting}
                              className="rounded-full border border-red-400/16 bg-transparent px-2.5 py-1 text-[10px] text-red-200/72 transition-[background-color,border-color,color,opacity] duration-200 hover:border-red-400/28 hover:bg-red-500/[0.06] hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className={emptyStateClass}>
                  {isPersonalRoute
                    ? "Sla berichten op via ⋯"
                    : "No saved prompts yet"}
                </div>
              )}
            </div>
          </div>}

          {!isPersonalRoute && (
            <div className="rounded-[20px] border border-[#3b82f6]/14 bg-[#3b82f6]/[0.04] px-3 py-3">
              <div className="text-[11px] font-medium text-[#bfdbfe] mb-1">✨ Persoonlijke omgeving</div>
              <p className="text-[11px] text-white/46 leading-5 mb-2.5">Meld je aan voor opgeslagen prompts, cross-device geheugen en meer.</p>
              <AnonUsageIndicator />
              <button
                type="button"
                onClick={() => { setMobileMenu(false); window.location.href = "/login"; }}
                className="w-full rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-3 py-2 text-[12px] font-medium text-white mt-2"
              >
                Aanmelden →
              </button>
            </div>
          )}

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1.5">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/26">
                Archived
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/34">
                {archivedChats.length}
              </span>
            </div>
            <div className="space-y-3.5">
              {archivedChats.length > 0 ? (
                archivedChats.map((chat: SidebarChat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.022] px-3 py-2.5 text-sm ol-interactive transition-[background-color,border-color,box-shadow] duration-200 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)]"
                  >
                    <span className="flex-1 text-left text-white/40 ol-interactive transition-colors duration-200 group-hover:text-white/54">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenChatMenuId(null);
                        restoreArchivedChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className={sidebarActionButtonClass}
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className={emptyStateClass}>
  No chats found
</div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1.5">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/26">
                Deleted
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-red-400/10 bg-red-500/[0.04] px-2 py-0.5 text-[10px] text-red-200/70">
                  {deletedChats.length}
                </span>
                {deletedChats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenChatMenuId(null);
                      clearDeletedChats();
                    }}
                    className="text-[10px] uppercase tracking-[0.16em] text-red-300/74 ol-interactive transition-colors duration-150 hover:text-red-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {deletedChats.length > 0 ? (
                deletedChats.map((chat: SidebarChat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between rounded-2xl border border-red-400/10 bg-red-500/[0.034] px-3 py-2.5 text-sm ol-interactive transition-[background-color,border-color,box-shadow] duration-200 hover:border-red-400/16 hover:bg-red-500/[0.056] hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)]"
                  >
                    <span className="flex-1 text-white/32 line-through ol-interactive transition-colors duration-200 group-hover:text-white/42">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenChatMenuId(null);
                        restoreDeletedChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className={sidebarActionButtonClass}
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className={emptyStateClass}>
  No deleted chats
</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 shrink-0 space-y-2.5 border-t border-white/8 pt-4 pb-[max(env(safe-area-inset-bottom),2px)]">
          {isPersonalRoute && (
            <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-2">
              <div className="mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-white/30">
                Export
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenChatMenuId(null);
                    onCopyActiveChatMarkdown?.();
                    setMobileMenu(false);
                  }}
                  disabled={!hasActiveChat || !onCopyActiveChatMarkdown}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[background-color,border-color,color,box-shadow,opacity] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copy .md
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenChatMenuId(null);
                    onDownloadActiveChatMarkdown?.();
                    setMobileMenu(false);
                  }}
                  disabled={!hasActiveChat || !onCopyActiveChatMarkdown}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[background-color,border-color,color,box-shadow,opacity] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Download .md
                </button>
              </div>
            </div>
          )}

          {isPersonalRoute && (
            <div className={`rounded-2xl border px-3 py-2.5 flex items-center justify-between ${
              userTier === "pro" || userTier === "admin"
                ? "border-emerald-400/16 bg-emerald-400/[0.04]"
                : "border-white/8 bg-white/[0.03]"
            }`}>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/30">Plan</div>
                <div className={`text-sm font-medium mt-0.5 ${
                  userTier === "pro" || userTier === "admin"
                    ? "text-emerald-300"
                    : "text-white/60"
                }`}>
                  {userTier === "pro" ? "Go ✓" : userTier === "admin" ? "Admin ✓" : "Free"}
                </div>
              </div>
              {userTier === "free" && (
                <button
                  type="button"
                  onClick={async () => {
                    setOpenChatMenuId(null);
                    setMobileMenu(false);
                    try {
                      const res = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
                      if (res.status === 401) { window.location.href = "/personal-workspace"; return; }
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch {}
                  }}
                  className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-[11px] font-medium text-blue-200 hover:bg-blue-400/16 hover:text-white transition-colors"
                >
                  Upgrade →
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpenChatMenuId(null);
              setMobileMenu(false);
              setShowFeedbackBox(true);
            }}
            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.985]"
          >
            Feedback / Idea
          </button>

          {isPersonalRoute && (
            <button
              type="button"
              onClick={() => {
                setOpenChatMenuId(null);
                setMobileMenu(false);
                onOpenDashboard?.();
              }}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.985]"
            >
              Mijn profiel
            </button>
          )}

          {isPersonalRoute && (
            <a href="/personal-dashboard" onClick={() => setMobileMenu(false)} className="w-full rounded-2xl border border-[#3b82f6]/16 bg-[#3b82f6]/8 px-3 py-2.5 text-left text-sm text-[#93c5fd] ol-interactive transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-[#3b82f6]/28 hover:bg-[#3b82f6]/14 hover:text-white active:scale-[0.985] flex items-center gap-2">
              Dashboard
            </a>
          )}

          {isPersonalRoute && (
            <button
              type="button"
              onClick={() => {
                setOpenChatMenuId(null);
                setMobileMenu(false);
                onOpenSettings?.();
              }}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.985]"
            >
              Instellingen
            </button>
          )}

          {!isPersonalRoute && (
            <button
              type="button"
              onClick={() => {
                setOpenChatMenuId(null);
                setMobileMenu(false);
                setShowLoginBox(true);
              }}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-white/12 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.985]"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}