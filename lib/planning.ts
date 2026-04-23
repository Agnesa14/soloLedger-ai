import { getCurrentUserOrThrow } from "./auth";
import { supabase } from "./supabaseClient";
import type { TransactionRow } from "./transactions";

export type BudgetRow = {
  id: number;
  user_id: string;
  category: string;
  monthly_limit: number;
  alert_threshold: number;
  created_at: string;
  updated_at: string;
};

export type SavingsGoalStatus = "active" | "paused" | "completed";

export type SavingsGoalRow = {
  id: number;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution_target: number | null;
  target_date: string | null;
  status: SavingsGoalStatus;
  created_at: string;
  updated_at: string;
};

export type BudgetProgressStatus = "on_track" | "at_risk" | "over_limit";

export type BudgetProgress = BudgetRow & {
  spent: number;
  remaining: number;
  usageRatio: number;
  status: BudgetProgressStatus;
};

export type GoalFundingStatus = "complete" | "ready" | "tight" | "unfunded";

export type SavingsGoalProgress = SavingsGoalRow & {
  remaining: number;
  progressRatio: number;
  projectedMonthsLeft: number | null;
  requiredMonthlyContribution: number | null;
  effectiveMonthlyTarget: number | null;
  fundingGap: number | null;
  fundingStatus: GoalFundingStatus;
};

export type PlanningSnapshot = {
  monthKey: string;
  monthIncome: number;
  monthExpenses: number;
  monthNet: number;
  budgetProgress: BudgetProgress[];
  budgetsOnTrack: number;
  budgetsAtRisk: number;
  budgetsOverLimit: number;
  unbudgetedExpenseTotal: number;
  unbudgetedCategories: string[];
  goalProgress: SavingsGoalProgress[];
  activeGoalCount: number;
  completedGoalCount: number;
  totalGoalCurrent: number;
  totalGoalTarget: number;
  totalMonthlyGoalTarget: number;
  suggestedPrompts: string[];
  contextSummary: string;
};

type BudgetPayload = {
  id?: number;
  category: string;
  monthly_limit: number;
  alert_threshold?: number;
};

