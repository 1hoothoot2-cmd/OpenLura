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
      className={`group relative rounded-2xl border ol-interactive duration-200 ${
        activeChatId === chat.id
          ? "border-[#3b82f6]/22 bg-[#3b82f6]/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.10)] translate-y-[-1px]"
          : "border-transparent hover:-translate-y-[1px] hover:border-white/10 hover:bg-white/[0.05] hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          activateChat(chat.id);
          setMobileMenu(false);
        }}
        className={`w-full truncate py-2.5 pl-3 pr-12 text-left text-sm ol-interactive-colors duration-200 ${
          activeChatId === chat.id
            ? "text-white/92"
            : isPinned
            ? "text-white/84 group-hover:text-white/92"
            : "text-white/74 group-hover:text-white/88"
        }`}
      >
        {chat.title || "New Chat"}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpenChatMenuId(openChatMenuId === chat.id ? null : chat.id);
        }}
        className={`absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-xl ol-interactive-[background-color,border-color,color,opacity,transform] duration-200 hover:bg-white/[0.07] hover:text-white active:scale-95 ${
          openChatMenuId === chat.id
            ? "bg-white/[0.07] text-white/86 opacity-100"
            : "text-white/40 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
        }`}
      >
        ⋯
      </button>

      {openChatMenuId === chat.id && (
        <div className="absolute right-2 top-11 z-50 min-w-[152px] overflow-hidden rounded-2xl border border-white/8 bg-[#0f1728]/96 shadow-[0_20px_48px_rgba(0,0,0,0.34)] backdrop-blur-2xl animate-[fadeInUp_0.18s_ease-out]">
          <button
            type="button"
            onClick={() => {
              togglePinnedChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3 py-2.5 text-left text-sm text-white/82 ol-interactive-[background-color,color] duration-200 hover:bg-white/[0.06] hover:text-white"
          >
            {isPinned ? "Unpin" : "Pin"}
          </button>

          <button
            type="button"
            onClick={() => {
              archiveChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3 py-2.5 text-left text-sm text-white/82 ol-interactive-[background-color,color] duration-200 hover:bg-white/[0.06] hover:text-white"
          >
            Archive
          </button>

          <button
            type="button"
            onClick={() => {
              deleteChat(chat.id);
              setOpenChatMenuId(null);
            }}
            className="w-full px-3 py-2.5 text-left text-sm text-red-300/90 ol-interactive-[background-color,color] duration-200 hover:bg-white/[0.06] hover:text-red-200"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`fixed top-0 left-0 z-50 h-full w-[88vw] max-w-[280px] transform border-r border-white/8 bg-[#0a0f1d]/95 p-3 shadow-[0_20px_56px_rgba(0,0,0,0.34)] backdrop-blur-2xl ol-interactive-transform duration-300 md:relative md:top-auto md:left-auto md:z-auto md:w-[292px] md:max-w-none md:translate-x-0 md:rounded-[28px] md:border md:border-white/8 ${
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
          className="mb-3 rounded-2xl bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-3 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(59,130,246,0.24)] ol-interactive-[transform,filter,box-shadow] duration-200 hover:brightness-110 active:scale-[0.97]"
        >
          + New Chat
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          className="mb-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-sm text-white/88 outline-none placeholder:text-white/28 ol-interactive-[background-color,border-color,color,box-shadow] duration-200 focus:border-white/14 focus:bg-white/[0.06]"
        />

        <div className="mt-2 flex-1 space-y-5 overflow-y-auto pr-1 pb-[max(env(safe-area-inset-bottom),8px)]">
          {searchedPinnedChats.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                  Pinned
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                  {searchedPinnedChats.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {searchedPinnedChats.map((chat) => renderChatRow(chat, true))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                Chats
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                {regularChats.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {regularChats.length > 0 ? (
                regularChats.map((chat) => renderChatRow(chat, false))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-sm text-white/34">
                  No chats found
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                Archived
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                {archivedChats.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {archivedChats.length > 0 ? (
                archivedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-sm ol-interactive duration-200 hover:-translate-y-[1px] hover:border-white/10 hover:bg-white/[0.045]"
                  >
                    <span className="flex-1 text-left text-white/42 ol-interactive-colors duration-200 group-hover:text-white/56">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        restoreArchivedChat(chat.id);
                        activateChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className="rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/8 px-3 py-1 text-xs text-white/70 ol-interactive duration-200 hover:border-[#3b82f6]/36 hover:bg-[#3b82f6]/12 hover:text-white active:scale-95"
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-sm text-white/34">
                  No archived chats
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                Deleted
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                  {deletedChats.length}
                </span>
                {deletedChats.length > 0 && (
                  <button
                    type="button"
                    onClick={clearDeletedChats}
                    className="text-[10px] uppercase tracking-[0.16em] text-red-300/78 ol-interactive-colors duration-200 hover:text-red-200"
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
                    className="group flex items-center justify-between rounded-2xl border border-red-400/10 bg-red-500/[0.04] px-3 py-2.5 text-sm ol-interactive duration-200 hover:-translate-y-[1px] hover:border-red-400/16 hover:bg-red-500/[0.07]"
                  >
                    <span className="flex-1 text-white/34 line-through ol-interactive-colors duration-200 group-hover:text-white/42">
                      {chat.title || "Chat"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        restoreDeletedChat(chat.id);
                        activateChat(chat.id);
                        setMobileMenu(false);
                      }}
                      className="rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/8 px-3 py-1 text-xs text-white/70 ol-interactive duration-200 hover:border-[#3b82f6]/36 hover:bg-[#3b82f6]/12 hover:text-white active:scale-95"
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-sm text-white/34">
                  No deleted chats
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-white/8 pt-3.5">
          <button
            type="button"
            onClick={() => setShowFeedbackBox(true)}
            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive duration-200 hover:-translate-y-[1px] hover:border-white/12 hover:bg-white/[0.06] hover:text-white active:scale-[0.98] active:scale-[0.98] active:scale-[0.98] active:scale-[0.98]"
          >
            Feedback / Idea
          </button>

          {!isPersonalRoute && (
            <button
              type="button"
              onClick={() => setShowLoginBox(true)}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/82 ol-interactive duration-200 hover:-translate-y-[1px] hover:border-white/12 hover:bg-white/[0.06] hover:text-white active:scale-[0.98] active:scale-[0.98] active:scale-[0.98]"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}