import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

let currentUserRequest: Promise<User> | null = null;

export async function getCurrentUserOrThrow(): Promise<User> {
  if (currentUserRequest) return currentUserRequest;

  currentUserRequest = (async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("Not authenticated");

    return user;
  })();

  try {
    return await currentUserRequest;
  } finally {
    currentUserRequest = null;
  }
}
