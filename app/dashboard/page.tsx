"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import {
  getMyMonthSummary,
  insertMyTransaction,
  loadMyRecentTransactions,
  type TransactionRow,
  type TransactionType,
} from "@/lib/transactions";

function formatEUR(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const displayName = useMemo(() => {
    const metaName = (user?.user_metadata as any)?.name;
    return metaName || user?.email || "User";
  }, [user]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [summary, setSummary] = useState<{ income: number; expenses: number; net: number } | null>(
    null
  );
  const [recent, setRecent] = useState<TransactionRow[]>([]);

  // quick add form state
  const [tType, setTType] = useState<TransactionType>("expense");
  const [tAmount, setTAmount] = useState<string>("");
  const [tCategory, setTCategory] = useState<string>("Food");
  const [tNote, setTNote] = useState<string>("");
  const [tDate, setTDate] = useState<string>(isoToday());

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      setBusy(true);
      setError("");
      setInfo("");

      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const [s, r] = await Promise.all([getMyMonthSummary(year, month), loadMyRecentTransactions(10)]);
        if (cancelled) return;

        setSummary({ income: s.income, expenses: s.expenses, net: s.net });
        setRecent(r);

        if (r.length === 0) setInfo("No transactions yet. Add your first one below.");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load dashboard data.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center text-slate-600 bg-slate-50">
        Loading session…
      </main>
    );
  }

  if (!user) return null; // redirecting

  async function onAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError("");
    setInfo("");

    const amount = Number(tAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    if (!tCategory.trim()) {
      setError("Category is required.");
      return;
    }

    if (!tDate) {
      setError("Date is required.");
      return;
    }

    setBusy(true);
    try {
      const row = await insertMyTransaction({
        type: tType,
        amount,
        category: tCategory,
        note: tNote,
        date: tDate,
      });

      // update UI optimistically
      setRecent((prev) => [row, ...prev].slice(0, 10));

      // update summary locally
      setSummary((prev) => {
        const base = prev ?? { income: 0, expenses: 0, net: 0 };
        const income = base.income + (tType === "income" ? amount : 0);
        const expenses = base.expenses + (tType === "expense" ? amount : 0);
        return { income, expenses, net: income - expenses };
      });

      setTAmount("");
      setTNote("");
      setInfo("Transaction added.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to add transaction.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome, <span className="font-medium text-slate-900">{displayName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              AI Chat
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

        {/* Summary cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Income (this month)</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">
              {formatEUR(summary?.income ?? 0)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Expenses (this month)</div>
            <div className="mt-2 text-2xl font-semibold text-rose-700">
              {formatEUR(summary?.expenses ?? 0)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Net</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {formatEUR(summary?.net ?? 0)}
            </div>
          </div>
        </section>

        {/* Recent transactions */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent transactions</h2>
            {busy ? <span className="text-sm text-slate-500">Loading…</span> : null}
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
                {recent.length === 0 ? (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={4}>
                      No transactions yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((t) => {
                    const isExpense = t.type === "expense";
                    return (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 text-slate-700">{t.date}</td>
                        <td className="py-3 pr-4 text-slate-900 font-medium">{t.category}</td>
                        <td className="py-3 pr-4 text-slate-700">{t.note ?? "—"}</td>
                        <td
                          className={`py-3 text-right font-semibold ${
                            isExpense ? "text-rose-700" : "text-emerald-700"
                          }`}
                        >
                          {isExpense ? "-" : "+"}
                          {formatEUR(Number(t.amount))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick add */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Add transaction</h2>

          <form onSubmit={onAddTransaction} className="mt-4 grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Type</label>
              <select
                value={tType}
                onChange={(e) => setTType(e.target.value as TransactionType)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                disabled={busy}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Amount (€)</label>
              <input
                value={tAmount}
                onChange={(e) => setTAmount(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 12.50"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                disabled={busy}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Date</label>
              <input
                type="date"
                value={tDate}
                onChange={(e) => setTDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                disabled={busy}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-slate-600">Category</label>
              <input
                value={tCategory}
                onChange={(e) => setTCategory(e.target.value)}
                placeholder="Food, Rent, Transport..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                disabled={busy}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-slate-600">Note (optional)</label>
              <input
                value={tNote}
                onChange={(e) => setTNote(e.target.value)}
                placeholder="Coffee, groceries..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                disabled={busy}
              />
            </div>

            <div className="sm:col-span-6 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save transaction"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTType("expense");
                  setTAmount("");
                  setTCategory("Food");
                  setTNote("");
                  setTDate(isoToday());
                  setError("");
                  setInfo("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
                disabled={busy}
              >
                Reset
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}