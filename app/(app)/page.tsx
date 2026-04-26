"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { useLanguage } from "../providers/LanguageProvider";
import { getErrorMessage, hasMessage } from "@/lib/errors";
import {
  buildFinancialSnapshot,
  formatInsightCurrency,
  formatInsightPercent,
  type FinancialSnapshot,
} from "@/lib/financialInsights";
import { buildPlanningSnapshot, loadMyBudgets, loadMySavingsGoals, type PlanningSnapshot } from "@/lib/planning";
import {
  buildRecurringSnapshot,
  loadMyRecurringTransactions,
  type RecurringSnapshot,
} from "@/lib/recurring";
import { buildWeeklyPulseSnapshot, type WeeklyPulseSnapshot } from "@/lib/weeklyPulse";
import {
  clearMyChatMessages,
  insertMyChatMessage,
  loadMyChatMessages,
  type ChatRole,
} from "@/lib/chatMessages";
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
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const formRef = useRef<HTMLFormElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [contextError, setContextError] = useState("");
  const [contextLoading, setContextLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [planningSnapshot, setPlanningSnapshot] = useState<PlanningSnapshot | null>(null);
  const [recurringSnapshot, setRecurringSnapshot] = useState<RecurringSnapshot | null>(null);
  const [weeklyPulse, setWeeklyPulse] = useState<WeeklyPulseSnapshot | null>(null);

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
      const [
        historyResult,
        transactionsResult,
        monthTransactionsResult,
        budgetsResult,
        goalsResult,
        recurringResult,
      ] =
        await Promise.allSettled([
          loadMyChatMessages(300),
          loadMyRecentTransactions(60),
          loadMyTransactionsForMonth(now.getFullYear(), now.getMonth() + 1),
          loadMyBudgets(),
          loadMySavingsGoals(),
          loadMyRecurringTransactions(),
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
        if (recurringResult.status === "fulfilled") {
          setWeeklyPulse(buildWeeklyPulseSnapshot(transactionsResult.value, recurringResult.value, now));
        } else {
          setWeeklyPulse(buildWeeklyPulseSnapshot(transactionsResult.value, [], now));
        }
      } else {
        setSnapshot(null);
        setWeeklyPulse(null);
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

      if (recurringResult.status === "fulfilled") {
        setRecurringSnapshot(buildRecurringSnapshot(recurringResult.value, now));
      } else {
        setRecurringSnapshot(null);
        setContextError((current) =>
          current || "AI is missing recurring-commitment context, so fixed-cost advice may be less precise."
        );
      }

      setContextLoading(false);
    }

    void loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [canUse]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: "end",
      behavior: messages.length > 0 ? "smooth" : "auto",
    });
  }, [messages, busy]);

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

      const combinedContext = [
        snapshot?.contextSummary,
        planningSnapshot?.contextSummary,
        recurringSnapshot?.contextSummary,
        weeklyPulse?.contextSummary,
      ]
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
  const suggestedPrompts = [
    ...new Set([
      ...(planningSnapshot?.suggestedPrompts ?? []),
      ...(recurringSnapshot?.suggestedPrompts ?? []),
      ...(weeklyPulse?.suggestedPrompts ?? []),
      ...(snapshot?.suggestedPrompts ?? []),
      t("ai_first_question_2"),
      "Where should I cut costs first?",
      "How can I save more consistently each month?",
    ]),
  ].slice(0, 5);
  const starterPrompts = suggestedPrompts.slice(0, 4);
  const planWatchCount = planningSnapshot
    ? planningSnapshot.budgetsAtRisk + planningSnapshot.budgetsOverLimit
    : 0;
  const topBudgetIssue = planningSnapshot?.budgetProgress.find((budget) => budget.status !== "on_track") ?? null;
  const primaryGoal =
    planningSnapshot?.goalProgress.find((goal) => goal.status === "active" && goal.fundingStatus !== "complete") ??
    planningSnapshot?.goalProgress[0] ??
    null;
  const assistantStatusLabel = contextLoading
    ? t("ai_status_loading")
    : hasFinancialContext
      ? t("ai_status_personalized")
      : t("ai_status_learning");
  const assistantStatusSummary = contextLoading
    ? t("ai_status_loading_summary")
    : hasFinancialContext && snapshot
      ? `Using ${snapshot.transactionCount} records across ${snapshot.coverageDays} day(s) for more precise answers.`
      : t("ai_status_learning_summary");
  const contextRows = [
    {
      label: "Records",
      value: hasFinancialContext && snapshot ? String(snapshot.transactionCount) : "0",
      note:
        hasFinancialContext && snapshot
          ? `${snapshot.coverageDays}-day window`
          : "No recent transaction context",
    },
    {
      label: "Plan watch",
      value: String(planWatchCount),
      note: planningSnapshot
        ? planWatchCount > 0
          ? `${planningSnapshot.budgetsAtRisk} at risk, ${planningSnapshot.budgetsOverLimit} over limit`
          : `${planningSnapshot.activeGoalCount} active goals`
        : "Budgets and goals not loaded",
    },
    {
      label: "Due this week",
      value: recurringSnapshot ? String(recurringSnapshot.dueThisWeekCount) : "0",
      note: recurringSnapshot
        ? `${formatInsightCurrency(recurringSnapshot.monthlyCommittedNet)} fixed monthly net`
        : "No recurring schedule loaded",
    },
  ];
  const focusSignals: Array<{ title: string; detail: string }> = [
    ...(weeklyPulse?.highlights[0]
      ? [{ title: weeklyPulse.highlights[0].title, detail: weeklyPulse.highlights[0].detail }]
      : []),
    ...(snapshot?.highlights[0]
      ? [{ title: snapshot.highlights[0].title, detail: snapshot.highlights[0].detail }]
      : []),
    ...(topBudgetIssue
      ? [
          {
            title: `Budget watch: ${topBudgetIssue.category}`,
            detail: `${formatInsightCurrency(topBudgetIssue.spent)} spent of ${formatInsightCurrency(
              topBudgetIssue.monthly_limit
            )} this month.`,
          },
        ]
      : []),
    ...(primaryGoal
      ? [
          {
            title: `Goal focus: ${primaryGoal.name}`,
            detail: `${formatInsightCurrency(primaryGoal.current_amount)} saved of ${formatInsightCurrency(
              primaryGoal.target_amount
            )} target.`,
          },
        ]
      : []),
  ].slice(0, 3);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[calc(100vh-10rem)] min-w-0 flex-col border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">AI assistant</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {t("ai_title")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {t("ai_description")}{" "}
                  <span className="font-medium text-slate-900">{user.email}</span>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "border px-3 py-2 text-xs font-medium",
                    contextLoading
                      ? "border-slate-300 bg-slate-50 text-slate-600"
                      : hasFinancialContext
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-600",
                  ].join(" ")}
                >
                  {assistantStatusLabel}
                </span>
                <Link
                  href="/dashboard/plan"
                  className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  {t("ai_open_planning")}
                </Link>
                <Link
                  href="/dashboard/automation"
                  className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  {t("ai_open_recurring")}
                </Link>
                <button
                  onClick={handleClearHistory}
                  disabled={busy || messages.length === 0}
                  className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("ai_clear_history")}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[340px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <div className="max-w-3xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t("ai_start_here")}
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {t("ai_empty_title")}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {t("ai_empty_description")}
                  </p>
                  <div className="mt-4 border border-slate-200 bg-white px-4 py-4 text-left text-sm leading-6 text-slate-600">
                    {t("ai_good_first_questions")}
                    <div>{t("ai_first_question_1")}</div>
                    <div>{t("ai_first_question_2")}</div>
                    <div>{t("ai_first_question_3")}</div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setInput(prompt);
                          setError("");
                          setInfo("");
                        }}
                        className="border border-slate-200 bg-white px-4 py-4 text-left text-sm text-slate-800 transition hover:bg-slate-100"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-4xl flex-col gap-4">
                {messages.map((message, idx) => {
                  const isUserMsg = message.role === "user";
                  return (
                    <div key={`${message.created_at ?? "message"}-${idx}`} className={`flex ${isUserMsg ? "justify-end" : "justify-start"}`}>
                      <div
                        className={[
                          "max-w-[88%] border px-4 py-4 shadow-sm sm:max-w-[78%]",
                          isUserMsg
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-900",
                        ].join(" ")}
                      >
                        <div
                          className={[ 
                            "text-[11px] font-semibold uppercase tracking-[0.18em]",
                            isUserMsg ? "text-slate-300" : "text-slate-500",
                          ].join(" ")}
                        >
                          {isUserMsg ? t("ai_you") : t("ai_assistant_name")}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-7">{message.content}</div>
                      </div>
                    </div>
                  );
                })}

                {busy ? (
                  <div className="flex justify-start">
                    <div className="border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t("ai_assistant_name")}
                      </div>
                      <div className="mt-3 inline-flex items-center gap-2">
                        <Spinner className="border-slate-400 border-t-transparent" />
                        Thinking through your numbers...
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            {info ? (
              <div className="mb-3 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{info}</div>
            ) : null}

            {error ? (
              <div className="mb-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <div className="font-semibold">Error</div>
                <div className="mt-1 text-red-800">{error}</div>
              </div>
            ) : null}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSubmit) {
                    event.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                rows={4}
                maxLength={charLimit}
                placeholder="Ask for a spending diagnosis, a monthly budget, a savings plan, or help preparing for upcoming bills..."
                className="w-full resize-none border border-slate-300 bg-white px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                disabled={busy}
              />

              {isTooLong ? (
                <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  Message is too long (max {charLimit} characters).
                </div>
              ) : null}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-xs leading-5 text-slate-500">
                  Press Ctrl+Enter to send. {trimmed.length}/{charLimit}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setInput("");
                      setError("");
                      setInfo("");
                    }}
                    className="border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busy || input.length === 0}
                  >
                    {t("ai_clear_input")}
                  </button>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center justify-center gap-2 border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? <Spinner /> : null}
                    {busy ? t("ai_thinking") : t("ai_send")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-slate-950 bg-slate-950 p-4 text-white shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Assistant state
            </div>
            <div className="mt-3 text-lg font-semibold">{assistantStatusLabel}</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{assistantStatusSummary}</p>
          </section>

          <section className="border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-950">What AI is reading</div>

            <div className="mt-4 divide-y divide-slate-200">
              {contextRows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{row.label}</div>
                    <div className="mt-1 text-sm text-slate-600">{row.note}</div>
                  </div>
                  <div className="text-lg font-semibold text-slate-950">{row.value}</div>
                </div>
              ))}
            </div>

            {contextError ? (
              <div className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {contextError}
              </div>
            ) : null}

            {hasFinancialContext && snapshot ? (
              <div className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
                Net tracked: <span className="font-medium text-slate-900">{formatInsightCurrency(snapshot.net)}</span>
                . Savings rate:{" "}
                <span className="font-medium text-slate-900">
                  {formatInsightPercent(snapshot.savingsRate)}
                </span>
                .
              </div>
            ) : null}
          </section>

          <section className="border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-950">Focus now</div>

            {focusSignals.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Add transaction history, budgets, or recurring items and this panel will surface the first things worth
                discussing with the assistant.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {focusSignals.map((signal) => (
                  <div key={signal.title} className="border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-950">{signal.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">{signal.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-950">{t("ai_quick_prompts")}</div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {t("ai_shortcuts_description")}
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
                  className="border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-800 transition hover:bg-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        </aside>
    </div>
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
