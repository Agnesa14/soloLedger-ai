import { getCurrentUserOrThrow } from "./auth";
import { supabase } from "./supabaseClient";

export type TransactionType = "income" | "expense";

export type TransactionRow = {
  id: number;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string | null;
  date: string; // YYYY-MM-DD
  created_at: string;
};

type TransactionSummaryRow = {
  type: TransactionType;
  amount: number | string | null;
};

export async function loadMyRecentTransactions(limit = 10) {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabase
    .from("transactions")
    .select("id,user_id,type,amount,category,note,date,created_at")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TransactionRow[];
}

export async function getMyMonthSummary(year: number, month1to12: number) {
  const user = await getCurrentUserOrThrow();

  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const end = new Date(Date.UTC(year, month1to12, 1)); // next month

  const from = start.toISOString().slice(0, 10);
  const toExclusive = end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("transactions")
    .select("type,amount")
    .eq("user_id", user.id)
    .gte("date", from)
    .lt("date", toExclusive);

  if (error) throw error;

  const rows = (data ?? []) as TransactionSummaryRow[];

  const { income, expenses } = rows.reduce(
    (totals, row) => {
      const amount = Number(row.amount ?? 0);
      if (row.type === "income") totals.income += amount;
      else totals.expenses += amount;
      return totals;
    },
    { income: 0, expenses: 0 }
  );

  return { income, expenses, net: income - expenses, from, toExclusive };
}

export async function insertMyTransaction(params: {
  type: TransactionType;
  amount: number;
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD
}) {
  const user = await getCurrentUserOrThrow();

  const payload = {
    user_id: user.id,
    type: params.type,
    amount: params.amount,
    category: params.category.trim(),
    note: (params.note ?? "").trim() || null,
    date: params.date,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("id,user_id,type,amount,category,note,date,created_at")
    .single();

  if (error) throw error;
  return data as TransactionRow;
}
