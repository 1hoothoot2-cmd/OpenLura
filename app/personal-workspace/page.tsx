"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatPage from "@/app/chat/page";

export default function PersoonlijkeOmgevingPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<null | {
    authenticated: boolean;
    userId?: string;
  }>(null);

  useEffect(() => {
    async function initAuth() {
      try {
        // Check auth first — only refresh if needed
        let res = await fetch("/api/auth", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        let data = await res.json().catch(() => null);

        if (!data?.authenticated) {
          // Token likely expired — try refresh then recheck
          await fetch("/api/auth?action=refresh", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          }).catch(() => null);

          res = await fetch("/api/auth", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          });
          data = await res.json().catch(() => null);
        }

        setAuth({
          authenticated: !!data?.authenticated,
          userId: data?.runtime?.userId,
        });
      } catch {
        setAuth({ authenticated: false });
      }
    }

    initAuth();
  }, []);

  useEffect(() => {
    if (auth !== null && !auth.authenticated) {
      router.replace("/");
    }
  }, [auth, router]);

  if (auth === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="h-6 w-6 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <p className="text-sm text-white/40">Redirecting...</p>
      </div>
    );
  }

  return <ChatPage />;
}