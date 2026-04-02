"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken) {
      router.replace("/chat");
      return;
    }

    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "sync",
        accessToken,
        refreshToken,
      }),
    }).finally(() => {
      router.replace("/persoonlijke-omgeving");
    });
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white">
      <p className="text-white/50 text-sm">Inloggen...</p>
    </div>
  );
}