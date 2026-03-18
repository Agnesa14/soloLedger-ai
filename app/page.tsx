"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";

type ChatApiOk = { reply: string };
type ChatApiErr = { error?: string; code?: string };
type ChatApiResponse = ChatApiOk | ChatApiErr;

function toFriendlyMessage(code?: string, status?: number) {
  switch (code) {
    case "EMPTY_MESSAGE":
      return "Message is empty. Please type something first.";
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
      if (status === 400) return "Message is empty. Please type something first.";
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

  const [input, setInput] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastMessageRef = useRef<string>("");

  // Protect this page: if not logged in, redirect to /login
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Focus only when authenticated and ready
  useEffect(() => {
    if (!authLoading && user) textareaRef.current?.focus();
  }, [authLoading, user]);

  async function sendMessage(message: string) {
    setLoading(true);
    setError("");
    setResponse("");

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
        setError(toFriendlyMessage(errData?.code, res.status));
        // keep technical details out of UI
        console.warn("API error:", res.status, errData?.code, errData?.error);
        return;
      }

      const okData = data as ChatApiOk;
      setResponse(String(okData.reply ?? ""));
      setInput("");
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Request timed out. Please try again.");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setError("You're offline. Check your internet connection and try again.");
        return;
      }
      setError("Network error. Please check your internet connection and try again.");
      console.warn("Client/network error:", err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const message = input.trim();
    if (!message) {
      setError("Please type a question first.");
      return;
    }

    setLastPrompt(message);
    lastMessageRef.current = message;

    await sendMessage(message);
  }

  async function handleRetry() {
    const msg = lastMessageRef.current.trim();
    if (!msg || loading) return;

    setLastPrompt(msg);
    await sendMessage(msg);
  }

  function handleClear() {
    setInput("");
    setResponse("");
    setError("");
    setLastPrompt("");
    lastMessageRef.current = "";
    textareaRef.current?.focus();
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
  const canSubmit = !loading && !!input.trim();

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
              Logged in as <span className="font-medium text-slate-900">{user.email}</span>
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
                  input.length >= charLimit ? "text-red-600" : "text-slate-500"
                }`}
              >
                {input.length}/{charLimit}
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              maxLength={charLimit}
              placeholder="Type your question here..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(15,23,42,0.08)]"
              disabled={loading}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? <Spinner /> : null}
                {loading ? "Thinking…" : "Submit"}
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={loading && !input && !response && !error && !lastPrompt}
              >
                Clear
              </button>
            </div>
          </form>

          {/* Loading */}
          {loading ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                <span>Processing…</span>
              </div>
            </div>
          ) : null}

          {/* Error */}
          {error && !loading ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">Error</div>
                  <div className="mt-1 text-red-800">{error}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={!lastMessageRef.current}
                    className="rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-900 shadow-sm transition hover:bg-red-100/40"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Prompt + Response */}
        {(lastPrompt || response) && !loading ? (
          <section className="mt-6 space-y-4">
            {lastPrompt ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
                <h2 className="text-sm font-semibold text-slate-900">Your prompt</h2>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                    {lastPrompt}
                  </p>
                </div>
              </div>
            ) : null}

            {response ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
                <h2 className="text-sm font-semibold text-slate-900">Response</h2>
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                    {response}
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}