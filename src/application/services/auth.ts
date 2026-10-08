import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/infrastructure/database/supabase/server";
import { DomainError } from "@/domain/game/types/errors";

/** Ensures a Supabase session exists, signing in anonymously if needed. */
export async function ensureAuthenticatedUser(): Promise<User> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new DomainError(
      "UNAUTHORIZED",
      error?.message ?? "Anonymous sign-in failed",
    );
  }
  return data.user;
}
