import { count, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/database/drizzle";
import { appAdmins } from "@/infrastructure/database/schema";
import { createServerSupabaseClient } from "@/infrastructure/database/supabase/server";
import { DomainError } from "@/domain/game/types/errors";

/** Bootstrap: if no admins exist, the first authenticated caller becomes admin-capable. */
export async function requireAppAdmin(): Promise<{ userId: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new DomainError("UNAUTHORIZED", "Sign in required");

  const db = getDb();
  const [adminCount] = await db.select({ value: count() }).from(appAdmins);
  const total = Number(adminCount?.value ?? 0);

  if (total === 0) {
    await db
      .insert(appAdmins)
      .values({ userId: user.id })
      .onConflictDoNothing();
    return { userId: user.id };
  }

  const [row] = await db
    .select()
    .from(appAdmins)
    .where(eq(appAdmins.userId, user.id))
    .limit(1);

  if (!row) {
    throw new DomainError("FORBIDDEN", "Admin access required");
  }
  return { userId: user.id };
}
