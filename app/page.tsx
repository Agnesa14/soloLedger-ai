"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import {
  clearMyChatMessages,
  insertMyChatMessage,
  loadMyChatMessages,
  type ChatRole,
} from "../lib/chatMessages";

type ChatApiOk = { reply: string };
type ChatApiErr = { error?: string; code?: string };
type ChatApiResponse = ChatApiOk | ChatApiErr;

type UiMessage = {
  role: ChatRole;
  content: string;
  created_at?: string;
};

function toFriendlyMessage(code?: string, status?: number) {
  switch (code) {
    case "EMPTY_MESSAGE":
      return "Message is empty. Please type something first.";
    case "TOO_LONG":
      return "Message is too long (max 800 characters).";
    case "UNAUTHORIZED":
      return "Unauthorized. Please log in and try again.";
    case "FORBIDDEN":
      return "Access denied or insufficient credits. Please try again later.";
    case "NOT_FOUND":
      return "Service/model not found. Please try again later.";
    case "RATE_LIMIT":
      return "Too many requests. Please wait a moment and try again.";
    case "PROVIDER_ERROR":
      return "The AI provider is currently unavailable. Please try again in a moment.";
    default:
      if (status === 400) return "Message is invalid. Please check your input and try again.";
      if (status === 401) return "Unauthorized. Please log in and try again.";
      if (status === 402 || status === 403)
        return "Access denied or insufficient credits. Please try again later.";
      if (status === 404) return "Service/model not found. Please try again later.";
      if (status === 429) return "Too many requests. Please wait a moment and try again.";
      if (status && status >= 500) return "Server error. Please try again later.";
      return "Something went wrong. Please try again.";
  }
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const canUse = useMemo(() => !authLoading && !!user, [authLoading, user]);

  // Protect this page: if not logged in, redirect to /login
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Load history for the logged-in user
  useEffect(() => {
    if (!canUse) return;

    let cancelled = false;

    (async () => {
      setError("");
      setInfo("");
      try {
        const rows = await loadMyChatMessages(300);
        if (cancelled) return;

        setMessages(
          rows.map((r) => ({ role: r.role, content: r.content, created_at: r.created_at }))
        );

        if (rows.length === 0) setInfo("No history yet. Send your first message.");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load chat history.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canUse]);

  async function callChatApi(message: string) {
    const controller = new AbortController();
    const timeoutMs = 25000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as ChatApiResponse;

      if (!res.ok) {
        const errData = data as ChatApiErr;
        throw new Error(toFriendlyMessage(errData?.code, res.status));
      }

      const okData = data as ChatApiOk;
      return String(okData.reply ?? "").trim();
    } catch (err: any) {
      // Edge case: timeout
      if (err?.name === "AbortError") throw new Error("Request timed out. Please try again.");

      // Edge case: offline / network down
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("You're offline. Check your internet connection and try again.");
      }

      throw new Error(err?.message ?? "Network error. Please try again.");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Edge case: double submit
    if (!canUse || busy) return;

    // Edge case: offline before doing anything
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("You're offline. Check your internet connection and try again.");
      return;
    }

    const charLimit = 800;
    const text = input.trim();

    // Edge case: empty input
    if (!text) {
      setError("Please type a question first.");
      return;
    }

    // Edge case: too long (extra safety; UI also has maxLength)
    if (text.length > charLimit) {
      setError(`Message is too long (max ${charLimit} characters).`);
      return;
    }

    setBusy(true);
    setError("");
    setInfo("");

    try {
      // Save user message (DB + UI)
      await insertMyChatMessage("user", text);
      setMessages((prev) => [...prev, { role: "user", content: text }]);

      setInput("");

      // Call AI
      const reply = await callChatApi(text);
      if (!reply) throw new Error("Empty assistant reply.");

      // Save assistant message (DB + UI)
      await insertMyChatMessage("assistant", reply);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      const msg = String(err?.message ?? "Something went wrong. Please try again.");
      setError(msg);

      // Edge case: expired session / unauthorized -> redirect gracefully
      if (
        msg.toLowerCase().includes("not authenticated") ||
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("session")
      ) {
        setInfo("Your session expired. Please log in again.");
        router.replace("/login");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleClearHistory() {
    if (!canUse || busy) return;

    setBusy(true);
    setError("");
    setInfo("");

    try {
      await clearMyChatMessages();
      setMessages([]);
      setInfo("History cleared (only for your account).");
    } catch (err: any) {
      setError(String(err?.message ?? "Failed to clear history."));
    } finally {
      setBusy(false);
    }
  }

  // Auth loading screen
  if (authLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-gray-50 text-gray-600">
        Loading…
      </main>
    );
  }

  // Redirecting (not logged in)
  if (!user) return null;

  const charLimit = 800;
  const trimmed = input.trim();
  const isEmpty = trimmed.length === 0;
  const isTooLong = trimmed.length > charLimit;
  const canSubmit = !busy && !isEmpty && !isTooLong;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Top bar */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              SoloLedger AI
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Logged in as{" "}
              <span className="font-medium text-slate-900">{user.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Dashboard
            </Link>

            <button
              onClick={handleClearHistory}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              Clear history
            </button>

            <button
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Form card */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-900">Prompt</label>
              <span
                className={`text-xs ${
                  trimmed.length >= charLimit ? "text-red-600" : "text-slate-500"
                }`}
              >
                {trimmed.length}/{charLimit}
              </span>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              maxLength={charLimit}
              placeholder="Type your question here..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(15,23,42,0.08)]"
              disabled={busy}
            />

            {isTooLong ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                Message is too long (max {charLimit} characters).
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {busy ? <Spinner /> : null}
                {busy ? "Thinking…" : "Submit"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("");
                  setError("");
                  setInfo("");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={busy && !input}
              >
                Clear input
              </button>
            </div>
          </form>

          {info ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              {info}
            </div>
          ) : null}

          {/* Show errors even if busy is false/true; keeps feedback clear */}
          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="font-semibold">Error</div>
              <div className="mt-1 text-red-800">{error}</div>
            </div>
          ) : null}
        </section>

        {/* Chat history (bubble style) */}
        <section className="mt-6">
          <div className="h-[520px] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
            {messages.length === 0 ? (
              <div className="text-sm text-slate-500">No messages yet.</div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, idx) => {
                  const isUserMsg = m.role === "user";
                  return (
                    <div
                      key={idx}
                      className={`flex ${isUserMsg ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={[
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                          isUserMsg
                            ? "bg-slate-900 text-white"
                            : "bg-emerald-50 text-slate-900 border border-emerald-200",
                        ].join(" ")}
                      >
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}