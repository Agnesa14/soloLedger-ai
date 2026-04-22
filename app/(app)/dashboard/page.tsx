"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../providers/AuthProvider";
import { getLocalDateInputValue } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import {
  buildFinancialSnapshot,
  formatInsightCurrency,
  formatInsightPercent,
} from "@/lib/financialInsights";
import {
  getMyMonthSummary,
  insertMyTransaction,
  loadMyRecentTransactions,
  type TransactionRow,
  type TransactionType,
} from "@/lib/transactions";
import { Modal } from "@/components/ui/Modal";

function formatEUR(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "green" | "red" | "slate" }) {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "red"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function InsightCard({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}) {
  const cls =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <article className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6">{detail}</p>
    </article>
  );
}

type DashboardSummary = {
  income: number;
  expenses: number;
  net: number;
};

type TransactionFormState = {
  type: TransactionType;
  amount: string;
  category: string;
  note: string;
  date: string;
};

const initialFormState = (): TransactionFormState => ({
  type: "expense",
  amount: "",
  category: "Food",
  note: "",
  date: getLocalDateInputValue(),
});

function validateTransactionForm(form: TransactionFormState) {
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Please enter a valid amount greater than 0.";
  }
  if (!form.category.trim()) {
    return "Category is required.";
  }
  if (!form.date) {
    return "Date is required.";
  }

  return "";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const displayName = useMemo(() => {
    const metadata = user?.user_metadata;
    if (metadata && typeof metadata === "object" && "name" in metadata) {
      const name = metadata.name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }

    return user?.email || "User";
  }, [user]);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recent, setRecent] = useState<TransactionRow[]>([]);

  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState<TransactionFormState>(initialFormState);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadDashboard() {
      setDashboardLoading(true);
      setError("");
      setInfo("");

      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const [nextSummary, nextRecent] = await Promise.all([
          getMyMonthSummary(year, month),
          loadMyRecentTransactions(60),
        ]);

        if (cancelled) return;

        setSummary({
          income: nextSummary.income,
          expenses: nextSummary.expenses,
          net: nextSummary.net,
        });
        setRecent(nextRecent);

        if (nextRecent.length === 0) {
          setInfo("No transactions yet. Add your first transaction.");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load dashboard data."));
        }
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const formError = validateTransactionForm(form);
  const canSaveTransaction = !savingTransaction && !formError;
  const visibleRecent = useMemo(() => recent.slice(0, 12), [recent]);
  const insightSnapshot = useMemo(() => buildFinancialSnapshot(recent), [recent]);
  const topCategories = useMemo(() => insightSnapshot.categoryBreakdown.slice(0, 4), [insightSnapshot]);

  if (loading) {
    return (
      <main className="grid min-h-[60vh] place-items-center text-slate-600">
        Loading session...
      </main>
    );
  }

  if (!user) return null;

  async function onAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveTransaction) return;

    setError("");
    setInfo("");
    setSavingTransaction(true);

    const amount = Number(form.amount);

    try {
      const row = await insertMyTransaction({
        type: form.type,
        amount,
        category: form.category,
        note: form.note,
        date: form.date,
      });

      setRecent((prev) => [row, ...prev].slice(0, 60));
      setSummary((prev) => {
        const base = prev ?? { income: 0, expenses: 0, net: 0 };
        const income = base.income + (form.type === "income" ? amount : 0);
        const expenses = base.expenses + (form.type === "expense" ? amount : 0);
        return { income, expenses, net: income - expenses };
      });

      setForm(initialFormState());
      setOpenAdd(false);
      setInfo("Transaction added successfully.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to add transaction."));
    } finally {
      setSavingTransaction(false);
    }
  }

  function updateForm<K extends keyof TransactionFormState>(key: K, value: TransactionFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Welcome, <span className="font-medium text-slate-900">{displayName}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              AI Chat
            </Link>
            <button
              onClick={() => {
                setForm(initialFormState());
                setOpenAdd(true);
              }}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              + Add transaction
            </button>
            <button
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>

        {info ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {info}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <div className="font-semibold">Error</div>
            <div className="mt-1 text-red-800">{error}</div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-500">Income (this month)</div>
            <Pill tone="green">Income</Pill>
          </div>
          <div className="mt-3 text-3xl font-semibold text-emerald-700">
            {formatEUR(summary?.income ?? 0)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-500">Expenses (this month)</div>
            <Pill tone="red">Expenses</Pill>
          </div>
          <div className="mt-3 text-3xl font-semibold text-rose-700">
            {formatEUR(summary?.expenses ?? 0)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-500">Net</div>
            <Pill tone="slate">Balance</Pill>
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {formatEUR(summary?.net ?? 0)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">AI spending signals</h2>
              <p className="mt-1 text-sm text-slate-600">
                {insightSnapshot.transactionCount > 0
                  ? `Based on your last ${insightSnapshot.transactionCount} tracked transaction${insightSnapshot.transactionCount === 1 ? "" : "s"} across ${insightSnapshot.coverageDays} day${insightSnapshot.coverageDays === 1 ? "" : "s"}.`
                  : "Start tracking transactions and the dashboard will surface real spending signals here."}
              </p>
            </div>

            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Open AI copilot
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Savings rate
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {formatInsightPercent(insightSnapshot.savingsRate)}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Target benchmark: {insightSnapshot.savingsTarget ? formatInsightCurrency(insightSnapshot.savingsTarget) : "Add income"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Daily burn
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {formatInsightCurrency(insightSnapshot.averageDailyExpense)}
              </div>
              <div className="mt-1 text-sm text-slate-600">Average tracked expense per day</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Main pressure point
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {insightSnapshot.topExpenseCategory?.category ?? "Waiting for data"}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {insightSnapshot.topExpenseCategory
                  ? `${formatInsightCurrency(insightSnapshot.topExpenseCategory.amount)} of expense volume`
                  : "Add expense categories to reveal the biggest lever"}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {insightSnapshot.highlights.map((highlight) => (
              <InsightCard
                key={highlight.id}
                title={highlight.title}
                detail={highlight.detail}
                tone={highlight.tone}
              />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Category pressure map</h2>
          <p className="mt-1 text-sm text-slate-600">
            This helps you see where a small change would create the biggest savings impact.
          </p>

          <div className="mt-5 space-y-3">
            {topCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                Add some expense transactions and SoloLedger AI will highlight the categories with the most pressure.
              </div>
            ) : (
              topCategories.map((category) => (
                <div key={category.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{category.category}</div>
                      <div className="text-sm text-slate-600">
                        {category.transactions} transaction{category.transactions === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">{formatInsightCurrency(category.amount)}</div>
                      <div className="text-sm text-slate-600">
                        {formatInsightPercent(category.shareOfExpenses)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${Math.max(8, Math.round(category.shareOfExpenses * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">AI playbooks</div>
            <div className="mt-3 flex flex-col gap-2">
              {insightSnapshot.suggestedPrompts.map((prompt) => (
                <Link
                  key={prompt}
                  href={{ pathname: "/", query: { prompt } }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 transition hover:bg-slate-50"
                >
                  {prompt}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent transactions</h2>
          {dashboardLoading ? <span className="text-sm text-slate-500">Loading...</span> : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Note</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>

            <tbody>
              {visibleRecent.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={4}>
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                visibleRecent.map((transaction) => {
                  const isExpense = transaction.type === "expense";
                  return (
                    <tr key={transaction.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 pr-4 text-slate-700">{transaction.date}</td>
                      <td className="py-3 pr-4">
                        <span className="font-medium text-slate-900">{transaction.category}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{transaction.note ?? "-"}</td>
                      <td
                        className={`py-3 text-right font-semibold ${
                          isExpense ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {isExpense ? "-" : "+"}
                        {formatEUR(Number(transaction.amount))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={openAdd}
        title="Add transaction"
        onClose={() => {
          if (savingTransaction) return;
          setOpenAdd(false);
        }}
      >
        <form onSubmit={onAddTransaction} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Type</label>
            <select
              value={form.type}
              onChange={(e) => updateForm("type", e.target.value as TransactionType)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Amount (EUR)</label>
            <input
              value={form.amount}
              onChange={(e) => updateForm("amount", e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 12.50"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Category</label>
            <input
              value={form.category}
              onChange={(e) => updateForm("category", e.target.value)}
              placeholder="Food, Rent, Transport..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Note (optional)</label>
            <input
              value={form.note}
              onChange={(e) => updateForm("note", e.target.value)}
              placeholder="Coffee, groceries..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => updateForm("date", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            />
          </div>

          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {formError ? formError : "The Save button unlocks as soon as the transaction is valid."}
          </div>

          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSaveTransaction}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingTransaction ? "Saving..." : "Save transaction"}
            </button>

            <button
              type="button"
              disabled={savingTransaction}
              onClick={() => setOpenAdd(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
