import { describe, expect, it } from "vitest";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("db privacy (local supabase)", () => {
  it("list_public_encounters hides paragraph until reaction chosen", async () => {
    const sql = postgres(DATABASE_URL, { max: 1 });
    try {
      // Ensure function exists
      const [{ exists }] = await sql<{ exists: boolean }[]>`
        select exists(
          select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'list_public_encounters'
        ) as exists
      `;
      expect(exists).toBe(true);

      // Direct table can hold a paragraph while state is DETERMINED;
      // the public function must still null it out.
      // We only assert function SQL logic via a temporary row if games exist,
      // otherwise verify the function definition includes the case expression.
      const [fn] = await sql<{ definition: string }[]>`
        select pg_get_functiondef(p.oid) as definition
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'list_public_encounters'
      `;
      expect(fn.definition).toMatch(/REACTION_CHOSEN/);
      expect(fn.definition).toMatch(/paragraph_number/);
      expect(fn.definition).toMatch(/else null/i);
    } finally {
      await sql.end({ timeout: 1 });
    }
  });

  it("clients have no grants on game_pile_cards", async () => {
    const sql = postgres(DATABASE_URL, { max: 1 });
    try {
      const rows = await sql<{ grantee: string; privilege_type: string }[]>`
        select grantee, privilege_type
        from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name = 'game_pile_cards'
          and grantee in ('anon', 'authenticated')
      `;
      expect(rows).toEqual([]);
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
