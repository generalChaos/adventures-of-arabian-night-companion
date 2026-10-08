import { describe, expect, it } from "vitest";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const EDITION = "11111111-1111-4111-8111-111111111111";

describe("board integrity", () => {
  it("every location has layout and no orphan edges", async () => {
    const sql = postgres(DATABASE_URL, { max: 1 });
    try {
      const missingLayout = await sql`
        select l.slug
        from public.locations l
        left join public.board_location_layout b on b.location_id = l.id
        where l.edition_id = ${EDITION}::uuid
          and b.location_id is null
      `;
      expect(missingLayout).toEqual([]);

      const orphanEdges = await sql`
        select e.id
        from public.board_edges e
        left join public.locations a on a.id = e.from_location_id
        left join public.locations b on b.id = e.to_location_id
        where e.edition_id = ${EDITION}::uuid
          and (a.id is null or b.id is null)
      `;
      expect(orphanEdges).toEqual([]);

      const [{ count }] = await sql<{ count: number }[]>`
        select count(*)::int as count
        from public.locations
        where edition_id = ${EDITION}::uuid
      `;
      expect(count).toBeGreaterThanOrEqual(12);
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
