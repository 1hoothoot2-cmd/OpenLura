type Props = {
  mobileMenu: boolean;
  setMobileMenu: (v: boolean) => void;
  createNewChat: () => void;
  search: string;
  setSearch: (v: string) => void;
  searchedPinnedChats: any[];
  regularChats: any[];
  archivedChats: any[];
  deletedChats: any[];
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
};

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
}: Props) {
  const renderChatRow = (chat: any, isPinned: boolean) => {
  const isActive = activeChatId === chat.id;

  return (
    <div
      key={chat.id}
      className={`group relative isolate overflow-visible rounded-[20px] border ol-interactive transition-[transform,background-color,border-color,box-shadow,opacity] duration-200 ${
        isActive
          ? "border-[#3b82f6]/28 bg-[linear-gradient(180deg,rgba(59,130,246,0.18),rgba(59,130,246,0.09))] shadow-[inset_0_0_0_1px_rgba(147,197,253,0.10),0_10px_26px_rgba(15,23,42,0.24)]"
          : isPinned
          ? "border-white/[0.08] bg-white/[0.035] hover:-translate-y-[1px] hover:border-white/[0.12] hover:bg-white/[0.055] hover:shadow-[0_10px_24px_rgba(0,0,0,0.14)]"
          : "border-transparent bg-transparent hover:-translate-y-[1px] hover:border-white/[0.08] hover:bg-white/[0.04] hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)]"
      }`}
    >
      {isPinned && !isActive && (
        <div className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-[#60a5fa] via-[#3b82f6] to-[#1d4ed8] opacity-70" />
      )}

      <button
        type="button"
        onClick={() => {
          activateChat(chat.id);
          setMobileMenu(false);
        }}
        className={`w-full truncate rounded-[20px] py-3 pl-3.5 pr-12 text-left text-sm ol-interactive transition-colors duration-200 ${
          isActive
            ? "text-white"
            : isPinned
            ? "text-white/88 group-hover:text-white"
            : "text-white/72 group-hover:text-white/90"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
              isActive
                ? "bg-[#93c5fd]"
                : isPinned
                ? "bg-[#60a5fa]/80 group-hover:bg-[#93c5fd]"
                : "bg-white/18 group-hover:bg-white/28"
            }`}
          />
          <span className="truncate">{chat.title || "New Chat"}</span>
        </span>
      </button>

      <button
        type="button"
        aria-label="Chat opties"
        onClick={(e) => {
          e.stopPropagation();
          setOpenChatMenuId(openChatMenuId === chat.id ? null : chat.id);
        }}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl border ol-interactive transition-all duration-200 hover:text-white active:scale-95 ${
          openChatMenuId === chat.id
            ? "border-white/10 bg-white/[0.08] text-white opacity-100 shadow-[0_6px_16px_rgba(0,0,0,0.18)]"
            : "border-transparent bg-transparent text-white/42 opacity-100 md:opacity-0 md:scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 hover:border-white/[0.08] hover:bg-white/[0.06]"
        }`}
      >
        ⋯
      </button>

      {openChatMenuId === chat.id && (
        <div className="absolute right-2 top-12 z-[80] min-w-[176px] overflow-hidden rounded-2xl border border-white/10 bg-[#161b2a]/96 shadow-[0_18px_40px_rgba(0,0,0,0.38),0_2px_10px_rgba(0,0,0,0.18)] ring-1 ring-black/20 backdrop-blur-xl animate-[fadeInUp_0.18s_ease-out]">
          <button
            type="button"
            onClick={() => {
              togglePinnedChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3.5 py-2.5 text-left text-sm text-white/88 ol-interactive transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
          >
            {isPinned ? "Unpin" : "Pin"}
          </button>

          <div className="mx-2 border-t border-white/8" />

          <button
            type="button"
            onClick={() => {
              archiveChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3.5 py-2.5 text-left text-sm text-white/88 ol-interactive transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
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
            className="w-full px-3.5 py-2.5 text-left text-sm text-red-300 ol-interactive transition-colors duration-150 hover:bg-white/[0.06] hover:text-red-200"
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
      className={`fixed top-0 left-0 z-50 h-full w-[88vw] max-w-[280px] transform border-r border-white/8 bg-[linear-gradient(180deg,rgba(10,15,29,0.97),rgba(11,18,35,0.94))] p-3 shadow-[0_24px_64px_rgba(0,0,0,0.36)] backdrop-blur-2xl transition-transform duration-300 md:relative md:top-auto md:left-auto md:z-auto md:w-[292px] md:max-w-none md:translate-x-0 md:rounded-[28px] md:border md:border-white/8 md:shadow-[0_18px_42px_rgba(0,0,0,0.22)] ${
        mobileMenu ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={() => {
            createNewChat();
            setMobileMenu(false);
          }}
          className="mb-3 rounded-2xl border border-[#60a5fa]/18 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] px-3.5 py-2.5 text-sm font-medium text-white shadow-[0_12px_30px_rgba(59,130,246,0.26)] ol-interactive transition-[transform,filter,box-shadow] duration-200 hover:brightness-110 hover:shadow-[0_16px_36px_rgba(59,130,246,0.32)] active:scale-[0.985]"
        >
          + New Chat
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          className="mb-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-sm text-white/88 outline-none placeholder:text-white/28 ol-surface transition-[border-color,background-color,box-shadow] duration-200 focus:border-[#60a5fa]/28 focus:bg-white/[0.06] focus:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.08)]"
        />

        <div className="mt-2 flex-1 space-y-5 overflow-y-auto pr-1 pb-[max(env(safe-area-inset-bottom),12px)]">
          {searchedPinnedChats.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/34">
                Pinned
              </span>
              <span className="rounded-full border border-[#3b82f6]/14 bg-[#3b82f6]/8 px-2 py-0.5 text-[10px] text-[#bfdbfe]">
                {searchedPinnedChats.length}
              </span>
            </div>
              <div className="space-y-2">
                {searchedPinnedChats.map((chat) => renderChatRow(chat, true))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Chats
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-0.5 text-[10px] text-white/42">
                {regularChats.length}
              </span>
            </div>
            <div className="space-y-2">
              {regularChats.length > 0 ? (
                regularChats.map((chat) => renderChatRow(chat, false))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.022] px-3 py-2.5 text-sm text-white/32">
                  No chats found
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/26">
                Archived
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/34">
                {archivedChats.length}
              </span>
            </div>
            <div className="space-y-2">
              {archivedChats.length > 0 ? (
                archivedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.022] px-3 py-2.5 text-sm ol-interactive transition-[transform,background-color,border-color] duration-200 hover:-translate-y-[1px] hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <span className="flex-1 text-left text-white/42 ol-interactive transition-colors duration-200 group-hover:text-white/56">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        restoreArchivedChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className="rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/8 px-3 py-1 text-xs text-white/70 ol-interactive transition-[transform,background-color,border-color,color] duration-200 hover:border-[#3b82f6]/36 hover:bg-[#3b82f6]/12 hover:text-white active:scale-95"
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.022] px-3 py-2.5 text-sm text-white/32">
                  No archived chats
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1">
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
                    onClick={clearDeletedChats}
                    className="text-[10px] uppercase tracking-[0.16em] text-red-300/74 ol-interactive transition-colors duration-150 hover:text-red-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {deletedChats.length > 0 ? (
                deletedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between rounded-2xl border border-red-400/10 bg-red-500/[0.035] px-3 py-2.5 text-sm ol-interactive transition-[transform,background-color,border-color] duration-200 hover:-translate-y-[1px] hover:border-red-400/16 hover:bg-red-500/[0.06]"
                  >
                    <span className="flex-1 text-white/34 line-through ol-interactive transition-colors duration-200 group-hover:text-white/44">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        restoreDeletedChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className="rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/8 px-3 py-1 text-xs text-white/70 ol-interactive transition-[transform,background-color,border-color,color] duration-200 hover:border-[#3b82f6]/36 hover:bg-[#3b82f6]/12 hover:text-white active:scale-95"
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.022] px-3 py-2.5 text-sm text-white/32">
                  No deleted chats
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-white/8 pt-3.5 pb-[max(env(safe-area-inset-bottom),0px)]">
          <button
            type="button"
            onClick={() => setShowFeedbackBox(true)}
            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[transform,background-color,border-color,color] duration-200 hover:-translate-y-[1px] hover:border-white/12 hover:bg-white/[0.06] hover:text-white active:scale-[0.985]"
          >
            Feedback / Idea
          </button>

          {!isPersonalRoute && (
            <button
              type="button"
              onClick={() => setShowLoginBox(true)}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive transition-[transform,background-color,border-color,color] duration-200 hover:-translate-y-[1px] hover:border-white/12 hover:bg-white/[0.06] hover:text-white active:scale-[0.985]"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}