import { describe, expect, it } from "vitest";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("player_secrets RLS", () => {
  it("policy allows only the owning auth user to select", async () => {
    const sql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [policy] = await sql<{ qual: string }[]>`
        select pg_get_expr(polqual, polrelid) as qual
        from pg_policy
        where polrelid = 'public.player_secrets'::regclass
          and polname = 'player_secrets_select_owner'
      `;
      expect(policy?.qual ?? "").toMatch(/auth\.uid/);
      expect(policy?.qual ?? "").toMatch(/game_players/);

      const ownerId = crypto.randomUUID();
      const otherId = crypto.randomUUID();
      const editionId = "11111111-1111-4111-8111-111111111111";

      await sql`
        insert into auth.users (id, aud, role, email, created_at, updated_at, instance_id)
        values
          (${ownerId}::uuid, 'authenticated', 'authenticated', ${`o-${ownerId}@test.local`}, now(), now(), '00000000-0000-0000-0000-000000000000'),
          (${otherId}::uuid, 'authenticated', 'authenticated', ${`x-${otherId}@test.local`}, now(), now(), '00000000-0000-0000-0000-000000000000')
        on conflict (id) do nothing
      `;

      const [game] = await sql<{ id: string }[]>`
        insert into public.games (edition_id, join_code, status, phase, state_version)
        values (${editionId}::uuid, ${`T${ownerId.slice(0, 6).toUpperCase()}`}, 'LOBBY', 'LOBBY', 1)
        returning id
      `;

      const [ownerPlayer] = await sql<{ id: string }[]>`
        insert into public.game_players (game_id, user_id, role, display_name, seat, player_color)
        values (${game.id}::uuid, ${ownerId}::uuid, 'HOST', 'Owner', 0, '#000')
        returning id
      `;
      const [otherPlayer] = await sql<{ id: string }[]>`
        insert into public.game_players (game_id, user_id, role, display_name, seat, player_color)
        values (${game.id}::uuid, ${otherId}::uuid, 'PLAYER', 'Other', 1, '#fff')
        returning id
      `;

      await sql`
        insert into public.player_secrets (game_player_id, story_goal, destiny_goal)
        values
          (${ownerPlayer.id}::uuid, 12, 8),
          (${otherPlayer.id}::uuid, 5, 15)
      `;

      await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
        await tx`set local role authenticated`;
        const visible = await tx<{ game_player_id: string }[]>`
          select game_player_id from public.player_secrets
        `;
        expect(visible.map((r) => r.game_player_id)).toEqual([ownerPlayer.id]);
      });

      await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub', ${otherId}, true)`;
        await tx`set local role authenticated`;
        const visible = await tx<{ game_player_id: string }[]>`
          select game_player_id from public.player_secrets
        `;
        expect(visible.map((r) => r.game_player_id)).toEqual([otherPlayer.id]);
      });
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
