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

export async function loadMyRecentTransactions(limit = 10) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) throw userErr;
  if (!user) throw new Error("Not authenticated");

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
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) throw userErr;
  if (!user) throw new Error("Not authenticated");

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

  let income = 0;
  let expenses = 0;

  for (const row of data ?? []) {
    const amt = Number((row as any).amount ?? 0);
    if ((row as any).type === "income") income += amt;
    else expenses += amt;
  }

  return { income, expenses, net: income - expenses, from, toExclusive };
}

export async function insertMyTransaction(params: {
  type: TransactionType;
  amount: number;
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD
}) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) throw userErr;
  if (!user) throw new Error("Not authenticated");

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