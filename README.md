# Arabian Nights Companion

Remote multiplayer companion for **Tales of the Arabian Nights** — a shared synchronized digital table, not a full digital reimplementation of the game.

See:

- [`docs/planning-doc.md`](./docs/planning-doc.md) — product & technical design
- [`docs/tasks.md`](./docs/tasks.md) — implementation task list

## Stack

- Next.js 16 + React + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres, Auth including anonymous, Realtime, Storage)
- Drizzle ORM over a direct Postgres connection for game commands
- Vitest + Playwright

## Setup

1. Copy env file:

   ```bash
   cp .env.example .env.local
   ```

2. Start local Supabase (**requires Docker**):

   ```bash
   npm run supabase:start
   npm run supabase:reset
   ```

   Put the printed URL, anon key, and DB URL into `.env.local`.

   Or point `.env.local` at a hosted Supabase project and push migrations with the Supabase CLI.

3. Install and run:

   ```bash
   npm install --legacy-peer-deps
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run lint` / `typecheck` / `test` | Quality gates |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run supabase:reset` | Apply migrations + seed |

## Architecture notes

- Game mutations are server commands inside a Postgres transaction (`SELECT … FOR UPDATE` on `games`).
- Realtime broadcasts come from a DB trigger on `game_actions` (public payload only).
- `src/domain/` must not import Supabase, Drizzle, or Next.js (enforced by ESLint).
