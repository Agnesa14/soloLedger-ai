"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../providers/AuthProvider";
import { useLanguage } from "../../providers/LanguageProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { getLocalDateInputValue } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import {
  buildFinancialSnapshot,
} from "@/lib/financialInsights";
import {
  buildPlanningSnapshot,
  deleteMyBudget,
  deleteMySavingsGoal,
  deleteMySavingsGoalContribution,
  insertMySavingsGoalContribution,
  loadMyBudgets,
  loadMySavingsGoalContributions,
  loadMySavingsGoals,
  type BudgetRow,
  type SavingsGoalContributionRow,
  type SavingsGoalRow,
  type SavingsGoalStatus,
  upsertMyBudget,
  upsertMySavingsGoal,
} from "@/lib/planning";
import {
  buildRecurringSnapshot,
  deleteMyRecurringTransaction,
  loadMyRecurringTransactions,
  logMyRecurringTransaction,
  type RecurringFrequency,
  type RecurringTransactionRow,
  upsertMyRecurringTransaction,
} from "@/lib/recurring";
import {
  getMyMonthSummary,
  insertMyTransaction,
  loadMyRecentTransactions,
  loadMyTransactionsForMonth,
  type TransactionRow,
  type TransactionType,
} from "@/lib/transactions";
import { buildWeeklyPulseSnapshot } from "@/lib/weeklyPulse";
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
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${cls}`}>
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
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

type DashboardSummary = {
  income: number;
  expenses: number;
  net: number;
};

type DashboardView = "overview" | "plan" | "automation";
type TransactionPeriodMode = "week" | "month" | "all";
type PlanningSection = "budgets" | "goals";

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

type GoalContributionFormState = {
  goalId: number | null;
  goalName: string;
  amount: string;
  contributionDate: string;
  note: string;
};

type RecurringFormState = {
  id?: number;
  name: string;
  type: TransactionType;
  amount: string;
  category: string;
  note: string;
  frequency: RecurringFrequency;
  cadence: string;
  nextDueDate: string;
  active: boolean;
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

const initialGoalContributionFormState = (): GoalContributionFormState => ({
  goalId: null,
  goalName: "",
  amount: "",
  contributionDate: getLocalDateInputValue(),
  note: "",
});

const initialRecurringFormState = (): RecurringFormState => ({
  name: "",
  type: "expense",
  amount: "",
  category: "",
  note: "",
  frequency: "monthly",
  cadence: "1",
  nextDueDate: getLocalDateInputValue(),
  active: true,
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

function validateGoalContributionForm(form: GoalContributionFormState) {
  const amount = Number(form.amount);

  if (!form.goalId) {
    return "Savings goal is required.";
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Contribution amount must be greater than 0.";
  }
  if (!form.contributionDate) {
    return "Contribution date is required.";
  }

  return "";
}

function validateRecurringForm(form: RecurringFormState) {
  const amount = Number(form.amount);
  const cadence = Number(form.cadence);

  if (!form.name.trim()) {
    return "Name is required.";
  }
  if (!form.category.trim()) {
    return "Category is required.";
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Amount must be greater than 0.";
  }
  if (!Number.isFinite(cadence) || cadence <= 0 || !Number.isInteger(cadence)) {
    return "Cadence must be a whole number greater than 0.";
  }
  if (!form.nextDueDate) {
    return "Next due date is required.";
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

function sortRecurring(rows: RecurringTransactionRow[]) {
  return [...rows].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    const dueDiff = left.next_due_date.localeCompare(right.next_due_date);
    if (dueDiff !== 0) return dueDiff;
    return left.name.localeCompare(right.name);
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

function parseTransactionDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getTransactionMonthKey(value: string) {
  return value.slice(0, 7);
}

function getTransactionWeekKey(value: string) {
  const date = parseTransactionDate(value);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  return getLocalDateInputValue(monday);
}

function formatTransactionDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseTransactionDate(value));
}

function formatTransactionMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatTransactionWeek(value: string) {
  const start = parseTransactionDate(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatTransactionDate(getLocalDateInputValue(start))} - ${formatTransactionDate(getLocalDateInputValue(end))}`;
}

function summarizeTransactions(rows: TransactionRow[]) {
  const income = rows
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0);
  const expenses = rows
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0);

  return {
    income,
    expenses,
    net: income - expenses,
  };
}

function groupTransactionsByDate(rows: TransactionRow[]) {
  const groups = new Map<string, TransactionRow[]>();
  for (const transaction of rows) {
    const items = groups.get(transaction.date) ?? [];
    items.push(transaction);
    groups.set(transaction.date, items);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, transactions]) => ({ date, transactions }));
}

function formatRecurringFrequency(frequency: RecurringFrequency, cadence: number) {
  const unit = frequency === "weekly" ? "week" : "month";
  return cadence === 1 ? `Every ${unit}` : `Every ${cadence} ${unit}s`;
}

