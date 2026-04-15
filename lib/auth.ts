import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export async function getCurrentUserOrThrow(): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Not authenticated");

  return user;
}
