import { getCurrentUserOrThrow } from "./auth";
import { supabase } from "./supabaseClient";
import type { TransactionRow, TransactionType } from "./transactions";

export type RecurringFrequency = "weekly" | "monthly";

export type RecurringTransactionRow = {
  id: number;
  user_id: string;
  name: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string | null;
  frequency: RecurringFrequency;
  cadence: number;
  next_due_date: string;
  last_logged_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type RecurringSnapshot = {
  activeCount: number;
  dueThisWeekCount: number;
  overdueCount: number;
  monthlyCommittedIncome: number;
  monthlyCommittedExpenses: number;
  monthlyCommittedNet: number;
  upcoming: RecurringTransactionRow[];
  suggestedPrompts: string[];
  contextSummary: string;
};

type RecurringPayload = {
  id?: number;
  name: string;
  type: TransactionType;
  amount: number;
  category: string;
  note?: string;
  frequency: RecurringFrequency;
  cadence?: number;
  next_due_date: string;
  active?: boolean;
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

function parseDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toUtcDate(value: string) {
  const { year, month, day } = parseDateParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date) {
  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addDays(value: string, days: number) {
  const next = toUtcDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return fromUtcDate(next);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function advanceRecurringDueDate(
  date: string,
  frequency: RecurringFrequency,
  cadence = 1
) {
  if (frequency === "weekly") {
    return addDays(date, 7 * cadence);
  }

  const { year, month, day } = parseDateParts(date);
  const monthIndex = month - 1 + cadence;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth + 1));

  return formatDateParts(targetYear, targetMonth + 1, clampedDay);
}

function getTodayDate(base = new Date()) {
  const timezoneOffsetMs = base.getTimezoneOffset() * 60_000;
  return new Date(base.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function estimateMonthlyAmount(row: RecurringTransactionRow) {
  const cadence = Math.max(row.cadence, 1);
  if (row.frequency === "monthly") return row.amount / cadence;
  return (row.amount * 52) / 12 / cadence;
}

export async function loadMyRecurringTransactions() {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabase
    .from("recurring_transactions")
    .select(
      "id,user_id,name,type,amount,category,note,frequency,cadence,next_due_date,last_logged_at,active,created_at,updated_at"
    )
    .eq("user_id", user.id)
    .order("active", { ascending: false })
    .order("next_due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RecurringTransactionRow[];
}

export async function upsertMyRecurringTransaction(params: RecurringPayload) {
  const user = await getCurrentUserOrThrow();

  const payload = {
    user_id: user.id,
    name: params.name.trim(),
    type: params.type,
    amount: roundCurrency(params.amount),
    category: params.category.trim(),
    note: (params.note ?? "").trim() || null,
    frequency: params.frequency,
    cadence: Math.max(1, Math.floor(params.cadence ?? 1)),
    next_due_date: params.next_due_date,
    active: params.active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (params.id) {
    const { data, error } = await supabase
      .from("recurring_transactions")
      .update(payload)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select(
        "id,user_id,name,type,amount,category,note,frequency,cadence,next_due_date,last_logged_at,active,created_at,updated_at"
      )
      .single();

    if (error) throw error;
    return data as RecurringTransactionRow;
  }

  const { data, error } = await supabase
    .from("recurring_transactions")
    .insert(payload)
    .select(
      "id,user_id,name,type,amount,category,note,frequency,cadence,next_due_date,last_logged_at,active,created_at,updated_at"
    )
    .single();

  if (error) throw error;
  return data as RecurringTransactionRow;
}

export async function deleteMyRecurringTransaction(id: number) {
  const user = await getCurrentUserOrThrow();
  const { error } = await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

export async function logMyRecurringTransaction(id: number) {
  const user = await getCurrentUserOrThrow();

  const { data: recurring, error: recurringError } = await supabase
    .from("recurring_transactions")
    .select(
      "id,user_id,name,type,amount,category,note,frequency,cadence,next_due_date,last_logged_at,active,created_at,updated_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (recurringError) throw recurringError;

  const recurringRow = recurring as RecurringTransactionRow;
  const transactionPayload = {
    user_id: user.id,
    type: recurringRow.type,
    amount: recurringRow.amount,
    category: recurringRow.category,
    note: recurringRow.note,
    date: recurringRow.next_due_date,
  };

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert(transactionPayload)
    .select("id,user_id,type,amount,category,note,date,created_at")
    .single();

  if (transactionError) throw transactionError;

  const nextDueDate = advanceRecurringDueDate(
    recurringRow.next_due_date,
    recurringRow.frequency,
    recurringRow.cadence
  );

  const { data: updatedRecurring, error: updateError } = await supabase
    .from("recurring_transactions")
    .update({
      next_due_date: nextDueDate,
      last_logged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(
      "id,user_id,name,type,amount,category,note,frequency,cadence,next_due_date,last_logged_at,active,created_at,updated_at"
    )
    .single();

  if (updateError) throw updateError;

  return {
    transaction: transaction as TransactionRow,
    recurring: updatedRecurring as RecurringTransactionRow,
  };
}

export function buildRecurringSnapshot(rows: RecurringTransactionRow[], baseDate = new Date()): RecurringSnapshot {
  const today = getTodayDate(baseDate);
  const weekLimit = addDays(today, 7);
  const activeRows = rows.filter((row) => row.active);

  const sortedUpcoming = [...activeRows].sort((left, right) => left.next_due_date.localeCompare(right.next_due_date));
  const dueThisWeek = sortedUpcoming.filter(
    (row) => row.next_due_date >= today && row.next_due_date <= weekLimit
  );
  const overdueRows = sortedUpcoming.filter((row) => row.next_due_date < today);

  const monthlyCommittedIncome = roundCurrency(
    activeRows
      .filter((row) => row.type === "income")
      .reduce((sum, row) => sum + estimateMonthlyAmount(row), 0)
  );
  const monthlyCommittedExpenses = roundCurrency(
    activeRows
      .filter((row) => row.type === "expense")
      .reduce((sum, row) => sum + estimateMonthlyAmount(row), 0)
  );
  const monthlyCommittedNet = roundCurrency(monthlyCommittedIncome - monthlyCommittedExpenses);

  const suggestedPrompts = [
    dueThisWeek.length > 0
      ? `How should I prepare for my ${dueThisWeek.length} recurring item${dueThisWeek.length === 1 ? "" : "s"} due this week?`
      : "Help me set up recurring expenses and income in a clean way.",
    monthlyCommittedExpenses > 0
      ? `Which recurring expenses should I challenge first to improve my monthly cash flow?`
      : "What recurring commitments should I automate and track first?",
    overdueRows.length > 0
      ? `How should I catch up on overdue recurring items without losing track of my cash flow?`
      : "How much of my monthly plan is already spoken for by fixed commitments?",
  ];

  const upcomingLines =
    sortedUpcoming.length > 0
      ? sortedUpcoming
          .slice(0, 5)
          .map(
            (row) =>
              `- ${row.name}: ${formatEUR(row.amount)} ${row.type} due ${row.next_due_date} (${row.frequency}/${row.cadence})`
          )
      : ["- No recurring items configured yet."];

  const contextSummary = [
    `Recurring items active: ${activeRows.length}.`,
    `Recurring due this week: ${dueThisWeek.length}.`,
    `Recurring overdue: ${overdueRows.length}.`,
    `Estimated monthly recurring income: ${formatEUR(monthlyCommittedIncome)}.`,
    `Estimated monthly recurring expenses: ${formatEUR(monthlyCommittedExpenses)}.`,
    `Estimated monthly recurring net: ${formatEUR(monthlyCommittedNet)}.`,
    "Upcoming recurring items:",
    ...upcomingLines,
  ].join("\n");

  return {
    activeCount: activeRows.length,
    dueThisWeekCount: dueThisWeek.length,
    overdueCount: overdueRows.length,
    monthlyCommittedIncome,
    monthlyCommittedExpenses,
    monthlyCommittedNet,
    upcoming: sortedUpcoming.slice(0, 6),
    suggestedPrompts,
    contextSummary,
  };
}
