"use client";

import { useEffect, useState } from "react";
import ChatPage from "@/app/chat/page";

export default function PersoonlijkeOmgevingPage() {
  const [auth, setAuth] = useState<null | {
    authenticated: boolean;
    userId?: string;
  }>(null);

  useEffect(() => {
    async function initAuth() {
      // Refresh het token stil op de achtergrond
      await fetch("/api/auth?action=refresh", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => null);

      fetch("/api/auth", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);

          setAuth({
            authenticated: !!data?.authenticated,
            userId: data?.runtime?.userId,
          });
        })
        .catch(() => {
          setAuth({ authenticated: false });
        });
    }

    initAuth();
  }, []);

  if (auth === null) {
    return <div className="p-6 text-white">Laden...</div>;
  }

  if (!auth.authenticated) {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <p className="text-sm text-white/40">Doorsturen naar login...</p>
      </div>
    );
  }

  return <ChatPage />;
}