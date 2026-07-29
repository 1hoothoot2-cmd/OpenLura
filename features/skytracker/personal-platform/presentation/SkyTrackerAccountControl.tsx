"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkyTrackerFavorites } from "../../favorites/domain/favorites";
import { SkyGuideMemoryPanel } from "./SkyGuideMemoryPanel";

export type AccountState =
  | Readonly<{ status: "loading" | "guest" }>
  | Readonly<{ status: "account"; displayName: string | null }>
  | Readonly<{ status: "unavailable" }>;

export function SkyTrackerAccountControl({
  localFavorites,
  onFavoritesMerged,
  onAccountStateChange,
}: {
  localFavorites: SkyTrackerFavorites;
  onFavoritesMerged: (favorites: SkyTrackerFavorites) => void;
  onAccountStateChange?: (state: AccountState) => void;
}) {
  const [account, setAccount] = useState<AccountState>({ status: "loading" });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const fetchAccount = useCallback(async (): Promise<AccountState> => {
    try {
      const response = await fetch("/api/skytracker/account", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const result = await response.json() as {
        mode?: string;
        profile?: { displayName?: string | null };
      };
      if (response.ok && result.mode === "account") {
        return {
          status: "account",
          displayName: result.profile?.displayName ?? null,
        };
      }
      return response.ok && result.mode === "guest"
        ? { status: "guest" }
        : { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchAccount().then((nextAccount) => {
      if (active) {
        setAccount(nextAccount);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchAccount]);

  useEffect(() => {
    onAccountStateChange?.(account);
  }, [account, onAccountStateChange]);

  async function authenticate() {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(
          mode === "register"
            ? { action: "signup", email: email.trim(), password }
            : { username: email.trim(), password },
        ),
      });
      const result = await response.json() as {
        success?: boolean;
        requiresConfirmation?: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        setMessage(result.error ?? "Authentication failed");
        return;
      }
      if (result.requiresConfirmation) {
        setMessage("Check your email to confirm your account.");
        return;
      }
      const syncResponse = await fetch("/api/skytracker/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ favorites: localFavorites }),
      });
      const syncResult = await syncResponse.json() as {
        favorites?: SkyTrackerFavorites;
      };
      if (syncResponse.ok && syncResult.favorites) {
        onFavoritesMerged(syncResult.favorites);
      }
      setAccount(await fetchAccount());
      setOpen(false);
    } catch {
      setMessage("Account service is temporarily unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth", {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => null);
    setAccount({ status: "guest" });
    setOpen(false);
  }

  const label =
    account.status === "account"
      ? account.displayName || "Account"
      : account.status === "loading"
        ? "Checking account"
        : "Guest";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`SkyTracker account: ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="ol-interactive min-h-11 rounded-full border border-white/10 px-3 text-xs font-semibold text-white/62 hover:border-cyan-200/20 hover:bg-cyan-200/[0.06] hover:text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        {label}
      </button>
      {open && (
        <section
          aria-label="SkyTracker account"
          className="absolute right-0 top-12 z-50 w-[min(21rem,calc(100vw-1.5rem))] rounded-[20px] border border-cyan-200/14 bg-[#07101b]/98 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl"
        >
          {account.status === "account" ? (
            memoryOpen ? (
              <SkyGuideMemoryPanel onClose={() => setMemoryOpen(false)} />
            ) : <>
              <p className="text-sm font-semibold text-white/88">Account active</p>
              <p className="mt-1 text-xs leading-5 text-white/48">
                Favorites are synchronized. SkyGuide stores only memory you approve.
              </p>
              <button
                type="button"
                onClick={() => setMemoryOpen(true)}
                className="mt-4 min-h-11 w-full rounded-xl border border-cyan-200/16 bg-cyan-200/[0.05] text-sm text-cyan-50/78 hover:bg-cyan-200/[0.09]"
              >
                Manage SkyGuide Memory
              </button>
              <button
                type="button"
                onClick={logout}
                className="mt-4 min-h-11 w-full rounded-xl border border-white/10 text-sm text-white/68 hover:bg-white/[0.05]"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white/88">Guest Mode</p>
              <p className="mt-1 text-xs leading-5 text-white/48">
                SkyTracker remains fully available without an account.
              </p>
              <div className="mt-4 flex gap-2" role="tablist" aria-label="Account action">
                {(["login", "register"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={mode === item}
                    onClick={() => {
                      setMode(item);
                      setMessage("");
                    }}
                    className="min-h-10 flex-1 rounded-xl border border-white/10 text-xs capitalize text-white/68 aria-selected:border-cyan-200/28 aria-selected:bg-cyan-200/[0.08] aria-selected:text-cyan-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-xs text-white/48">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-200/32"
                />
              </label>
              <label className="mt-3 block text-xs text-white/48">
                Password
                <input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-200/32"
                />
              </label>
              {message && (
                <p role="status" className="mt-3 text-xs leading-5 text-amber-100/72">
                  {message}
                </p>
              )}
              <button
                type="button"
                disabled={
                  submitting ||
                  !email.trim() ||
                  password.length < 8 ||
                  account.status === "unavailable"
                }
                onClick={authenticate}
                className="mt-4 min-h-11 w-full rounded-xl bg-cyan-300 text-sm font-semibold text-[#041019] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? "Please wait…"
                  : mode === "login"
                    ? "Log in"
                    : "Create account"}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
