import type { TransactionRow } from "./transactions";

export type InsightTone = "positive" | "warning" | "neutral";

export type CategorySpend = {
  category: string;
  amount: number;
  shareOfExpenses: number;
  transactions: number;
};

export type FinancialInsight = {
  id: string;
  title: string;
  detail: string;
  tone: InsightTone;
};

export type FinancialSnapshot = {
  transactionCount: number;
  coverageDays: number;
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  savingsRate: number | null;
  averageExpense: number;
  averageDailyExpense: number;
  smallExpenseCount: number;
  smallExpenseTotal: number;
  topExpenseCategory: CategorySpend | null;
  categoryBreakdown: CategorySpend[];
  savingsTarget: number | null;
  savingsGap: number | null;
  highlights: FinancialInsight[];
  suggestedPrompts: string[];
  contextSummary: string;
};

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function formatEUR(amount: number) {
  return eurFormatter.format(amount);
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function formatPercent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getCoverageDays(transactions: TransactionRow[]) {
  if (transactions.length === 0) return 0;

  const timestamps = transactions.map((transaction) => parseDate(transaction.date).getTime());
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const dayMs = 86_400_000;

  return Math.max(1, Math.round((max - min) / dayMs) + 1);
}

function toneClassname(tone: InsightTone) {
  if (tone === "positive") return "positive";
  if (tone === "warning") return "warning";
  return "neutral";
}

export function buildFinancialSnapshot(transactions: TransactionRow[]): FinancialSnapshot {
  const expenseTransactions = transactions.filter((transaction) => transaction.type === "expense");
  const incomeTransactions = transactions.filter((transaction) => transaction.type === "income");

  const totalIncome = roundCurrency(
    incomeTransactions.reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );
  const totalExpenses = roundCurrency(
    expenseTransactions.reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );
  const net = roundCurrency(totalIncome - totalExpenses);
  const savingsRate = totalIncome > 0 ? net / totalIncome : null;
  const coverageDays = getCoverageDays(transactions);
  const averageExpense =
    expenseTransactions.length > 0 ? roundCurrency(totalExpenses / expenseTransactions.length) : 0;
  const averageDailyExpense = coverageDays > 0 ? roundCurrency(totalExpenses / coverageDays) : 0;

  const categoryMap = new Map<string, { amount: number; transactions: number }>();
  for (const transaction of expenseTransactions) {
    const category = transaction.category.trim() || "Other";
    const previous = categoryMap.get(category) ?? { amount: 0, transactions: 0 };
    categoryMap.set(category, {
      amount: previous.amount + Number(transaction.amount ?? 0),
      transactions: previous.transactions + 1,
    });
  }

  const categoryBreakdown = [...categoryMap.entries()]
    .map(([category, value]) => ({
      category,
      amount: roundCurrency(value.amount),
      shareOfExpenses: totalExpenses > 0 ? value.amount / totalExpenses : 0,
      transactions: value.transactions,
    }))
    .sort((left, right) => right.amount - left.amount);

  const topExpenseCategory = categoryBreakdown[0] ?? null;
  const savingsTarget = totalIncome > 0 ? roundCurrency(totalIncome * 0.2) : null;
  const savingsGap =
    savingsTarget === null ? null : roundCurrency(Math.max(0, savingsTarget - Math.max(net, 0)));

  const smallExpenseTransactions = expenseTransactions.filter((transaction) => Number(transaction.amount) <= 20);
  const smallExpenseCount = smallExpenseTransactions.length;
  const smallExpenseTotal = roundCurrency(
    smallExpenseTransactions.reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0)
  );

  const highlights: FinancialInsight[] = [];

  if (transactions.length === 0) {
    highlights.push({
      id: "no-data",
      title: "Build your money baseline",
      detail: "Track a few days of income and expenses to unlock personalized savings guidance.",
      tone: "neutral",
    });
  } else {
    if (savingsRate === null) {
      highlights.push({
        id: "missing-income",
        title: "Add income for better coaching",
        detail: "Income is not recorded yet, so the app cannot measure savings rate or safe spending limits.",
        tone: "neutral",
      });
    } else if (savingsRate >= 0.2) {
      highlights.push({
        id: "strong-savings",
        title: "Healthy savings rate",
        detail: `You are keeping about ${formatPercent(savingsRate)} of tracked income, which is above the 20% benchmark.`,
        tone: "positive",
      });
    } else if (savingsRate >= 0) {
      const gapText = savingsGap ? ` You need about ${formatEUR(savingsGap)} more saved to hit 20%.` : "";
      highlights.push({
        id: "moderate-savings",
        title: "Savings rate can improve",
        detail: `You are currently saving ${formatPercent(savingsRate)} of tracked income.${gapText}`,
        tone: "warning",
      });
    } else {
      highlights.push({
        id: "negative-net",
        title: "Spending is ahead of income",
        detail: `Tracked expenses are exceeding income by ${formatEUR(Math.abs(net))}. Stabilize this first before setting aggressive savings goals.`,
        tone: "warning",
      });
    }

    if (topExpenseCategory && topExpenseCategory.shareOfExpenses >= 0.3) {
      highlights.push({
        id: "top-category",
        title: `${topExpenseCategory.category} is the biggest lever`,
        detail: `${topExpenseCategory.category} makes up ${formatPercent(topExpenseCategory.shareOfExpenses)} of tracked expenses, so even a small reduction there will matter.`,
        tone: topExpenseCategory.shareOfExpenses >= 0.4 ? "warning" : "neutral",
      });
    }

    if (smallExpenseCount >= 5 && totalExpenses > 0 && smallExpenseTotal / totalExpenses >= 0.18) {
      highlights.push({
        id: "small-purchases",
        title: "Small purchases are stacking up",
        detail: `${smallExpenseCount} small purchases account for ${formatEUR(smallExpenseTotal)} of spending. Tiny habits may be hiding a large monthly leak.`,
        tone: "neutral",
      });
    }

    if (averageDailyExpense > 0) {
      highlights.push({
        id: "burn-rate",
        title: "Daily burn rate detected",
        detail: `Your tracked spending is averaging about ${formatEUR(averageDailyExpense)} per day across the current data window.`,
        tone: "neutral",
      });
    }
  }

  const suggestedPrompts = [
    topExpenseCategory
      ? `How can I reduce my ${topExpenseCategory.category} spending without making my life harder?`
      : "Create a simple budget for me based on my current spending.",
    savingsGap && savingsGap > 0
      ? `Give me a plan to free up ${formatEUR(savingsGap)} this month so I can hit a 20% savings rate.`
      : "How much should I save every month based on these numbers?",
    net < 0
      ? "What should I cut first so I stop overspending next month?"
      : "What is the smartest next step to strengthen my financial position?",
  ];

  const categoryLines = categoryBreakdown
    .slice(0, 5)
    .map(
      (item) =>
        `- ${item.category}: ${formatEUR(item.amount)} (${formatPercent(item.shareOfExpenses)} of expenses across ${item.transactions} transactions)`
    );

  const contextSummary = [
    `Tracked transactions analysed: ${transactions.length}.`,
    `Coverage window: ${coverageDays} day(s).`,
    `Income: ${formatEUR(totalIncome)}.`,
    `Expenses: ${formatEUR(totalExpenses)}.`,
    `Net: ${formatEUR(net)}.`,
    savingsRate === null ? "Savings rate: unavailable because income is missing." : `Savings rate: ${formatPercent(savingsRate)}.`,
    topExpenseCategory
      ? `Top expense category: ${topExpenseCategory.category} at ${formatEUR(topExpenseCategory.amount)} (${formatPercent(topExpenseCategory.shareOfExpenses)} of expenses).`
      : "Top expense category: not enough expense data yet.",
    categoryLines.length > 0 ? "Top categories:\n" + categoryLines.join("\n") : "Top categories: none yet.",
    `Daily burn estimate: ${formatEUR(averageDailyExpense)}.`,
    "Signals:",
    ...highlights.slice(0, 4).map(
      (highlight) => `- [${toneClassname(highlight.tone)}] ${highlight.title}: ${highlight.detail}`
    ),
  ].join("\n");

  return {
    transactionCount: transactions.length,
    coverageDays,
    incomeCount: incomeTransactions.length,
    expenseCount: expenseTransactions.length,
    totalIncome,
    totalExpenses,
    net,
    savingsRate,
    averageExpense,
    averageDailyExpense,
    smallExpenseCount,
    smallExpenseTotal,
    topExpenseCategory,
    categoryBreakdown,
    savingsTarget,
    savingsGap,
    highlights: highlights.slice(0, 4),
    suggestedPrompts,
    contextSummary,
  };
}

export function formatInsightCurrency(amount: number) {
  return formatEUR(amount);
}

export function formatInsightPercent(ratio: number | null) {
  if (ratio === null) return "N/A";
  return formatPercent(ratio);
}
