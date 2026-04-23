"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import { getErrorMessage, hasMessage } from "@/lib/errors";
import {
  buildFinancialSnapshot,
  formatInsightCurrency,
  formatInsightPercent,
  type FinancialSnapshot,
} from "@/lib/financialInsights";
import { buildPlanningSnapshot, loadMyBudgets, loadMySavingsGoals, type PlanningSnapshot } from "@/lib/planning";
import {
  clearMyChatMessages,
  insertMyChatMessage,
  loadMyChatMessages,
  type ChatRole,
} from "../lib/chatMessages";
import { loadMyRecentTransactions, loadMyTransactionsForMonth } from "@/lib/transactions";

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
      if (status === 402 || status === 403) {
        return "Access denied or insufficient credits. Please try again later.";
      }
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

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [contextError, setContextError] = useState("");
  const [contextLoading, setContextLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [planningSnapshot, setPlanningSnapshot] = useState<PlanningSnapshot | null>(null);

  const canUse = useMemo(() => !authLoading && !!user, [authLoading, user]);
  const prefillPrompt = useMemo(() => searchParams.get("prompt")?.trim() ?? "", [searchParams]);

  useEffect(() => {
    if (!prefillPrompt) return;
    setInput((current) => (current.trim() ? current : prefillPrompt));
  }, [prefillPrompt]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!canUse) return;

    let cancelled = false;

    async function loadWorkspaceData() {
      setError("");
      setInfo("");
      setContextError("");
      setContextLoading(true);

      const now = new Date();
      const [historyResult, transactionsResult, monthTransactionsResult, budgetsResult, goalsResult] =
        await Promise.allSettled([
          loadMyChatMessages(300),
          loadMyRecentTransactions(60),
          loadMyTransactionsForMonth(now.getFullYear(), now.getMonth() + 1),
          loadMyBudgets(),
          loadMySavingsGoals(),
        ]);

      if (cancelled) return;

      if (historyResult.status === "fulfilled") {
        const rows = historyResult.value;
        setMessages(
          rows.map((row) => ({ role: row.role, content: row.content, created_at: row.created_at }))
        );

        if (rows.length === 0) setInfo("No history yet. Send your first message.");
      } else {
        setError(getErrorMessage(historyResult.reason, "Failed to load chat history."));
      }

      if (transactionsResult.status === "fulfilled") {
        setSnapshot(buildFinancialSnapshot(transactionsResult.value));
      } else {
        setSnapshot(null);
        setContextError("AI is running without transaction context right now. Financial answers may be more generic.");
      }

      if (
        monthTransactionsResult.status === "fulfilled" &&
        budgetsResult.status === "fulfilled" &&
        goalsResult.status === "fulfilled"
      ) {
        setPlanningSnapshot(
          buildPlanningSnapshot({
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            transactions: monthTransactionsResult.value,
            budgets: budgetsResult.value,
            goals: goalsResult.value,
          })
        );
      } else {
        setPlanningSnapshot(null);
        setContextError((current) =>
          current || "AI is missing some planning context, so budget and goal advice may be less precise."
        );
      }

      setContextLoading(false);
    }

    void loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [canUse]);

  async function callChatApi(message: string, context?: string) {
    const controller = new AbortController();
    const timeoutMs = 25_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as ChatApiResponse;

      if (!res.ok) {
        const errData = data as ChatApiErr;
        throw new Error(toFriendlyMessage(errData?.code, res.status));
      }

      const okData = data as ChatApiOk;
      return String(okData.reply ?? "").trim();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("You're offline. Check your internet connection and try again.");
      }

      throw new Error(getErrorMessage(requestError, "Network error. Please try again."));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canUse || busy) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("You're offline. Check your internet connection and try again.");
      return;
    }

    const charLimit = 800;
    const text = input.trim();

    if (!text) {
      setError("Please type a question first.");
      return;
    }

    if (text.length > charLimit) {
      setError(`Message is too long (max ${charLimit} characters).`);
      return;
    }

    setBusy(true);
    setError("");
    setInfo("");

    try {
      await insertMyChatMessage("user", text);
      setMessages((prev) => [...prev, { role: "user", content: text }]);

      setInput("");

      const combinedContext = [snapshot?.contextSummary, planningSnapshot?.contextSummary]
        .filter(Boolean)
        .join("\n\n");

      const reply = await callChatApi(text, combinedContext || undefined);
      if (!reply) throw new Error("Empty assistant reply.");

      await insertMyChatMessage("assistant", reply);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (submitError) {
      const message = getErrorMessage(submitError, "Something went wrong. Please try again.");
      setError(message);

      if (
        hasMessage(submitError, "not authenticated") ||
        hasMessage(submitError, "unauthorized") ||
        hasMessage(submitError, "session")
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
      setInfo("History cleared for your account.");
    } catch (clearError) {
      setError(getErrorMessage(clearError, "Failed to clear history."));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-gray-50 text-gray-600">
        Loading...
      </main>
    );
  }

  if (!user) return null;

  const charLimit = 800;
  const trimmed = input.trim();
  const isEmpty = trimmed.length === 0;
  const isTooLong = trimmed.length > charLimit;
  const canSubmit = !busy && !isEmpty && !isTooLong;
  const hasFinancialContext = (snapshot?.transactionCount ?? 0) > 0;
  const hasPlanningContext =
    !!planningSnapshot &&
    (planningSnapshot.budgetProgress.length > 0 || planningSnapshot.goalProgress.length > 0);
  const suggestedPrompts = [
    ...new Set([
      ...(planningSnapshot?.suggestedPrompts ?? []),
      ...(snapshot?.suggestedPrompts ?? []),
      "Create a simple monthly budget for me.",
      "Where should I cut costs first?",
      "How can I save more consistently each month?",
    ]),
  ].slice(0, 5);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">SoloLedger AI</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your financial copilot is active for <span className="font-medium text-slate-900">{user.email}</span>
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

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <div className="mb-5 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">AI money context</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {contextLoading
                      ? "Loading your latest transaction patterns..."
                      : snapshot && hasFinancialContext
                        ? `Using ${snapshot.transactionCount} recent records across ${snapshot.coverageDays} day(s), plus ${
                            hasPlanningContext ? "your budgets and savings goals" : "available spending data"
                          }.`
                        : "Track transactions to unlock personalized coaching."}
                  </div>
                </div>

                {hasFinancialContext ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Personalized
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    Learning mode
                  </span>
                )}
              </div>

              {hasFinancialContext && snapshot ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white bg-white p-3">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Net tracked
                      </div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {formatInsightCurrency(snapshot.net)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white bg-white p-3">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Savings rate
                      </div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {formatInsightPercent(snapshot.savingsRate)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white bg-white p-3">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Daily burn
                      </div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {formatInsightCurrency(snapshot.averageDailyExpense)}
                      </div>
                    </div>
                  </div>

                  {planningSnapshot ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white bg-white p-3">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Budgets at risk
                        </div>
                        <div className="mt-2 text-xl font-semibold text-slate-900">
                          {planningSnapshot.budgetsAtRisk + planningSnapshot.budgetsOverLimit}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white bg-white p-3">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Active goals
                        </div>
                        <div className="mt-2 text-xl font-semibold text-slate-900">
                          {planningSnapshot.activeGoalCount}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white bg-white p-3">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Goal load
                        </div>
                        <div className="mt-2 text-xl font-semibold text-slate-900">
                          {formatInsightCurrency(planningSnapshot.totalMonthlyGoalTarget)}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {snapshot.highlights.slice(0, 2).map((highlight) => (
                      <div
                        key={highlight.id}
                        className={[
                          "rounded-2xl border p-3 text-sm",
                          highlight.tone === "positive"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : highlight.tone === "warning"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-slate-200 bg-white text-slate-800",
                        ].join(" ")}
                      >
                        <div className="font-semibold">{highlight.title}</div>
                        <div className="mt-1 leading-6">{highlight.detail}</div>
                      </div>
                    ))}

                    {planningSnapshot && planningSnapshot.goalProgress[0] ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
                        <div className="font-semibold text-slate-900">
                          Goal spotlight: {planningSnapshot.goalProgress[0].name}
                        </div>
                        <div className="mt-1 leading-6">
                          {formatInsightCurrency(planningSnapshot.goalProgress[0].current_amount)} saved of{" "}
                          {formatInsightCurrency(planningSnapshot.goalProgress[0].target_amount)}. Monthly pace:{" "}
                          {planningSnapshot.goalProgress[0].effectiveMonthlyTarget
                            ? formatInsightCurrency(planningSnapshot.goalProgress[0].effectiveMonthlyTarget)
                            : "not set"}.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm leading-6 text-slate-600">
                  Add a few income and expense records and SoloLedger AI will start answering with personal spending signals instead of generic budgeting tips.
                </div>
              )}

              {contextError ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {contextError}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Suggested prompts</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Use these to turn raw data into concrete savings actions.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      setError("");
                      setInfo("");
                    }}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-800 transition hover:border-slate-300 hover:bg-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-900">Prompt</label>
              <span className={`text-xs ${trimmed.length >= charLimit ? "text-red-600" : "text-slate-500"}`}>
                {trimmed.length}/{charLimit}
              </span>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              maxLength={charLimit}
              placeholder="Ask for a budget, savings plan, spending diagnosis, or a category-by-category review..."
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
                {busy ? "Thinking..." : "Submit"}
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

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="font-semibold">Error</div>
              <div className="mt-1 text-red-800">{error}</div>
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <div className="h-[520px] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
            {messages.length === 0 ? (
              <div className="text-sm text-slate-500">No messages yet.</div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, idx) => {
                  const isUserMsg = message.role === "user";
                  return (
                    <div key={idx} className={`flex ${isUserMsg ? "justify-end" : "justify-start"}`}>
                      <div
                        className={[
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                          isUserMsg
                            ? "bg-slate-900 text-white"
                            : "border border-emerald-200 bg-emerald-50 text-slate-900",
                        ].join(" ")}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
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

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-gray-50 text-gray-600">Loading...</main>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
