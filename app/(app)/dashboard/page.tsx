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
  buildPlanningSnapshot,
  deleteMyBudget,
  deleteMySavingsGoal,
  loadMyBudgets,
  loadMySavingsGoals,
  type BudgetRow,
  type SavingsGoalRow,
  type SavingsGoalStatus,
  upsertMyBudget,
  upsertMySavingsGoal,
} from "@/lib/planning";
import {
  getMyMonthSummary,
  insertMyTransaction,
  loadMyRecentTransactions,
  loadMyTransactionsForMonth,
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

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "rose" | "slate";
}) {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "rose"
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

type BudgetFormState = {
  id?: number;
  category: string;
  monthlyLimit: string;
  alertThreshold: string;
};

type SavingsGoalFormState = {
  id?: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  monthlyContributionTarget: string;
  targetDate: string;
  status: SavingsGoalStatus;
};

const initialFormState = (): TransactionFormState => ({
  type: "expense",
  amount: "",
  category: "Food",
  note: "",
  date: getLocalDateInputValue(),
});

const initialBudgetFormState = (): BudgetFormState => ({
  category: "",
  monthlyLimit: "",
  alertThreshold: "80",
});

const initialGoalFormState = (): SavingsGoalFormState => ({
  name: "",
  targetAmount: "",
  currentAmount: "0",
  monthlyContributionTarget: "",
  targetDate: "",
  status: "active",
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

function validateBudgetForm(form: BudgetFormState) {
  const monthlyLimit = Number(form.monthlyLimit);
  const alertThreshold = Number(form.alertThreshold);

  if (!form.category.trim()) {
    return "Category is required.";
  }
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
    return "Monthly limit must be greater than 0.";
  }
  if (!Number.isFinite(alertThreshold) || alertThreshold < 1 || alertThreshold > 100) {
    return "Alert threshold must be between 1 and 100.";
  }

  return "";
}

function validateGoalForm(form: SavingsGoalFormState) {
  const targetAmount = Number(form.targetAmount);
  const currentAmount = Number(form.currentAmount);
  const monthlyContributionTarget = form.monthlyContributionTarget
    ? Number(form.monthlyContributionTarget)
    : null;

  if (!form.name.trim()) {
    return "Goal name is required.";
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return "Target amount must be greater than 0.";
  }
  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return "Current saved amount must be 0 or greater.";
  }
  if (currentAmount > targetAmount) {
    return "Current saved amount cannot exceed the target amount.";
  }
  if (monthlyContributionTarget !== null && (!Number.isFinite(monthlyContributionTarget) || monthlyContributionTarget <= 0)) {
    return "Monthly contribution target must be greater than 0 when provided.";
  }

  return "";
}

function sortBudgets(rows: BudgetRow[]) {
  return [...rows].sort((left, right) => left.category.localeCompare(right.category));
}

function sortGoals(rows: SavingsGoalRow[]) {
  const statusRank: Record<SavingsGoalStatus, number> = {
    active: 0,
    paused: 1,
    completed: 2,
  };

  return [...rows].sort((left, right) => {
    const statusDiff = statusRank[left.status] - statusRank[right.status];
    if (statusDiff !== 0) return statusDiff;
    if (left.target_date && right.target_date) return left.target_date.localeCompare(right.target_date);
    if (left.target_date) return -1;
    if (right.target_date) return 1;
    return right.created_at.localeCompare(left.created_at);
  });
}

function formatTargetDate(value: string | null) {
  if (!value) return "No target date";

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [planningError, setPlanningError] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recent, setRecent] = useState<TransactionRow[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<TransactionRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [goals, setGoals] = useState<SavingsGoalRow[]>([]);

  const [openAdd, setOpenAdd] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [openGoalModal, setOpenGoalModal] = useState(false);
  const [form, setForm] = useState<TransactionFormState>(initialFormState());
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(initialBudgetFormState());
  const [goalForm, setGoalForm] = useState<SavingsGoalFormState>(initialGoalFormState());

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
      setPlanningError("");

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [summaryResult, recentResult, monthTransactionsResult, budgetsResult, goalsResult] =
        await Promise.allSettled([
          getMyMonthSummary(year, month),
          loadMyRecentTransactions(60),
          loadMyTransactionsForMonth(year, month),
          loadMyBudgets(),
          loadMySavingsGoals(),
        ]);

      if (cancelled) return;

      if (summaryResult.status === "fulfilled") {
        setSummary({
          income: summaryResult.value.income,
          expenses: summaryResult.value.expenses,
          net: summaryResult.value.net,
        });
      } else {
        setError(getErrorMessage(summaryResult.reason, "Failed to load dashboard summary."));
      }

      if (recentResult.status === "fulfilled") {
        setRecent(recentResult.value);
        if (recentResult.value.length === 0) {
          setInfo("No transactions yet. Add your first transaction.");
        }
      } else {
        setError((prev) => prev || getErrorMessage(recentResult.reason, "Failed to load recent transactions."));
      }

      if (monthTransactionsResult.status === "fulfilled") {
        setMonthTransactions(monthTransactionsResult.value);
      } else {
        setMonthTransactions([]);
        setPlanningError(
          getErrorMessage(monthTransactionsResult.reason, "Failed to load planning transactions for this month.")
        );
      }

      const planningErrors: string[] = [];

      if (budgetsResult.status === "fulfilled") {
        setBudgets(sortBudgets(budgetsResult.value));
      } else {
        setBudgets([]);
        planningErrors.push(getErrorMessage(budgetsResult.reason, "Failed to load budgets."));
      }

      if (goalsResult.status === "fulfilled") {
        setGoals(sortGoals(goalsResult.value));
      } else {
        setGoals([]);
        planningErrors.push(getErrorMessage(goalsResult.reason, "Failed to load savings goals."));
      }

      if (planningErrors.length > 0) {
        setPlanningError("Planning tools are unavailable until the new Supabase budgets/goals tables are ready.");
      }

      if (!cancelled) setDashboardLoading(false);
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const formError = validateTransactionForm(form);
  const budgetFormError = validateBudgetForm(budgetForm);
  const goalFormError = validateGoalForm(goalForm);
  const canSaveTransaction = !savingTransaction && !formError;
  const canSaveBudget = !savingBudget && !budgetFormError;
  const canSaveGoal = !savingGoal && !goalFormError;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const visibleRecent = useMemo(() => recent.slice(0, 12), [recent]);
  const insightSnapshot = useMemo(() => buildFinancialSnapshot(recent), [recent]);
  const topCategories = useMemo(() => insightSnapshot.categoryBreakdown.slice(0, 4), [insightSnapshot]);
  const planningSnapshot = useMemo(
    () =>
      buildPlanningSnapshot({
        year: currentYear,
        month: currentMonth,
        transactions: monthTransactions,
        budgets,
        goals,
      }),
    [currentMonth, currentYear, monthTransactions, budgets, goals]
  );
  const aiPlaybooks = useMemo(() => {
    return [...new Set([...planningSnapshot.suggestedPrompts, ...insightSnapshot.suggestedPrompts])].slice(0, 5);
  }, [planningSnapshot.suggestedPrompts, insightSnapshot.suggestedPrompts]);

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
      if (row.date.startsWith(currentMonthKey)) {
        setMonthTransactions((prev) => [row, ...prev]);
      }
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

  function updateBudgetForm<K extends keyof BudgetFormState>(key: K, value: BudgetFormState[K]) {
    setBudgetForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGoalForm<K extends keyof SavingsGoalFormState>(key: K, value: SavingsGoalFormState[K]) {
    setGoalForm((prev) => ({ ...prev, [key]: value }));
  }

  function openBudgetEditor(budget?: BudgetRow) {
    if (budget) {
      setBudgetForm({
        id: budget.id,
        category: budget.category,
        monthlyLimit: String(budget.monthly_limit),
        alertThreshold: String(Math.round(budget.alert_threshold * 100)),
      });
    } else {
      setBudgetForm(initialBudgetFormState());
    }

    setOpenBudgetModal(true);
  }

  function openGoalEditor(goal?: SavingsGoalRow) {
    if (goal) {
      setGoalForm({
        id: goal.id,
        name: goal.name,
        targetAmount: String(goal.target_amount),
        currentAmount: String(goal.current_amount),
        monthlyContributionTarget: goal.monthly_contribution_target ? String(goal.monthly_contribution_target) : "",
        targetDate: goal.target_date ?? "",
        status: goal.status,
      });
    } else {
      setGoalForm(initialGoalFormState());
    }

    setOpenGoalModal(true);
  }

  async function onSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveBudget) return;

    setSavingBudget(true);
    setError("");
    setInfo("");

    try {
      const saved = await upsertMyBudget({
        id: budgetForm.id,
        category: budgetForm.category,
        monthly_limit: Number(budgetForm.monthlyLimit),
        alert_threshold: Number(budgetForm.alertThreshold) / 100,
      });

      setBudgets((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== saved.id);
        return sortBudgets([...withoutCurrent, saved]);
      });
      setOpenBudgetModal(false);
      setBudgetForm(initialBudgetFormState());
      setPlanningError("");
      setInfo(budgetForm.id ? "Budget updated successfully." : "Budget created successfully.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save budget."));
    } finally {
      setSavingBudget(false);
    }
  }

  async function onDeleteBudget(id: number) {
    const confirmed = window.confirm("Delete this budget?");
    if (!confirmed) return;

    setError("");
    setInfo("");

    try {
      await deleteMyBudget(id);
      setBudgets((prev) => prev.filter((budget) => budget.id !== id));
      setInfo("Budget deleted.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Failed to delete budget."));
    }
  }

  async function onSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveGoal) return;

    setSavingGoal(true);
    setError("");
    setInfo("");

    try {
      const saved = await upsertMySavingsGoal({
        id: goalForm.id,
        name: goalForm.name,
        target_amount: Number(goalForm.targetAmount),
        current_amount: Number(goalForm.currentAmount),
        monthly_contribution_target: goalForm.monthlyContributionTarget
          ? Number(goalForm.monthlyContributionTarget)
          : null,
        target_date: goalForm.targetDate || null,
        status: goalForm.status,
      });

      setGoals((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== saved.id);
        return sortGoals([...withoutCurrent, saved]);
      });
      setOpenGoalModal(false);
      setGoalForm(initialGoalFormState());
      setPlanningError("");
      setInfo(goalForm.id ? "Savings goal updated successfully." : "Savings goal created successfully.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save savings goal."));
    } finally {
      setSavingGoal(false);
    }
  }

  async function onDeleteGoal(id: number) {
    const confirmed = window.confirm("Delete this savings goal?");
    if (!confirmed) return;

    setError("");
    setInfo("");

    try {
      await deleteMySavingsGoal(id);
      setGoals((prev) => prev.filter((goal) => goal.id !== id));
      setInfo("Savings goal deleted.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Failed to delete savings goal."));
    }
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
              {aiPlaybooks.map((prompt) => (
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

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Budgets and guardrails</h2>
              <p className="mt-1 text-sm text-slate-600">
                Set monthly limits per category so SoloLedger can warn you before spending drifts.
              </p>
            </div>

            <button
              onClick={() => openBudgetEditor()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              + Add budget
            </button>
          </div>

          {planningError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {planningError}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">On track</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-700">{planningSnapshot.budgetsOnTrack}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">At risk</div>
              <div className="mt-2 text-2xl font-semibold text-amber-700">{planningSnapshot.budgetsAtRisk}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Over limit</div>
              <div className="mt-2 text-2xl font-semibold text-rose-700">{planningSnapshot.budgetsOverLimit}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {planningSnapshot.budgetProgress.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                No budgets yet. Start with categories like Food, Transport, or Entertainment to create useful guardrails.
              </div>
            ) : (
              planningSnapshot.budgetProgress.map((budget) => {
                const barWidth = Math.min(100, Math.max(6, Math.round(budget.usageRatio * 100)));
                const barTone =
                  budget.status === "over_limit"
                    ? "bg-rose-600"
                    : budget.status === "at_risk"
                      ? "bg-amber-500"
                      : "bg-emerald-600";

                return (
                  <article key={budget.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-slate-900">{budget.category}</div>
                          <StatusBadge
                            tone={
                              budget.status === "over_limit"
                                ? "rose"
                                : budget.status === "at_risk"
                                  ? "amber"
                                  : "green"
                            }
                          >
                            {budget.status === "over_limit"
                              ? "Over limit"
                              : budget.status === "at_risk"
                                ? "At risk"
                                : "On track"}
                          </StatusBadge>
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Spent {formatEUR(budget.spent)} of {formatEUR(budget.monthly_limit)} this month.
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openBudgetEditor(budget)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBudget(budget.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full ${barTone}`} style={{ width: `${barWidth}%` }} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                      <span>{Math.round(budget.usageRatio * 100)}% of budget used</span>
                      <span>
                        {budget.remaining >= 0
                          ? `${formatEUR(budget.remaining)} remaining`
                          : `${formatEUR(Math.abs(budget.remaining))} over limit`}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Unbudgeted spend</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {planningSnapshot.unbudgetedExpenseTotal > 0
                ? `${formatEUR(planningSnapshot.unbudgetedExpenseTotal)} this month is still outside your configured budgets.`
                : "All tracked expense categories are covered by budgets this month."}
            </div>
            {planningSnapshot.unbudgetedCategories.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {planningSnapshot.unbudgetedCategories.slice(0, 6).map((category) => (
                  <StatusBadge key={category} tone="slate">
                    {category}
                  </StatusBadge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Savings goals</h2>
              <p className="mt-1 text-sm text-slate-600">
                Turn surplus into progress with named goals, contribution targets, and timing pressure.
              </p>
            </div>

            <button
              onClick={() => openGoalEditor()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              + Add goal
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Active goals</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{planningSnapshot.activeGoalCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Monthly goal load
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {formatEUR(planningSnapshot.totalMonthlyGoalTarget)}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {planningSnapshot.goalProgress.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                No savings goals yet. Add one for an emergency fund, tax buffer, travel, or a big purchase.
              </div>
            ) : (
              planningSnapshot.goalProgress.map((goal) => {
                const progressWidth = Math.min(100, Math.max(6, Math.round(goal.progressRatio * 100)));

                return (
                  <article key={goal.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-slate-900">{goal.name}</div>
                          <StatusBadge
                            tone={
                              goal.fundingStatus === "complete"
                                ? "green"
                                : goal.fundingStatus === "ready"
                                  ? "green"
                                  : goal.fundingStatus === "tight"
                                    ? "amber"
                                    : "rose"
                            }
                          >
                            {goal.fundingStatus === "complete"
                              ? "Complete"
                              : goal.fundingStatus === "ready"
                                ? "Fundable"
                                : goal.fundingStatus === "tight"
                                  ? "Needs room"
                                  : "No surplus"}
                          </StatusBadge>
                          {goal.status === "paused" ? <StatusBadge tone="slate">Paused</StatusBadge> : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {formatEUR(goal.current_amount)} saved of {formatEUR(goal.target_amount)} target
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openGoalEditor(goal)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteGoal(goal.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-slate-900" style={{ width: `${progressWidth}%` }} />
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>{Math.round(goal.progressRatio * 100)}% complete</span>
                        <span>{formatEUR(goal.remaining)} remaining</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Target date</span>
                        <span>{formatTargetDate(goal.target_date)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Monthly target</span>
                        <span>
                          {goal.effectiveMonthlyTarget ? formatEUR(goal.effectiveMonthlyTarget) : "Not set"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Projected runway</span>
                        <span>
                          {goal.projectedMonthsLeft === null
                            ? "Manual pacing"
                            : goal.projectedMonthsLeft === 0
                              ? "Goal reached"
                              : `${goal.projectedMonthsLeft} month${goal.projectedMonthsLeft === 1 ? "" : "s"}`}
                        </span>
                      </div>
                    </div>

                    {goal.fundingGap && goal.fundingGap > 0 ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        You need about {formatEUR(goal.fundingGap)} more monthly surplus to fully fund this pace.
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
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

      <Modal
        open={openBudgetModal}
        title={budgetForm.id ? "Edit budget" : "Add budget"}
        onClose={() => {
          if (savingBudget) return;
          setOpenBudgetModal(false);
        }}
      >
        <form onSubmit={onSaveBudget} className="grid gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Category</label>
            <input
              value={budgetForm.category}
              onChange={(e) => updateBudgetForm("category", e.target.value)}
              placeholder="Food, Transport, Entertainment..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingBudget}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Monthly limit (EUR)</label>
            <input
              value={budgetForm.monthlyLimit}
              onChange={(e) => updateBudgetForm("monthlyLimit", e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 250"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingBudget}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Alert threshold (%)</label>
            <input
              value={budgetForm.alertThreshold}
              onChange={(e) => updateBudgetForm("alertThreshold", e.target.value)}
              inputMode="numeric"
              placeholder="80"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingBudget}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {budgetFormError
              ? budgetFormError
              : "SoloLedger will flag this budget once spending reaches the selected threshold."}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSaveBudget}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingBudget ? "Saving..." : budgetForm.id ? "Save changes" : "Create budget"}
            </button>

            <button
              type="button"
              disabled={savingBudget}
              onClick={() => setOpenBudgetModal(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openGoalModal}
        title={goalForm.id ? "Edit savings goal" : "Add savings goal"}
        onClose={() => {
          if (savingGoal) return;
          setOpenGoalModal(false);
        }}
      >
        <form onSubmit={onSaveGoal} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Goal name</label>
            <input
              value={goalForm.name}
              onChange={(e) => updateGoalForm("name", e.target.value)}
              placeholder="Emergency fund, Tax reserve, New laptop..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoal}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Target amount (EUR)</label>
            <input
              value={goalForm.targetAmount}
              onChange={(e) => updateGoalForm("targetAmount", e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 1500"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoal}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Current saved (EUR)</label>
            <input
              value={goalForm.currentAmount}
              onChange={(e) => updateGoalForm("currentAmount", e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoal}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Monthly contribution target (optional)</label>
            <input
              value={goalForm.monthlyContributionTarget}
              onChange={(e) => updateGoalForm("monthlyContributionTarget", e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 150"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoal}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Target date (optional)</label>
            <input
              type="date"
              value={goalForm.targetDate}
              onChange={(e) => updateGoalForm("targetDate", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoal}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Status</label>
            <select
              value={goalForm.status}
              onChange={(e) => updateGoalForm("status", e.target.value as SavingsGoalStatus)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoal}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {goalFormError
              ? goalFormError
              : "Use both a monthly contribution and target date when you want SoloLedger to pressure-test the goal pace."}
          </div>

          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSaveGoal}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingGoal ? "Saving..." : goalForm.id ? "Save changes" : "Create goal"}
            </button>

            <button
              type="button"
              disabled={savingGoal}
              onClick={() => setOpenGoalModal(false)}
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
