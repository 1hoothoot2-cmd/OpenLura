"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatPage from "@/app/chat/page";

export default function PersonalWorkspaceChatPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<null | { authenticated: boolean }>(null);

  useEffect(() => {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("ol_login_redirect", "/personal-workspace/chat");
      }
    } catch {}

    async function initAuth() {
      try {
        let res = await fetch("/api/auth", { method: "GET", credentials: "same-origin", cache: "no-store" });
        let data = await res.json().catch(() => null);

        if (!data?.authenticated) {
          await fetch("/api/auth?action=refresh", { method: "GET", credentials: "same-origin", cache: "no-store" }).catch(() => null);
          res = await fetch("/api/auth", { method: "GET", credentials: "same-origin", cache: "no-store" });
          data = await res.json().catch(() => null);
        }

        setAuth({ authenticated: !!data?.authenticated });
      } catch {
        setAuth({ authenticated: false });
      }
    }

    initAuth();
  }, []);

  if (auth === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="h-5 w-5 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#07070f] px-5">
        <div className="mb-6 h-10 w-10 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04]">
          <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-xl font-semibold text-white/92 mb-2 text-center">Sign in to chat</h1>
        <p className="text-sm text-white/44 text-center mb-8 max-w-xs">Your personal AI chat requires an account.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a href="/" className="w-full rounded-[14px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] py-3.5 text-sm font-semibold text-white text-center shadow-[0_6px_16px_rgba(59,130,246,0.28)] transition-[filter] hover:brightness-110">
            Sign in
          </a>
          <a href="/" className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] py-3.5 text-sm font-medium text-white/80 text-center transition-[background-color,border-color] hover:bg-white/[0.08] hover:text-white">
            Create free account
          </a>
        </div>
      </div>
    );
  }

  return <ChatPage />;
}