import type { RecurringTransactionRow } from "./recurring";
import type { TransactionRow } from "./transactions";

export type WeeklyPulseTone = "positive" | "warning" | "neutral";

export type WeeklyPulseInsight = {
  id: string;
  title: string;
  detail: string;
  tone: WeeklyPulseTone;
};

export type WeeklyPulseSnapshot = {
  currentWeekIncome: number;
  currentWeekExpenses: number;
  currentWeekNet: number;
  previousWeekIncome: number;
  previousWeekExpenses: number;
  previousWeekNet: number;
  expenseChangeAmount: number;
  incomeChangeAmount: number;
  averageDailyExpense: number;
  transactionCount: number;
  topExpenseCategory: string | null;
  topExpenseCategoryAmount: number;
  upcomingRecurringCount: number;
  upcomingRecurringTotal: number;
  highlights: WeeklyPulseInsight[];
  suggestedPrompts: string[];
  contextSummary: string;
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

function getTodayDate(base = new Date()) {
  const timezoneOffsetMs = base.getTimezoneOffset() * 60_000;
  return new Date(base.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const next = parseDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return formatDate(next);
}

function inRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

export function buildWeeklyPulseSnapshot(
  transactions: TransactionRow[],
  recurringRows: RecurringTransactionRow[],
  baseDate = new Date()
): WeeklyPulseSnapshot {
  const today = getTodayDate(baseDate);
  const currentStart = addDays(today, -6);
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -6);
  const nextWeekEnd = addDays(today, 7);

  const currentWeekRows = transactions.filter((transaction) => inRange(transaction.date, currentStart, today));
  const previousWeekRows = transactions.filter((transaction) =>
    inRange(transaction.date, previousStart, previousEnd)
  );

  const currentWeekIncome = roundCurrency(
    currentWeekRows
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );
  const currentWeekExpenses = roundCurrency(
    currentWeekRows
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );
  const previousWeekIncome = roundCurrency(
    previousWeekRows
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );
  const previousWeekExpenses = roundCurrency(
    previousWeekRows
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );

  const currentWeekNet = roundCurrency(currentWeekIncome - currentWeekExpenses);
  const previousWeekNet = roundCurrency(previousWeekIncome - previousWeekExpenses);
  const expenseChangeAmount = roundCurrency(currentWeekExpenses - previousWeekExpenses);
  const incomeChangeAmount = roundCurrency(currentWeekIncome - previousWeekIncome);
  const averageDailyExpense = roundCurrency(currentWeekExpenses / 7);

  const expenseByCategory = new Map<string, number>();
  for (const transaction of currentWeekRows) {
    if (transaction.type !== "expense") continue;

    const category = transaction.category.trim() || "Other";
    expenseByCategory.set(category, (expenseByCategory.get(category) ?? 0) + Number(transaction.amount ?? 0));
  }

  const topExpenseCategoryEntry = [...expenseByCategory.entries()].sort((left, right) => right[1] - left[1])[0];
  const topExpenseCategory = topExpenseCategoryEntry?.[0] ?? null;
  const topExpenseCategoryAmount = roundCurrency(topExpenseCategoryEntry?.[1] ?? 0);

  const upcomingRecurring = recurringRows.filter(
    (row) => row.active && row.next_due_date >= today && row.next_due_date <= nextWeekEnd
  );
  const upcomingRecurringTotal = roundCurrency(
    upcomingRecurring
      .filter((row) => row.type === "expense")
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  );

  const highlights: WeeklyPulseInsight[] = [];

  if (currentWeekExpenses === 0 && currentWeekIncome === 0) {
    highlights.push({
      id: "quiet-week",
      title: "Quiet ledger week",
      detail: "No income or expense activity was tracked in the last 7 days.",
      tone: "neutral",
    });
  } else {
    if (expenseChangeAmount > 0 && previousWeekExpenses > 0) {
      highlights.push({
        id: "expense-rise",
        title: "Spending is up week over week",
        detail: `Expenses increased by ${formatEUR(expenseChangeAmount)} compared with the previous 7-day window.`,
        tone: expenseChangeAmount >= previousWeekExpenses * 0.25 ? "warning" : "neutral",
      });
    } else if (expenseChangeAmount < 0) {
      highlights.push({
        id: "expense-drop",
        title: "Spending cooled down",
        detail: `Expenses are down ${formatEUR(Math.abs(expenseChangeAmount))} versus the previous week.`,
        tone: "positive",
      });
    }

    if (currentWeekNet > 0) {
      highlights.push({
        id: "positive-week",
        title: "Positive 7-day cash flow",
        detail: `Your tracked net for the last 7 days is ${formatEUR(currentWeekNet)}.`,
        tone: "positive",
      });
    } else if (currentWeekNet < 0) {
      highlights.push({
        id: "negative-week",
        title: "Negative 7-day cash flow",
        detail: `You spent ${formatEUR(Math.abs(currentWeekNet))} more than you brought in during the last 7 days.`,
        tone: "warning",
      });
    }

    if (topExpenseCategory && topExpenseCategoryAmount > 0) {
      highlights.push({
        id: "top-category",
        title: `${topExpenseCategory} led this week`,
        detail: `${topExpenseCategory} accounted for ${formatEUR(topExpenseCategoryAmount)} of last week's expense activity.`,
        tone: "neutral",
      });
    }
  }

  if (upcomingRecurring.length > 0) {
    highlights.push({
      id: "upcoming-commitments",
      title: "Upcoming fixed commitments",
      detail: `${upcomingRecurring.length} recurring item${upcomingRecurring.length === 1 ? "" : "s"} are due in the next 7 days.`,
      tone: upcomingRecurringTotal > currentWeekExpenses && upcomingRecurringTotal > 0 ? "warning" : "neutral",
    });
  }

  const suggestedPrompts = [
    expenseChangeAmount > 0
      ? "Why did my spending increase this week, and what should I cut first?"
      : "Summarize my last 7 days and tell me what to improve next week.",
    upcomingRecurring.length > 0
      ? `Help me plan for ${upcomingRecurring.length} recurring item${upcomingRecurring.length === 1 ? "" : "s"} due next week.`
      : "How should I structure next week's spending plan?",
    topExpenseCategory
      ? `Give me a one-week action plan to reduce ${topExpenseCategory} spending.`
      : "What signals can you infer from my weekly cash flow?",
  ];

  const recurringLines =
    upcomingRecurring.length > 0
      ? upcomingRecurring
          .slice(0, 4)
          .map((item) => `- ${item.name}: ${formatEUR(item.amount)} due ${item.next_due_date}`)
      : ["- No recurring items due in the next 7 days."];

  const contextSummary = [
    `Weekly pulse window: ${currentStart} to ${today}.`,
    `Current 7-day income: ${formatEUR(currentWeekIncome)}.`,
    `Current 7-day expenses: ${formatEUR(currentWeekExpenses)}.`,
    `Current 7-day net: ${formatEUR(currentWeekNet)}.`,
    `Previous 7-day income: ${formatEUR(previousWeekIncome)}.`,
    `Previous 7-day expenses: ${formatEUR(previousWeekExpenses)}.`,
    `Previous 7-day net: ${formatEUR(previousWeekNet)}.`,
    `Expense change vs previous week: ${formatEUR(expenseChangeAmount)}.`,
    `Income change vs previous week: ${formatEUR(incomeChangeAmount)}.`,
    `Average daily expense this week: ${formatEUR(averageDailyExpense)}.`,
    topExpenseCategory
      ? `Top expense category this week: ${topExpenseCategory} at ${formatEUR(topExpenseCategoryAmount)}.`
      : "Top expense category this week: not enough expense data.",
    `Upcoming recurring due in 7 days: ${upcomingRecurring.length} item(s), ${formatEUR(upcomingRecurringTotal)} of expense commitments.`,
    "Upcoming recurring detail:",
    ...recurringLines,
  ].join("\n");

  return {
    currentWeekIncome,
    currentWeekExpenses,
    currentWeekNet,
    previousWeekIncome,
    previousWeekExpenses,
    previousWeekNet,
    expenseChangeAmount,
    incomeChangeAmount,
    averageDailyExpense,
    transactionCount: currentWeekRows.length,
    topExpenseCategory,
    topExpenseCategoryAmount,
    upcomingRecurringCount: upcomingRecurring.length,
    upcomingRecurringTotal,
    highlights: highlights.slice(0, 4),
    suggestedPrompts,
    contextSummary,
  };
}
