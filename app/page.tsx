"use client";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

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
      pinned: false,
      archived: false,
      messages: [{ role: "ai", content: getGreeting() }],
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (id: number) => {
    const filtered = chats.filter((c) => c.id !== id);
    if (filtered.length === 0) createNewChat();
    else {
      setChats(filtered);
      setActiveChatId(filtered[0].id);
    }
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

      // 🔥 FIX whitespace
      chunk = chunk
        .replace(/\n{3,}/g, "\n\n")
        .replace(/🎯/g, "\n🎯")
        .replace(/📌/g, "\n📌")
        .replace(/💡/g, "\n💡")
        .replace(/(\d\.)/g, "\n$1");

      aiText += chunk;

      updated[index].messages[
        updated[index].messages.length - 1
      ].content = aiText;

      setChats([...updated]);
    }

    setLoading(false);
  };

  const handleImage = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <main className="flex h-screen bg-[#050510] text-white">

      {/* 📱 Mobile toggle */}
      <button
        onClick={() => setMobileMenu(!mobileMenu)}
        className="md:hidden absolute top-3 left-3 z-50"
      >
        ☰
      </button>

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
              onClick={() => {
                setActiveChatId(chat.id);
                setMobileMenu(false);
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
            >
              {chat.title}
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl h-[90%] flex flex-col bg-white/10 rounded-3xl backdrop-blur-2xl">

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {activeChat?.messages.map((msg: any, i: number) => (
              <div key={i}>
                <div className={`p-3 rounded-2xl max-w-[75%] whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 ml-auto"
                    : "bg-white/20"
                }`}>
                  {msg.content}
                </div>

                {msg.image && (
                  <img src={msg.image} className="mt-2 max-w-xs rounded-xl" />
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-150" />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-300" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2 border-t border-white/10 items-center">

            {/* ➕ Image button */}
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xl px-2"
            >
              +
            </button>

            <input
              type="file"
              ref={fileRef}
              onChange={handleImage}
              className="hidden"
            />

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