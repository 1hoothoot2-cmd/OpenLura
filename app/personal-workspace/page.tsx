"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatPage from "@/app/chat/page";

/**
 * Workspace shell — /personal-workspace (and legacy /persoonlijke-omgeving redirect)
 *
 * Responsibilities:
 * - Auth guard with single-pass check + optional refresh
 * - Store redirect hint so post-login returns here
 * - Pass verified userId into ChatPage as workspace context
 * - Entry point for Brain / Photo Studio panel routing (via URL params)
 */

export default function PersonalWorkspacePage() {
  const router = useRouter();
  const [auth, setAuth] = useState<null | {
    authenticated: boolean;
    userId?: string;
  }>(null);

  useEffect(() => {
    // Store redirect hint before auth check
    // so OAuth callback can return here after login
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("ol_login_redirect", "/personal-workspace");
      }
    } catch {}

    async function initAuth() {
      try {
        let res = await fetch("/api/auth", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        let data = await res.json().catch(() => null);

        // Single refresh attempt only when needed — avoids double-fetch on every load
        if (!data?.authenticated) {
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
          userId: typeof data?.runtime?.userId === "string"
            ? data.runtime.userId
            : undefined,
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

  // Loading state — minimal, mobile-friendly
  if (auth === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="h-5 w-5 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
      </div>
    );
  }

  // Redirect fallback (briefly shown before router.replace fires)
  if (!auth.authenticated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="h-5 w-5 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
      </div>
    );
  }

  // Workspace is authenticated — render chat as core, workspace panel routing
  // is handled inside ChatPage via isPersonalRoute detection
  return <ChatPage />;
}