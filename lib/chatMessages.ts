import { getCurrentUserOrThrow } from "./auth";
import { supabase } from "./supabaseClient";

export type ChatRole = "user" | "assistant";

export type ChatMessageRow = {
  id: number;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
};

export async function loadMyChatMessages(limit = 200) {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,user_id,role,content,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ChatMessageRow[];
}

export async function insertMyChatMessage(role: ChatRole, content: string) {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      user_id: user.id,
      role,
      content,
    })
    .select("id,user_id,role,content,created_at")
    .single();

  if (error) throw error;
  return data as ChatMessageRow;
}

export async function clearMyChatMessages() {
  const user = await getCurrentUserOrThrow();

  const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);
  if (error) throw error;
}