type SavingsGoalPayload = {
  id?: number;
  name: string;
  target_amount: number;
  current_amount?: number;
  monthly_contribution_target?: number | null;
  target_date?: string | null;
  status?: SavingsGoalStatus;
};

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function formatEUR(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

function normalizeCategory(value: string) {
  return value.trim().toLowerCase();
}

function getMonthKey(year: number, month1to12: number) {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

function getMonthsUntilTarget(targetDate: string, base = new Date()) {
  const [year, month] = targetDate.split("-").map(Number);
  if (!year || !month) return null;

  const currentYear = base.getFullYear();
  const currentMonth = base.getMonth() + 1;
  const months = (year - currentYear) * 12 + (month - currentMonth);

  return months >= 0 ? months + 1 : 0;
}

function getStatusRank(status: BudgetProgressStatus) {
  if (status === "over_limit") return 0;
  if (status === "at_risk") return 1;
  return 2;
}

export async function loadMyBudgets() {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabase
    .from("budgets")
    .select("id,user_id,category,monthly_limit,alert_threshold,created_at,updated_at")
    .eq("user_id", user.id)
    .order("category", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BudgetRow[];
}

export async function upsertMyBudget(params: BudgetPayload) {
  const user = await getCurrentUserOrThrow();

  const payload = {
    user_id: user.id,
    category: params.category.trim(),
    monthly_limit: roundCurrency(params.monthly_limit),
    alert_threshold: params.alert_threshold ?? 0.8,
    updated_at: new Date().toISOString(),
  };

  if (params.id) {
    const { data, error } = await supabase
      .from("budgets")
      .update(payload)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id,user_id,category,monthly_limit,alert_threshold,created_at,updated_at")
      .single();

    if (error) throw error;
    return data as BudgetRow;
  }

  const { data, error } = await supabase
    .from("budgets")
    .insert(payload)
    .select("id,user_id,category,monthly_limit,alert_threshold,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as BudgetRow;
}

export async function deleteMyBudget(id: number) {
  const user = await getCurrentUserOrThrow();
  const { error } = await supabase.from("budgets").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw error;
}

export async function loadMySavingsGoals() {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabase
    .from("savings_goals")
    .select(
      "id,user_id,name,target_amount,current_amount,monthly_contribution_target,target_date,status,created_at,updated_at"
    )
    .eq("user_id", user.id)
    .order("status", { ascending: true })
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SavingsGoalRow[];
}

export async function upsertMySavingsGoal(params: SavingsGoalPayload) {
  const user = await getCurrentUserOrThrow();

  const payload = {
    user_id: user.id,
    name: params.name.trim(),
    target_amount: roundCurrency(params.target_amount),
    current_amount: roundCurrency(params.current_amount ?? 0),
    monthly_contribution_target:
      params.monthly_contribution_target == null
        ? null
        : roundCurrency(params.monthly_contribution_target),
    target_date: params.target_date ?? null,
    status: params.status ?? "active",
    updated_at: new Date().toISOString(),
  };

  if (params.id) {
    const { data, error } = await supabase
      .from("savings_goals")
      .update(payload)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select(
        "id,user_id,name,target_amount,current_amount,monthly_contribution_target,target_date,status,created_at,updated_at"
      )
      .single();

    if (error) throw error;
    return data as SavingsGoalRow;
  }

  const { data, error } = await supabase
    .from("savings_goals")
    .insert(payload)
    .select(
      "id,user_id,name,target_amount,current_amount,monthly_contribution_target,target_date,status,created_at,updated_at"
    )
    .single();

  if (error) throw error;
  return data as SavingsGoalRow;
}

export async function deleteMySavingsGoal(id: number) {
  const user = await getCurrentUserOrThrow();
  const { error } = await supabase.from("savings_goals").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw error;
}

export function buildPlanningSnapshot(params: {
  year: number;
  month: number;
  transactions: TransactionRow[];
  budgets: BudgetRow[];
  goals: SavingsGoalRow[];
}) {
  const monthKey = getMonthKey(params.year, params.month);
  const monthTransactions = params.transactions.filter((transaction) => transaction.date.startsWith(monthKey));

  const monthIncome = roundCurrency(
    monthTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );
  const monthExpenses = roundCurrency(
    monthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );
  const monthNet = roundCurrency(monthIncome - monthExpenses);

  const expenseByCategory = new Map<string, { amount: number; label: string }>();
  for (const transaction of monthTransactions) {
    if (transaction.type !== "expense") continue;

    const label = transaction.category.trim() || "Other";
    const key = normalizeCategory(label);
    const previous = expenseByCategory.get(key) ?? { amount: 0, label };

    expenseByCategory.set(key, {
      amount: previous.amount + Number(transaction.amount ?? 0),
      label: previous.label,
    });
  }

  const budgetProgress = params.budgets
    .map((budget) => {
      const spent = roundCurrency(expenseByCategory.get(normalizeCategory(budget.category))?.amount ?? 0);
      const usageRatio = budget.monthly_limit > 0 ? spent / budget.monthly_limit : 0;
      const remaining = roundCurrency(budget.monthly_limit - spent);
      const status: BudgetProgressStatus =
        usageRatio >= 1 ? "over_limit" : usageRatio >= budget.alert_threshold ? "at_risk" : "on_track";

      return {
        ...budget,
        spent,
        remaining,
        usageRatio,
        status,
      };
    })
    .sort((left, right) => {
      const statusRank = getStatusRank(left.status) - getStatusRank(right.status);
      if (statusRank !== 0) return statusRank;
      return right.usageRatio - left.usageRatio;
    });

  const budgetCategoryKeys = new Set(params.budgets.map((budget) => normalizeCategory(budget.category)));
  const unbudgetedExpenseRows = [...expenseByCategory.entries()]
    .filter(([key]) => !budgetCategoryKeys.has(key))
    .map(([, value]) => value)
    .sort((left, right) => right.amount - left.amount);

  const unbudgetedExpenseTotal = roundCurrency(
    unbudgetedExpenseRows.reduce((sum, row) => sum + row.amount, 0)
  );
  const unbudgetedCategories = unbudgetedExpenseRows.map((row) => row.label);

  const goalProgress = params.goals
    .map((goal) => {
      const remaining = roundCurrency(Math.max(goal.target_amount - goal.current_amount, 0));
      const progressRatio =
        goal.target_amount > 0 ? Math.min(goal.current_amount / goal.target_amount, 1) : 0;
      const monthsUntilTarget = goal.target_date ? getMonthsUntilTarget(goal.target_date) : null;
      const requiredMonthlyContribution =
        goal.target_date && monthsUntilTarget && remaining > 0
          ? roundCurrency(remaining / monthsUntilTarget)
          : null;
      const effectiveMonthlyTarget = roundCurrency(
        Math.max(goal.monthly_contribution_target ?? 0, requiredMonthlyContribution ?? 0)
      );
      const normalizedTarget = effectiveMonthlyTarget > 0 ? effectiveMonthlyTarget : null;
      const projectedMonthsLeft =
        remaining <= 0
          ? 0
          : normalizedTarget
            ? Math.ceil(remaining / normalizedTarget)
            : null;
      const fundingGap =
        normalizedTarget === null ? null : roundCurrency(Math.max(0, normalizedTarget - Math.max(monthNet, 0)));
      const fundingStatus: GoalFundingStatus =
        remaining <= 0 || goal.status === "completed"
          ? "complete"
          : monthNet <= 0
            ? "unfunded"
            : fundingGap === 0
              ? "ready"
              : "tight";

      return {
        ...goal,
        remaining,
        progressRatio,
        projectedMonthsLeft,
        requiredMonthlyContribution,
        effectiveMonthlyTarget: normalizedTarget,
        fundingGap,
        fundingStatus,
      };
    })
    .sort((left, right) => {
      const leftComplete = left.fundingStatus === "complete" ? 1 : 0;
      const rightComplete = right.fundingStatus === "complete" ? 1 : 0;
      if (leftComplete !== rightComplete) return leftComplete - rightComplete;
      return left.remaining - right.remaining;
    });

  const budgetsOnTrack = budgetProgress.filter((budget) => budget.status === "on_track").length;
  const budgetsAtRisk = budgetProgress.filter((budget) => budget.status === "at_risk").length;
  const budgetsOverLimit = budgetProgress.filter((budget) => budget.status === "over_limit").length;

  const activeGoals = goalProgress.filter((goal) => goal.status === "active" && goal.fundingStatus !== "complete");
  const completedGoalCount = goalProgress.filter(
    (goal) => goal.status === "completed" || goal.fundingStatus === "complete"
  ).length;
  const totalGoalCurrent = roundCurrency(goalProgress.reduce((sum, goal) => sum + goal.current_amount, 0));
  const totalGoalTarget = roundCurrency(goalProgress.reduce((sum, goal) => sum + goal.target_amount, 0));
  const totalMonthlyGoalTarget = roundCurrency(
    activeGoals.reduce((sum, goal) => sum + (goal.effectiveMonthlyTarget ?? 0), 0)
  );

  const topBudgetRisk = budgetProgress.find((budget) => budget.status !== "on_track") ?? null;
  const nextGoal = activeGoals[0] ?? null;

  const suggestedPrompts = [
    topBudgetRisk
      ? `How can I get my ${topBudgetRisk.category} budget back under control this month?`
      : "Set up realistic monthly budgets based on my spending history.",
    nextGoal
      ? `Build a savings plan to finish my ${nextGoal.name} goal with my current cash flow.`
      : "Help me choose my first savings goal and contribution target.",
    unbudgetedExpenseTotal > 0
      ? `Which unbudgeted categories should I cap first to protect my savings plan?`
      : "Which category budget should I tighten first to save more money?",
  ];

  const budgetLines =
    budgetProgress.length > 0
      ? budgetProgress
          .slice(0, 4)
          .map(
            (budget) =>
              `- ${budget.category}: spent ${formatEUR(budget.spent)} of ${formatEUR(budget.monthly_limit)} (${formatPercent(
                budget.usageRatio
              )}), status=${budget.status}`
          )
      : ["- No budgets configured yet."];

  const goalLines =
    goalProgress.length > 0
      ? goalProgress
          .slice(0, 4)
          .map((goal) => {
            const monthlyTarget =
              goal.effectiveMonthlyTarget == null ? "no monthly target" : formatEUR(goal.effectiveMonthlyTarget);
            return `- ${goal.name}: ${formatEUR(goal.current_amount)} saved of ${formatEUR(goal.target_amount)} (${formatPercent(
              goal.progressRatio
            )}), status=${goal.fundingStatus}, monthly_target=${monthlyTarget}`;
          })
      : ["- No savings goals configured yet."];

  const contextSummary = [
    `Planning month: ${monthKey}.`,
    `Current month income: ${formatEUR(monthIncome)}.`,
    `Current month expenses: ${formatEUR(monthExpenses)}.`,
    `Current month net: ${formatEUR(monthNet)}.`,
    `Budget counts: ${budgetsOnTrack} on track, ${budgetsAtRisk} at risk, ${budgetsOverLimit} over limit.`,
    `Unbudgeted expense total: ${formatEUR(unbudgetedExpenseTotal)}.`,
    `Active savings goals: ${activeGoals.length}. Completed goals: ${completedGoalCount}.`,
    `Combined savings goal progress: ${formatEUR(totalGoalCurrent)} of ${formatEUR(totalGoalTarget)}.`,
    `Combined monthly goal funding target: ${formatEUR(totalMonthlyGoalTarget)}.`,
    "Budget details:",
    ...budgetLines,
    "Savings goal details:",
    ...goalLines,
    unbudgetedCategories.length > 0
      ? `Unbudgeted categories this month: ${unbudgetedCategories.slice(0, 5).join(", ")}.`
      : "Unbudgeted categories this month: none detected.",
  ].join("\n");

  return {
    monthKey,
    monthIncome,
    monthExpenses,
    monthNet,
    budgetProgress,
    budgetsOnTrack,
    budgetsAtRisk,
    budgetsOverLimit,
    unbudgetedExpenseTotal,
    unbudgetedCategories,
    goalProgress,
    activeGoalCount: activeGoals.length,
    completedGoalCount,
    totalGoalCurrent,
    totalGoalTarget,
    totalMonthlyGoalTarget,
    suggestedPrompts,
    contextSummary,
  } satisfies PlanningSnapshot;
}
