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
  const renderChatRow = (chat: any, isPinned: boolean) => (
    <div
      key={chat.id}
      className={`group relative rounded-xl transition ${
        activeChatId === chat.id
          ? "bg-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          : "hover:bg-white/10"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          activateChat(chat.id);
          setMobileMenu(false);
        }}
        className="w-full truncate py-2 pl-3 pr-12 text-left text-sm"
      >
        {chat.title || "New Chat"}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpenChatMenuId(openChatMenuId === chat.id ? null : chat.id);
        }}
        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        ⋯
      </button>

      {openChatMenuId === chat.id && (
        <div className="absolute right-2 top-10 z-50 min-w-[140px] overflow-hidden rounded-xl border border-white/10 bg-[#121226] shadow-2xl">
          <button
            type="button"
            onClick={() => {
              togglePinnedChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
          >
            {isPinned ? "Unpin" : "Pin"}
          </button>

          <button
            type="button"
            onClick={() => {
              archiveChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
          >
            Archive
          </button>

          <button
            type="button"
            onClick={() => {
              deleteChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-white/10"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`fixed top-0 left-0 z-50 h-full w-[88vw] max-w-[280px] transform border-r border-white/10 bg-[#0a0a1f]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition-transform duration-300 md:relative md:top-auto md:left-auto md:z-auto md:w-[292px] md:max-w-none md:translate-x-0 md:rounded-[28px] md:border md:border-white/10 ${
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
          className="mb-3 rounded-2xl bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-3 py-2.5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(59,130,246,0.26)] transition hover:brightness-110"
        >
          + New Chat
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          className="mb-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/32 transition focus:border-white/20 focus:bg-white/[0.07]"
        />

        <div className="mt-2 flex-1 space-y-5 overflow-y-auto pr-1">
          {searchedPinnedChats.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                  Pinned
                </span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/45">
                  {searchedPinnedChats.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {searchedPinnedChats.map((chat) => renderChatRow(chat, true))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                Chats
              </span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/45">
                {regularChats.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {regularChats.length > 0 ? (
                regularChats.map((chat) => renderChatRow(chat, false))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm text-white/38">
                  No chats found
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                Archived
              </span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/45">
                {archivedChats.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {archivedChats.length > 0 ? (
                archivedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm transition hover:bg-white/[0.06]"
                  >
                    <span className="flex-1 text-left text-white/72">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        restoreArchivedChat(chat.id);
                        activateChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className="rounded-full border border-[#3b82f6]/25 bg-[#3b82f6]/8 px-3 py-1 text-xs text-white/74 transition hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/14 hover:text-white"
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm text-white/38">
                  No archived chats
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                Deleted
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/45">
                  {deletedChats.length}
                </span>
                {deletedChats.length > 0 && (
                  <button
                    type="button"
                    onClick={clearDeletedChats}
                    className="text-[10px] uppercase tracking-[0.14em] text-red-300 transition hover:text-red-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {deletedChats.length > 0 ? (
                deletedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between rounded-2xl border border-red-400/10 bg-red-500/5 px-3 py-2.5 text-sm transition hover:bg-red-500/10"
                  >
                    <span className="flex-1 text-white/56 line-through">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        restoreDeletedChat(chat.id);
                        activateChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className="rounded-full border border-[#3b82f6]/25 bg-[#3b82f6]/8 px-3 py-1 text-xs text-white/74 transition hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/14 hover:text-white"
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm text-white/38">
                  No deleted chats
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
          <button
            type="button"
            onClick={() => setShowFeedbackBox(true)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-left text-sm text-white/88 transition hover:bg-white/[0.08]"
          >
            Feedback / Idea
          </button>

          {!isPersonalRoute && (
            <button
              type="button"
              onClick={() => setShowLoginBox(true)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-left text-sm text-white/88 transition hover:bg-white/[0.08]"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}