export function DashboardWorkspace({ view }: { view: DashboardView }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingGoalContribution, setSavingGoalContribution] = useState(false);
  const [savingRecurring, setSavingRecurring] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [planningError, setPlanningError] = useState("");
  const [recurringError, setRecurringError] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recent, setRecent] = useState<TransactionRow[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<TransactionRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [goals, setGoals] = useState<SavingsGoalRow[]>([]);
  const [goalContributions, setGoalContributions] = useState<SavingsGoalContributionRow[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringTransactionRow[]>([]);

  const [openAdd, setOpenAdd] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [openGoalModal, setOpenGoalModal] = useState(false);
  const [openGoalContributionModal, setOpenGoalContributionModal] = useState(false);
  const [openRecurringModal, setOpenRecurringModal] = useState(false);
  const [openTransactionsModal, setOpenTransactionsModal] = useState(false);
  const [transactionPeriodMode, setTransactionPeriodMode] = useState<TransactionPeriodMode>("week");
  const [form, setForm] = useState<TransactionFormState>(initialFormState());
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(initialBudgetFormState());
  const [goalForm, setGoalForm] = useState<SavingsGoalFormState>(initialGoalFormState());
  const [goalContributionForm, setGoalContributionForm] = useState<GoalContributionFormState>(
    initialGoalContributionFormState()
  );
  const [recurringForm, setRecurringForm] = useState<RecurringFormState>(initialRecurringFormState());

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!info && !error) return;

    const timeoutId = window.setTimeout(() => {
      setInfo("");
      setError("");
    }, error ? 6500 : 4200);

    return () => window.clearTimeout(timeoutId);
  }, [error, info]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadDashboard() {
      setDashboardLoading(true);
      setError("");
      setInfo("");
      setPlanningError("");
      setRecurringError("");

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [
        summaryResult,
        recentResult,
        monthTransactionsResult,
        budgetsResult,
        goalsResult,
        goalContributionsResult,
        recurringResult,
      ] =
        await Promise.allSettled([
          getMyMonthSummary(year, month),
          loadMyRecentTransactions(200),
          loadMyTransactionsForMonth(year, month),
          loadMyBudgets(),
          loadMySavingsGoals(),
          loadMySavingsGoalContributions(),
          loadMyRecurringTransactions(),
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

      if (goalContributionsResult.status === "fulfilled") {
        setGoalContributions(goalContributionsResult.value);
      } else {
        setGoalContributions([]);
        planningErrors.push(
          "Savings goal contribution history is unavailable until the new Supabase contribution table is ready."
        );
      }

      if (planningErrors.length > 0) {
        setPlanningError("Planning tools are unavailable until the new Supabase budgets/goals tables are ready.");
      }

      if (recurringResult.status === "fulfilled") {
        setRecurringItems(sortRecurring(recurringResult.value));
      } else {
        setRecurringItems([]);
        setRecurringError(
          "Recurring planner is unavailable until the new Supabase recurring_transactions table is ready."
        );
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
  const goalContributionFormError = validateGoalContributionForm(goalContributionForm);
  const recurringFormError = validateRecurringForm(recurringForm);
  const canSaveTransaction = !savingTransaction && !formError;
  const canSaveBudget = !savingBudget && !budgetFormError;
  const canSaveGoal = !savingGoal && !goalFormError;
  const canSaveGoalContribution = !savingGoalContribution && !goalContributionFormError;
  const canSaveRecurring = !savingRecurring && !recurringFormError;
  const activeView = view;
  const activePlanningSection: PlanningSection =
    searchParams.get("section") === "goals" ? "goals" : "budgets";
  const currentDate = new Date();
  const todayDateKey = getLocalDateInputValue(currentDate);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const currentMonthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(currentDate);
  const monthlyIncome = summary?.income ?? 0;
  const monthlyExpenses = summary?.expenses ?? 0;
  const monthlyNet = summary?.net ?? 0;
  const hasTransactions = recent.length > 0;
  const hasBudgets = budgets.length > 0;
  const hasGoals = goals.length > 0;
  const hasRecurringItems = recurringItems.length > 0;
  const visibleRecent = useMemo(() => recent.slice(0, 12), [recent]);
  const insightSnapshot = useMemo(() => buildFinancialSnapshot(recent), [recent]);
  const planningSnapshot = useMemo(
    () =>
      buildPlanningSnapshot({
        year: currentYear,
        month: currentMonth,
        transactions: monthTransactions,
        budgets,
        goals,
        contributions: goalContributions,
      }),
    [currentMonth, currentYear, monthTransactions, budgets, goals, goalContributions]
  );
  const recurringSnapshot = useMemo(() => buildRecurringSnapshot(recurringItems), [recurringItems]);
  const weeklyPulse = useMemo(() => buildWeeklyPulseSnapshot(recent, recurringItems), [recent, recurringItems]);
  const aiPlaybooks = useMemo(() => {
    return [
      ...new Set([
        ...planningSnapshot.suggestedPrompts,
        ...recurringSnapshot.suggestedPrompts,
        ...weeklyPulse.suggestedPrompts,
        ...insightSnapshot.suggestedPrompts,
      ]),
    ].slice(0, 6);
  }, [
    planningSnapshot.suggestedPrompts,
    recurringSnapshot.suggestedPrompts,
    weeklyPulse.suggestedPrompts,
    insightSnapshot.suggestedPrompts,
  ]);
  const leadPrompt =
    aiPlaybooks[0] ?? "Review my latest spending and give me one concrete action for this week.";
  const recentFeed = useMemo(() => visibleRecent.slice(0, 4), [visibleRecent]);
  const upcomingRecurring = useMemo(() => recurringSnapshot.upcoming.slice(0, 6), [recurringSnapshot.upcoming]);
  const currentWeekKey = getTransactionWeekKey(todayDateKey);
  const currentWeekTransactions = useMemo(
    () => recent.filter((transaction) => getTransactionWeekKey(transaction.date) === currentWeekKey),
    [currentWeekKey, recent]
  );
  const currentWeekTransactionSummary = useMemo(
    () => summarizeTransactions(currentWeekTransactions),
    [currentWeekTransactions]
  );
  const monthTransactionSummary = useMemo(() => summarizeTransactions(monthTransactions), [monthTransactions]);
  const transactionWeekOptions = useMemo(() => {
    return [...new Set(recent.map((transaction) => getTransactionWeekKey(transaction.date)))].sort((left, right) =>
      right.localeCompare(left)
    );
  }, [recent]);
  const transactionMonthOptions = useMemo(() => {
    return [...new Set(recent.map((transaction) => getTransactionMonthKey(transaction.date)))].sort((left, right) =>
      right.localeCompare(left)
    );
  }, [recent]);
  const [selectedTransactionWeek, setSelectedTransactionWeek] = useState("");
  const [selectedTransactionMonth, setSelectedTransactionMonth] = useState("");
  const activeTransactionWeek = selectedTransactionWeek || transactionWeekOptions[0] || currentWeekKey;
  const activeTransactionMonth = selectedTransactionMonth || transactionMonthOptions[0] || currentMonthKey;
  const filteredTransactions = useMemo(() => {
    if (transactionPeriodMode === "week") {
      return recent.filter((transaction) => getTransactionWeekKey(transaction.date) === activeTransactionWeek);
    }

    if (transactionPeriodMode === "month") {
      return recent.filter((transaction) => getTransactionMonthKey(transaction.date) === activeTransactionMonth);
    }

    return recent;
  }, [activeTransactionMonth, activeTransactionWeek, recent, transactionPeriodMode]);
  const filteredTransactionSummary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions]
  );
  const groupedFilteredTransactions = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions]
  );
  const focusItems = useMemo(() => {
    const next: string[] = [];

    if (planningSnapshot.budgetsOverLimit > 0) {
      next.push(`${planningSnapshot.budgetsOverLimit} budget ${planningSnapshot.budgetsOverLimit === 1 ? "is" : "are"} already over limit.`);
    } else if (planningSnapshot.budgetsAtRisk > 0) {
      next.push(`${planningSnapshot.budgetsAtRisk} budget ${planningSnapshot.budgetsAtRisk === 1 ? "is" : "are"} close to the limit.`);
    }

    if (weeklyPulse.currentWeekNet < 0) {
      next.push(`This week's net cash flow is ${formatEUR(weeklyPulse.currentWeekNet)}.`);
    } else if (weeklyPulse.currentWeekNet > 0) {
      next.push(`This week is currently positive by ${formatEUR(weeklyPulse.currentWeekNet)}.`);
    }

    if (recurringSnapshot.dueThisWeekCount > 0) {
      next.push(`${recurringSnapshot.dueThisWeekCount} recurring item${recurringSnapshot.dueThisWeekCount === 1 ? "" : "s"} need attention this week.`);
    }

    if (next.length === 0) {
      next.push("Your dashboard is calm right now. Keep tracking to maintain a clear picture.");
    }

    return next.slice(0, 3);
  }, [
    planningSnapshot.budgetsAtRisk,
    planningSnapshot.budgetsOverLimit,
    recurringSnapshot.dueThisWeekCount,
    weeklyPulse.currentWeekNet,
  ]);
  const setupChecklist = [
    {
      key: "transactions",
      done: hasTransactions,
      title: t("dashboard_setup_transactions_title"),
      detail: t("dashboard_setup_transactions_detail"),
      action: t("dashboard_add_transaction"),
      onClick: () => {
        setForm(initialFormState());
        setOpenAdd(true);
      },
    },
    {
      key: "budget",
      done: hasBudgets,
      title: t("dashboard_setup_budget_title"),
      detail: t("dashboard_setup_budget_detail"),
      action: t("dashboard_add_budget"),
      onClick: () => openBudgetEditor(),
    },
    {
      key: "goal",
      done: hasGoals,
      title: t("dashboard_setup_goal_title"),
      detail: t("dashboard_setup_goal_detail"),
      action: t("dashboard_add_goal"),
      onClick: () => openGoalEditor(),
    },
    {
      key: "recurring",
      done: hasRecurringItems,
      title: t("dashboard_setup_recurring_title"),
      detail: t("dashboard_setup_recurring_detail"),
      action: t("dashboard_add_recurring"),
      onClick: () => openRecurringEditor(),
    },
  ];
  const setupRemainingCount = setupChecklist.filter((item) => !item.done).length;
  const pageHeading =
    activeView === "overview"
      ? t("dashboard_overview")
      : activeView === "plan"
        ? t("dashboard_planning")
        : t("dashboard_recurring");
  const pageDescription =
    activeView === "overview"
      ? t("dashboard_description_overview")
      : activeView === "plan"
        ? t("dashboard_description_planning")
        : t("dashboard_description_recurring");

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

      setRecent((prev) => [row, ...prev].slice(0, 200));
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

  function updateGoalContributionForm<K extends keyof GoalContributionFormState>(
    key: K,
    value: GoalContributionFormState[K]
  ) {
    setGoalContributionForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateRecurringForm<K extends keyof RecurringFormState>(key: K, value: RecurringFormState[K]) {
    setRecurringForm((prev) => ({ ...prev, [key]: value }));
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

  function openGoalContributionEditor(goal: SavingsGoalRow | { id: number; name: string }) {
    setGoalContributionForm({
      goalId: goal.id,
      goalName: goal.name,
      amount: "",
      contributionDate: getLocalDateInputValue(),
      note: "",
    });
    setOpenGoalContributionModal(true);
  }

  function openRecurringEditor(item?: RecurringTransactionRow) {
    if (item) {
      setRecurringForm({
        id: item.id,
        name: item.name,
        type: item.type,
        amount: String(item.amount),
        category: item.category,
        note: item.note ?? "",
        frequency: item.frequency,
        cadence: String(item.cadence),
        nextDueDate: item.next_due_date,
        active: item.active,
      });
    } else {
      setRecurringForm(initialRecurringFormState());
    }

    setOpenRecurringModal(true);
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

  async function onSaveGoalContribution(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveGoalContribution || !goalContributionForm.goalId) return;

    setSavingGoalContribution(true);
    setError("");
    setInfo("");

    try {
      const saved = await insertMySavingsGoalContribution({
        goal_id: goalContributionForm.goalId,
        amount: Number(goalContributionForm.amount),
        contribution_date: goalContributionForm.contributionDate,
        note: goalContributionForm.note,
      });

      setGoalContributions((prev) => [saved, ...prev]);
      setOpenGoalContributionModal(false);
      setGoalContributionForm(initialGoalContributionFormState());
      setInfo("Savings contribution added.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to add savings contribution."));
    } finally {
      setSavingGoalContribution(false);
    }
  }

  async function onDeleteGoalContribution(id: number) {
    const confirmed = window.confirm("Delete this savings contribution?");
    if (!confirmed) return;

    setError("");
    setInfo("");

    try {
      await deleteMySavingsGoalContribution(id);
      setGoalContributions((prev) => prev.filter((contribution) => contribution.id !== id));
      setInfo("Savings contribution deleted.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Failed to delete savings contribution."));
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

  async function onSaveRecurring(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveRecurring) return;

    setSavingRecurring(true);
    setError("");
    setInfo("");

    try {
      const saved = await upsertMyRecurringTransaction({
        id: recurringForm.id,
        name: recurringForm.name,
        type: recurringForm.type,
        amount: Number(recurringForm.amount),
        category: recurringForm.category,
        note: recurringForm.note,
        frequency: recurringForm.frequency,
        cadence: Number(recurringForm.cadence),
        next_due_date: recurringForm.nextDueDate,
        active: recurringForm.active,
      });

      setRecurringItems((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== saved.id);
        return sortRecurring([...withoutCurrent, saved]);
      });
      setOpenRecurringModal(false);
      setRecurringForm(initialRecurringFormState());
      setRecurringError("");
      setInfo(recurringForm.id ? "Recurring item updated successfully." : "Recurring item created successfully.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save recurring item."));
    } finally {
      setSavingRecurring(false);
    }
  }

  async function onDeleteRecurring(id: number) {
    const confirmed = window.confirm("Delete this recurring item?");
    if (!confirmed) return;

    setError("");
    setInfo("");

    try {
      await deleteMyRecurringTransaction(id);
      setRecurringItems((prev) => prev.filter((item) => item.id !== id));
      setInfo("Recurring item deleted.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Failed to delete recurring item."));
    }
  }

  async function onLogRecurring(id: number) {
    setError("");
    setInfo("");

    try {
      const result = await logMyRecurringTransaction(id);
      setRecurringItems((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== result.recurring.id);
        return sortRecurring([...withoutCurrent, result.recurring]);
      });
      setRecent((prev) => [result.transaction, ...prev].slice(0, 200));
      if (result.transaction.date.startsWith(currentMonthKey)) {
        setMonthTransactions((prev) => [result.transaction, ...prev]);
        setSummary((prev) => {
          const base = prev ?? { income: 0, expenses: 0, net: 0 };
          const income =
            base.income + (result.transaction.type === "income" ? Number(result.transaction.amount) : 0);
          const expenses =
            base.expenses + (result.transaction.type === "expense" ? Number(result.transaction.amount) : 0);
          return { income, expenses, net: income - expenses };
        });
      }
      setInfo(`Logged recurring item "${result.recurring.name}".`);
    } catch (logError) {
      setError(getErrorMessage(logError, "Failed to log recurring item."));
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <BrandLogo href="/dashboard" compact />
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{pageHeading}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pageDescription} {activeView === "overview" ? `Month: ${currentMonthLabel}.` : null}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {activeView === "overview" ? (
              <button
                onClick={() => {
                  setForm(initialFormState());
                  setOpenAdd(true);
                }}
                className="border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                {t("dashboard_add_transaction")}
              </button>
            ) : null}

            {activeView === "plan" ? (
              <>
                {activePlanningSection === "budgets" ? (
                  <button
                    onClick={() => openBudgetEditor()}
                    className="border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                  >
                    {t("dashboard_add_budget")}
                  </button>
                ) : (
                  <button
                    onClick={() => openGoalEditor()}
                    className="border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                  >
                    {t("dashboard_add_goal")}
                  </button>
                )}
              </>
            ) : null}

            {activeView === "automation" ? (
              <button
                onClick={() => openRecurringEditor()}
                className="border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                {t("dashboard_add_recurring")}
              </button>
            ) : null}

            <Link
              href={
                activeView === "overview"
                  ? { pathname: "/dashboard/assistant", query: { prompt: leadPrompt } }
                  : "/dashboard/assistant"
              }
              className="border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              {t("dashboard_open_ai")}
            </Link>
          </div>
        </div>
      </section>

      <div className="fixed right-4 top-24 z-40 w-[calc(100vw-2rem)] max-w-md space-y-3 sm:right-6 lg:right-8">
        {info ? (
          <div className="border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900 shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
            <div className="font-semibold">Saved</div>
            <div className="mt-1 leading-6 text-blue-800">{info}</div>
          </div>
        ) : null}

        {error ? (
          <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
            <div className="font-semibold">Error</div>
            <div className="mt-1 leading-6 text-red-800">{error}</div>
          </div>
        ) : null}
      </div>

      {activeView === "overview" ? (
        <>
          {setupRemainingCount > 0 ? (
            <section className="border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{t("dashboard_start_here")}</div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {t("dashboard_setup_title")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t("dashboard_setup_description", {
                      count: setupRemainingCount,
                      suffix: setupRemainingCount === 1 ? "" : "s",
                    })}
                  </p>
                </div>

                <Link
                  href={{
                    pathname: "/dashboard/assistant",
                    query: { prompt: "Guide me through setting up my SoloLedger workspace." },
                  }}
                  className="border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  {t("dashboard_setup_ai_guide")}
                </Link>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {setupChecklist.map((item) => (
                  <article
                    key={item.key}
                    className={[
                      "flex items-start justify-between gap-4 border px-4 py-4",
                      item.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={[
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                            item.done ? "bg-emerald-600 text-white" : "bg-slate-900 text-white",
                          ].join(" ")}
                        >
                          {item.done ? "OK" : t("common_next")}
                        </span>
                        <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                    </div>

                    {item.done ? (
                      <StatusBadge tone="green">{t("common_done")}</StatusBadge>
                    ) : (
                      <button
                        type="button"
                        onClick={item.onClick}
                        className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        {item.action}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <article className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Income</div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{formatEUR(monthlyIncome)}</div>
              <p className="mt-2 text-sm text-slate-600">Tracked this month.</p>
            </article>

            <article className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Expenses</div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{formatEUR(monthlyExpenses)}</div>
              <p className="mt-2 text-sm text-slate-600">Tracked this month.</p>
            </article>

            <article className="border border-slate-950 bg-slate-950 p-5 text-white shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Net</div>
              <div className="mt-3 text-3xl font-semibold">{formatEUR(monthlyNet)}</div>
              <p className="mt-2 text-sm text-slate-300">
                {monthlyNet >= 0 ? "Positive position this month." : "Current month is under pressure."}
              </p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <article className="border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">This week</div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Cash flow snapshot</h2>
                </div>
                <Pill tone={weeklyPulse.currentWeekNet >= 0 ? "green" : "red"}>
                  {weeklyPulse.currentWeekNet >= 0 ? "On track" : "Watch spend"}
                </Pill>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Weekly net</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{formatEUR(weeklyPulse.currentWeekNet)}</div>
                  </div>
                  <div className="border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Due soon</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{weeklyPulse.upcomingRecurringCount}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {focusItems.slice(0, 3).map((item) => (
                    <div key={item} className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="border border-slate-200 bg-white px-4 py-4">
                  <div className="text-sm font-semibold text-slate-950">AI shortcut</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {insightSnapshot.topExpenseCategory
                      ? `${insightSnapshot.topExpenseCategory.category} is the largest expense category right now.`
                      : "Ask the assistant to review your latest spending and suggest one simple next step."}
                  </p>
                  <Link
                    href={{ pathname: "/dashboard/assistant", query: { prompt: leadPrompt } }}
                    className="mt-4 inline-flex border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Ask with context
                  </Link>
                </div>
              </div>
            </article>

            <section className="border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Transactions</div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Transaction activity</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Recent records stay short here. Use the full history to review income and expenses by week or month.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {dashboardLoading ? <span className="text-sm text-slate-500">Loading...</span> : null}
                  <button
                    type="button"
                    onClick={() => setOpenTransactionsModal(true)}
                    className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    View transaction history
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Current week</div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500">Income</div>
                      <div className="mt-1 font-semibold text-emerald-700">
                        {formatEUR(currentWeekTransactionSummary.income)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Expenses</div>
                      <div className="mt-1 font-semibold text-rose-700">
                        {formatEUR(currentWeekTransactionSummary.expenses)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Net</div>
                      <div className="mt-1 font-semibold text-slate-950">
                        {formatEUR(currentWeekTransactionSummary.net)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Current month</div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500">Income</div>
                      <div className="mt-1 font-semibold text-emerald-700">{formatEUR(monthTransactionSummary.income)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Expenses</div>
                      <div className="mt-1 font-semibold text-rose-700">{formatEUR(monthTransactionSummary.expenses)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Net</div>
                      <div className="mt-1 font-semibold text-slate-950">{formatEUR(monthTransactionSummary.net)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {recentFeed.length === 0 ? (
                  <div className="border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                    No transactions yet. Add your salary, one recent expense, or today&apos;s spending and this page will
                    start showing a real picture of your month.
                  </div>
                ) : (
                  recentFeed.map((transaction) => {
                    const isExpense = transaction.type === "expense";
                    return (
                      <article key={transaction.id} className="border border-slate-200 bg-white px-5 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <span className={["h-3 w-3", isExpense ? "bg-rose-500" : "bg-emerald-500"].join(" ")} />
                              <div className="truncate text-base font-semibold text-slate-950">{transaction.category}</div>
                              <Pill tone={isExpense ? "red" : "green"}>{isExpense ? "Expense" : "Income"}</Pill>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {transaction.note?.trim() ? transaction.note : "No note added."}
                            </p>
                            <div className="mt-3 inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                              {transaction.date}
                            </div>
                          </div>

                          <div className={["text-2xl font-semibold", isExpense ? "text-rose-700" : "text-emerald-700"].join(" ")}>
                            {isExpense ? "-" : "+"}
                            {formatEUR(Number(transaction.amount))}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              {recent.length > recentFeed.length ? (
                <button
                  type="button"
                  onClick={() => setOpenTransactionsModal(true)}
                  className="mt-4 w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  View more transactions
                </button>
              ) : null}
            </section>
          </section>
        </>
      ) : null}

      {activeView === "plan" ? (
        <>
          <section className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Planning workspace
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {activePlanningSection === "budgets" ? "Spending control" : "Savings goals"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {activePlanningSection === "budgets"
                    ? "Budgets help you control the categories where money leaves the account."
                    : "Goals track longer-term priorities with dated savings contributions and progress."}
                </p>
              </div>
            </div>
          </section>

          {activePlanningSection === "budgets" ? (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <article className="border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Budgets on track
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">{planningSnapshot.budgetsOnTrack}</div>
                </article>
                <article className="border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Budgets at risk
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">
                    {planningSnapshot.budgetsAtRisk + planningSnapshot.budgetsOverLimit}
                  </div>
                </article>
                <article className="border border-slate-950 bg-slate-950 p-5 text-white shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Unbudgeted spend
                  </div>
                  <div className="mt-3 text-3xl font-semibold">
                    {formatEUR(planningSnapshot.unbudgetedExpenseTotal)}
                  </div>
                </article>
              </section>

              <div className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Budgets</div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Budgets</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Set a spending limit for each category so you can spot problems before the month gets away from you.
                </p>
              </div>

              <button
                onClick={() => openBudgetEditor()}
                className="border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Add budget
              </button>
            </div>

            {planningError ? (
              <div className="mt-5 border border-slate-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                {planningError}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {planningSnapshot.budgetProgress.length === 0 ? (
                <div className="border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                  No budgets yet. A good starting point is Food, Transport, Housing, and Entertainment, then adjust
                  them as your real spending becomes clearer.
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
                    <article key={budget.id} className="border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-slate-950">{budget.category}</div>
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
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Spent {formatEUR(budget.spent)} of {formatEUR(budget.monthly_limit)} this month.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openBudgetEditor(budget)}
                            className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteBudget(budget.id)}
                            className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white">
                        <div className={["h-full rounded-full", barTone].join(" ")} style={{ width: `${barWidth}%` }} />
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

            <div className="mt-5 border border-slate-900 bg-slate-950 p-5 text-white">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Unbudgeted spend</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {planningSnapshot.unbudgetedExpenseTotal > 0
                  ? `${formatEUR(planningSnapshot.unbudgetedExpenseTotal)} this month is still sitting outside your configured budgets.`
                  : "All tracked expense categories are covered by budgets this month."}
              </p>
              {planningSnapshot.unbudgetedCategories.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {planningSnapshot.unbudgetedCategories.slice(0, 6).map((category) => (
                    <span
                      key={category}
                      className="inline-flex rounded-md border border-white/12 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-200"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
              </div>
            </>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <article className="border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Active goals
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">{planningSnapshot.activeGoalCount}</div>
                </article>
                <article className="border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Saved so far
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">
                    {formatEUR(planningSnapshot.totalGoalCurrent)}
                  </div>
                </article>
                <article className="border border-slate-950 bg-slate-950 p-5 text-white shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Monthly goal load
                  </div>
                  <div className="mt-3 text-3xl font-semibold">
                    {formatEUR(planningSnapshot.totalMonthlyGoalTarget)}
                  </div>
                </article>
              </section>

          <div className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Savings goals</div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Savings goals</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep larger priorities visible so saving feels intentional, not accidental.
                </p>
              </div>

              <button
                onClick={() => openGoalEditor()}
                className="border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Add goal
                </button>
            </div>

            <div className="mt-5 space-y-3">
              {planningSnapshot.goalProgress.length === 0 ? (
                <div className="border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                  No savings goals yet. Good first goals are an emergency fund, a travel target, a tax buffer, or a
                  larger purchase you want to prepare for.
                </div>
              ) : (
                planningSnapshot.goalProgress.map((goal) => {
                  const progressWidth = Math.min(100, Math.max(6, Math.round(goal.progressRatio * 100)));

                  return (
                    <article key={goal.id} className="border border-slate-200 bg-white p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-slate-950">{goal.name}</div>
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
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {formatEUR(goal.current_amount)} saved of {formatEUR(goal.target_amount)} target.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openGoalContributionEditor(goal)}
                            className="border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                          >
                            Add contribution
                          </button>
                          <button
                            type="button"
                            onClick={() => openGoalEditor(goal)}
                            className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteGoal(goal.id)}
                            className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-950" style={{ width: `${progressWidth}%` }} />
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>Starting amount</span>
                          <span>{formatEUR(goal.starting_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Tracked contributions</span>
                          <span>{formatEUR(goal.contribution_total)}</span>
                        </div>
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
                          <span>{goal.effectiveMonthlyTarget ? formatEUR(goal.effectiveMonthlyTarget) : "Not set"}</span>
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
                        <div className="mt-4 border border-slate-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          You need about {formatEUR(goal.fundingGap)} more monthly surplus to fully fund this pace.
                        </div>
                      ) : null}

                      <div className="mt-4 border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-950">Contribution history</div>
                          <span className="text-xs text-slate-500">
                            {goal.recent_contributions.length === 0
                              ? "No entries yet"
                              : `${goal.recent_contributions.length} recent`}
                          </span>
                        </div>

                        {goal.recent_contributions.length === 0 ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Add contributions instead of editing the saved amount every month. This keeps the timeline
                            clear.
                          </p>
                        ) : (
                          <div className="mt-3 divide-y divide-slate-200 border border-slate-200 bg-white">
                            {goal.recent_contributions.map((contribution) => (
                              <div
                                key={contribution.id}
                                className="grid gap-3 px-3 py-3 text-sm sm:grid-cols-[1fr_auto_auto]"
                              >
                                <div>
                                  <div className="font-semibold text-slate-950">
                                    {formatTransactionDate(contribution.contribution_date)}
                                  </div>
                                  <div className="mt-1 text-slate-600">
                                    {contribution.note?.trim() ? contribution.note : "No note added."}
                                  </div>
                                </div>
                                <div className="font-semibold text-emerald-700">
                                  +{formatEUR(Number(contribution.amount))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void onDeleteGoalContribution(contribution.id)}
                                  className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
            </>
          )}
        </>
      ) : null}

      {activeView === "automation" ? (
        <>
          <section className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-3">
              <article className="border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Track repeating money first</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Rent, salary, subscriptions, loans, and tax transfers are the best items to add here first.
                </p>
              </article>
              <article className="border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Use one item for each repeat</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep each recurring payment or income source separate so the schedule stays easy to read.
                </p>
              </article>
              <article className="border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">Log it when it happens</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Once an item is due, use &quot;Log now&quot; to turn it into a tracked transaction without retyping it.
                </p>
              </article>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <article className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Active items</div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{recurringSnapshot.activeCount}</div>
            </article>
            <article className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Monthly fixed expenses</div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">
                {formatEUR(recurringSnapshot.monthlyCommittedExpenses)}
              </div>
            </article>
            <article className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Due this week</div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{recurringSnapshot.dueThisWeekCount}</div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <div className="border border-slate-900 bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Recurring overview</div>
              <h2 className="text-2xl font-semibold tracking-tight">Recurring items</h2>
              <p className="text-sm leading-6 text-slate-300">
                Keep rent, salary, subscriptions, and fixed transfers on a clear schedule so nothing catches you by
                surprise.
              </p>
            </div>

            <button
              onClick={() => openRecurringEditor()}
              className="mt-5 border border-white bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Add recurring item
            </button>

            {recurringError ? (
              <div className="mt-5 rounded-lg border border-amber-200/30 bg-amber-100/10 px-4 py-4 text-sm text-amber-100">
                {recurringError}
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Fixed commitments</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This section helps you remember repeating money movements without needing to track them manually every
                time.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              {focusItems.slice(0, 2).map((item) => (
                <div key={item} className="border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Recurring schedule</div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Fixed payments and income</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Every recurring item appears here with its next due date so you can log it quickly when it happens.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {upcomingRecurring.length === 0 ? (
                <div className="border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                  No recurring items yet. Add rent, salary, subscriptions, loan payments, or tax transfers so your
                  fixed money routine is visible in one place.
                </div>
              ) : (
                upcomingRecurring.map((item) => (
                  <article key={item.id} className="border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-slate-950">{item.name}</div>
                          <StatusBadge tone={item.type === "income" ? "green" : "slate"}>
                            {item.type === "income" ? "Income" : "Expense"}
                          </StatusBadge>
                          {!item.active ? <StatusBadge tone="slate">Paused</StatusBadge> : null}
                          {item.next_due_date < todayDateKey ? <StatusBadge tone="rose">Overdue</StatusBadge> : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {formatEUR(item.amount)} in {item.category}. {formatRecurringFrequency(item.frequency, item.cadence)}.
                        </p>
                        <div className="mt-3 inline-flex rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          Next due: {item.next_due_date}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onLogRecurring(item.id)}
                          className="border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                        >
                          Log now
                        </button>
                        <button
                          type="button"
                          onClick={() => openRecurringEditor(item)}
                          className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteRecurring(item.id)}
                          className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
          </section>
        </>
      ) : null}

      <Modal
        open={openTransactionsModal}
        title="Transaction history"
        size="xl"
        onClose={() => setOpenTransactionsModal(false)}
      >
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px_260px]">
            <div className="flex flex-wrap gap-2">
              {(["week", "month", "all"] as TransactionPeriodMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTransactionPeriodMode(mode)}
                  className={[
                    "border px-4 py-2 text-sm font-semibold transition",
                    transactionPeriodMode === mode
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {mode === "week" ? "Weekly view" : mode === "month" ? "Monthly view" : "All records"}
                </button>
              ))}
            </div>

            <label className={transactionPeriodMode === "week" ? "block" : "hidden"}>
              <span className="text-xs font-medium text-slate-600">Choose week</span>
              <select
                value={activeTransactionWeek}
                onChange={(event) => setSelectedTransactionWeek(event.target.value)}
                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
              >
                {transactionWeekOptions.length === 0 ? (
                  <option value={currentWeekKey}>{formatTransactionWeek(currentWeekKey)}</option>
                ) : (
                  transactionWeekOptions.map((week) => (
                    <option key={week} value={week}>
                      {formatTransactionWeek(week)}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className={transactionPeriodMode === "month" ? "block" : "hidden"}>
              <span className="text-xs font-medium text-slate-600">Choose month</span>
              <select
                value={activeTransactionMonth}
                onChange={(event) => setSelectedTransactionMonth(event.target.value)}
                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
              >
                {transactionMonthOptions.length === 0 ? (
                  <option value={currentMonthKey}>{formatTransactionMonth(currentMonthKey)}</option>
                ) : (
                  transactionMonthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatTransactionMonth(month)}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Records</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{filteredTransactions.length}</div>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Income</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-700">
                {formatEUR(filteredTransactionSummary.income)}
              </div>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Expenses</div>
              <div className="mt-2 text-2xl font-semibold text-rose-700">
                {formatEUR(filteredTransactionSummary.expenses)}
              </div>
            </div>
            <div className="border border-slate-950 bg-slate-950 p-4 text-white">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Net</div>
              <div className="mt-2 text-2xl font-semibold">{formatEUR(filteredTransactionSummary.net)}</div>
            </div>
          </div>

          <div className="max-h-[52vh] overflow-y-auto border border-slate-200">
            {groupedFilteredTransactions.length === 0 ? (
              <div className="bg-slate-50 px-5 py-8 text-sm leading-6 text-slate-600">
                No transactions found for this period.
              </div>
            ) : (
              groupedFilteredTransactions.map((group) => {
                const groupSummary = summarizeTransactions(group.transactions);

                return (
                  <section key={group.date} className="border-b border-slate-200 last:border-b-0">
                    <div className="flex flex-col gap-2 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{formatTransactionDate(group.date)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {group.transactions.length} record{group.transactions.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right text-xs sm:min-w-[320px]">
                        <div>
                          <div className="text-slate-500">Income</div>
                          <div className="mt-1 font-semibold text-emerald-700">{formatEUR(groupSummary.income)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Expenses</div>
                          <div className="mt-1 font-semibold text-rose-700">{formatEUR(groupSummary.expenses)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Net</div>
                          <div className="mt-1 font-semibold text-slate-950">{formatEUR(groupSummary.net)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 bg-white">
                      {group.transactions.map((transaction) => {
                        const isExpense = transaction.type === "expense";

                        return (
                          <div
                            key={transaction.id}
                            className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_150px]"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={["h-2.5 w-2.5", isExpense ? "bg-rose-500" : "bg-emerald-500"].join(" ")} />
                                <div className="font-semibold text-slate-950">{transaction.category}</div>
                                <Pill tone={isExpense ? "red" : "green"}>{isExpense ? "Expense" : "Income"}</Pill>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {transaction.note?.trim() ? transaction.note : "No note added."}
                              </p>
                            </div>
                            <div className={["text-right text-lg font-semibold", isExpense ? "text-rose-700" : "text-emerald-700"].join(" ")}>
                              {isExpense ? "-" : "+"}
                              {formatEUR(Number(transaction.amount))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={openAdd}
        title="Add transaction"
        onClose={() => {
          if (savingTransaction) return;
          setOpenAdd(false);
        }}
      >
        <form onSubmit={onAddTransaction} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            Start simple: add one income you receive and one expense you pay often. That is enough to make the
            dashboard useful.
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Money direction</label>
            <select
              value={form.type}
              onChange={(e) => updateForm("type", e.target.value as TransactionType)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            >
              <option value="expense">Money out (expense)</option>
              <option value="income">Money in (income)</option>
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
            <label className="text-xs font-medium text-slate-600">Category or purpose</label>
            <input
              value={form.category}
              onChange={(e) => updateForm("category", e.target.value)}
              placeholder="Food, Rent, Transport..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Short note (optional)</label>
            <input
              value={form.note}
              onChange={(e) => updateForm("note", e.target.value)}
              placeholder="Coffee, groceries..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingTransaction}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">When did it happen?</label>
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            A budget is simply a spending limit for one category. Start with categories where you usually overspend or
            want more visibility.
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Category to watch</label>
            <input
              value={budgetForm.category}
              onChange={(e) => updateBudgetForm("category", e.target.value)}
              placeholder="Food, Transport, Entertainment..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingBudget}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Monthly spending limit (EUR)</label>
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
            <label className="text-xs font-medium text-slate-600">Alert me when I reach (%)</label>
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
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            Choose one goal that matters to you. It can be practical, like an emergency fund, or personal, like travel
            or a new device.
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">What are you saving for?</label>
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
            <label className="text-xs font-medium text-slate-600">Already saved (EUR)</label>
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
            <label className="text-xs font-medium text-slate-600">Planned monthly saving (optional)</label>
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
            <label className="text-xs font-medium text-slate-600">Goal status</label>
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

      <Modal
        open={openGoalContributionModal}
        title="Add savings contribution"
        onClose={() => {
          if (savingGoalContribution) return;
          setOpenGoalContributionModal(false);
        }}
      >
        <form onSubmit={onSaveGoalContribution} className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            Add new savings as dated contributions. The goal total updates automatically while keeping the history.
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Goal</label>
            <input
              value={goalContributionForm.goalName}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
              disabled
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Contribution amount (EUR)</label>
            <input
              value={goalContributionForm.amount}
              onChange={(e) => updateGoalContributionForm("amount", e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 100"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoalContribution}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Contribution date</label>
            <input
              type="date"
              value={goalContributionForm.contributionDate}
              onChange={(e) => updateGoalContributionForm("contributionDate", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoalContribution}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Short note (optional)</label>
            <input
              value={goalContributionForm.note}
              onChange={(e) => updateGoalContributionForm("note", e.target.value)}
              placeholder="Salary transfer, monthly saving..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingGoalContribution}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {goalContributionFormError
              ? goalContributionFormError
              : "This contribution will be added to the goal progress without editing the original starting amount."}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSaveGoalContribution}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingGoalContribution ? "Saving..." : "Save contribution"}
            </button>

            <button
              type="button"
              disabled={savingGoalContribution}
              onClick={() => setOpenGoalContributionModal(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openRecurringModal}
        title={recurringForm.id ? "Edit recurring item" : "Add recurring item"}
        onClose={() => {
          if (savingRecurring) return;
          setOpenRecurringModal(false);
        }}
      >
        <form onSubmit={onSaveRecurring} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            Use this for money that repeats on a schedule, like salary, rent, subscriptions, loan payments, or tax
            transfers.
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Item name</label>
            <input
              value={recurringForm.name}
              onChange={(e) => updateRecurringForm("name", e.target.value)}
              placeholder="Rent, Salary, Spotify, Tax reserve..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Money direction</label>
            <select
              value={recurringForm.type}
              onChange={(e) => updateRecurringForm("type", e.target.value as TransactionType)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            >
              <option value="expense">Money out (expense)</option>
              <option value="income">Money in (income)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Amount (EUR)</label>
            <input
              value={recurringForm.amount}
              onChange={(e) => updateRecurringForm("amount", e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 499"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Category</label>
            <input
              value={recurringForm.category}
              onChange={(e) => updateRecurringForm("category", e.target.value)}
              placeholder="Housing, Payroll, Tools..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Note (optional)</label>
            <input
              value={recurringForm.note}
              onChange={(e) => updateRecurringForm("note", e.target.value)}
              placeholder="Optional context"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">How often?</label>
            <select
              value={recurringForm.frequency}
              onChange={(e) => updateRecurringForm("frequency", e.target.value as RecurringFrequency)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Repeat every</label>
            <input
              value={recurringForm.cadence}
              onChange={(e) => updateRecurringForm("cadence", e.target.value)}
              inputMode="numeric"
              placeholder="1"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Next due date</label>
            <input
              type="date"
              value={recurringForm.nextDueDate}
              onChange={(e) => updateRecurringForm("nextDueDate", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={savingRecurring}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={recurringForm.active}
                onChange={(e) => updateRecurringForm("active", e.target.checked)}
                disabled={savingRecurring}
              />
              Active recurring item
            </label>
          </div>

          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {recurringFormError
              ? recurringFormError
              : "Use recurring items to forecast fixed commitments and log them with one click when they hit."}
          </div>

          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSaveRecurring}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingRecurring ? "Saving..." : recurringForm.id ? "Save changes" : "Create recurring"}
            </button>

            <button
              type="button"
              disabled={savingRecurring}
              onClick={() => setOpenRecurringModal(false)}
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

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[60vh] place-items-center text-slate-600">
          Loading dashboard...
        </main>
      }
    >
      <DashboardWorkspace view="overview" />
    </Suspense>
  );
}

