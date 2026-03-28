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
  activeChatId,
  activateChat,
  openChatMenuId,
  setOpenChatMenuId,
  togglePinnedChat,
  archiveChat,
  deleteChat,
}: Props) {
  const renderChatRow = (chat: any, isPinned: boolean) => (
    <div
      key={chat.id}
      className={`group relative rounded-xl transition ${
        activeChatId === chat.id ? "bg-white/20" : "hover:bg-white/10"
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
      className={`fixed top-0 left-0 z-50 h-full w-[88vw] max-w-[280px] transform bg-[#0a0a1f] p-3 transition-transform duration-300 md:relative md:top-auto md:left-auto md:z-auto md:w-[280px] md:max-w-none md:translate-x-0 ${
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
          className="mb-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 p-2"
        >
          + New Chat
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          className="mb-3 rounded-xl bg-white/10 p-2 outline-none"
        />

        <div className="mt-2 flex-1 space-y-4 overflow-y-auto">
          {searchedPinnedChats.length > 0 && (
            <div>
              <div className="mb-2 px-1 text-[11px] uppercase opacity-40">
                Pinned
              </div>
              <div className="space-y-1">
                {searchedPinnedChats.map((chat) => renderChatRow(chat, true))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 px-1 text-[11px] uppercase opacity-40">
              Chats
            </div>
            <div className="space-y-1">
              {regularChats.length > 0 ? (
                regularChats.map((chat) => renderChatRow(chat, false))
              ) : (
                <div className="px-3 py-2 text-sm text-white/40">
                  No chats found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}