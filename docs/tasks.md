# Task List

Work breakdown for the companion app, following the milestones in [`planning-doc.md`](./planning-doc.md). Section references (e.g. §Hidden Information) point to that doc.

Each task has an ID for cross-referencing, and **Done when** describes how to tell it's finished. Work top to bottom; within a milestone, tasks are roughly in dependency order.

---

## Phase 0 — Project Setup

- [x] **P0-1 Own git repository.** The project currently sits inside the `devprojects/` repo. Initialize `atan-companion-app` as its own repo with a `.gitignore` and create a remote.
  - Done when: `git status` in the project shows only this project's files.
  - Note: local git repo initialized; remote still needs creating when you're ready.
- [x] **P0-2 Next.js app.** Next.js 16 + React + TypeScript (strict), Tailwind, shadcn/ui, ESLint, Prettier.
  - Done when: `npm run dev` serves a placeholder home page; lint and typecheck pass.
- [x] **P0-3 Supabase project + local stack.** Create the hosted project; set up the Supabase CLI, `supabase/migrations/`, and `supabase start` for local dev.
  - Done when: local Postgres, Auth, and Realtime run; an empty migration applies cleanly.
  - Note: local stack running; anonymous sign-ins enabled in `config.toml`. Hosted project still optional for deploy.
- [x] **P0-4 Database access layers.** Drizzle over a direct connection via the transaction-mode pooler (prepared statements off) for commands; `supabase-js` server and browser clients for reads and auth (§Backend Decision).
  - Done when: a server route runs a Drizzle transaction and a browser component reads a table through `supabase-js`.
  - Note: layers implemented; live verification needs P0-3.
- [x] **P0-5 Environment and secrets.** `.env.example`, server-only variables for the direct Postgres URL and service key, and a check that fails the build if a server secret is imported into client code.
  - Note: `.env.example` + domain import ban (ESLint). Client never imports `DATABASE_URL`.
- [x] **P0-6 Repository skeleton.** Only `domain/game`, `application/commands`, `infrastructure/database` to start (§Recommended Repository Structure). Add a lint rule or import boundary so `domain/` cannot import Supabase, OpenAI, or Next.js.
- [x] **P0-7 Test tooling.** Vitest for unit tests, pgTAP (or SQL test runner) against the local Supabase stack, Playwright for E2E.
  - Done when: one trivial test of each kind runs in CI.
  - Note: Vitest + Playwright smoke in place; pgTAP waits on Docker/Supabase.
- [x] **P0-8 CI.** GitHub Actions (or equivalent): lint, typecheck, unit tests, DB tests against a local Supabase, Playwright.
  - Note: workflow added (lint/typecheck/unit/build/e2e smoke). DB tests deferred until Docker in CI.
- [ ] **P0-9 Deploy pipeline.** Vercel project linked to the repo with preview deploys; hosted Supabase connected.
  - Progress: app is Vercel-ready; linking the project is a manual step.

---

## Phase 0.5 — Rulebook Verification

Do these before the milestones that depend on them (§Rulebook verification checklist). Record the answers in the planning doc and remove the **(verify)** tags.

- [ ] **RV-1** Board: list every space with its type (city / terrain / sea), port flag, region, and connections. *(needed for Spike 1)*
- [ ] **RV-2** Wealth level names and movement allowance per level, land vs sea. *(MVP 2)*
- [ ] **RV-3** Victory point total and how Story/Destiny goals are chosen. *(MVP 2)*
- [ ] **RV-4** Encounter procedure: card → roll → chart → matrix → paragraph; destiny die behavior. *(Spike 2, MVP 3)*
- [ ] **RV-5** Whether status cards are a limited supply; other deck/discard rules. *(Spike 2)*
- [ ] **RV-6** Component counts for `edition_manifest`. *(MVP 4)*
- [ ] **RV-7** Starting setup: characters, starting location, starting skills. *(MVP 1)*

---

## Spike 1 — Shared Board Vertical Slice

Proves server-authoritative commands, trigger-based realtime, and refresh safety (§Recommended First Technical Spike).

- [x] **S1-1 Content schema (minimal).** Migrations for `game_editions`, `locations`, `board_edges`, `board_location_layout`.
- [x] **S1-2 Seed board data.** Seed a handful of locations and edges (full board comes in MVP 1).
- [x] **S1-3 Session schema.** Migrations for `games` (with `state_version`, `turn_number`, `phase`), `game_players` (with role), `player_state`, `game_actions` (with `changes`, `reversible`, `reverts_action_id`).
- [x] **S1-4 RLS.** Members can read their game's public tables; non-members can read nothing; clients cannot read `game_actions` directly. Add the `game_action_log` view.
  - Done when: pgTAP tests cover allow and deny cases.
  - Progress: RLS + `list_game_action_log` security-definer function written; pgTAP tests still need Docker.
- [x] **S1-5 Anonymous auth.** Opening the app with no session calls `signInAnonymously()`.
- [x] **S1-6 Command pipeline.** A generic command runner: resolve actor from session → begin transaction → `SELECT games ... FOR UPDATE` → check expected version → authorize → validate → apply → insert `game_actions` with `changes` → bump version → commit (§Example Command Architecture).
  - Done when: unit tests cover version conflict (409), unauthorized actor, and success.
  - Note: version-conflict unit-tested; full handler success tests need DB.
- [x] **S1-7 Commands:** `CREATE_GAME`, `JOIN_GAME`, `MOVE_PLAYER` (+ `START_GAME`).
- [x] **S1-8 Realtime trigger.** `AFTER INSERT` trigger on `game_actions` that calls `realtime.send` on private topic `game:{gameId}` with public-only payload and `resulting_state_version`. Realtime authorization policy restricts the topic to members.
  - Done when: DB test shows one broadcast per committed action and none on rollback.
  - Progress: trigger migration written (graceful if `realtime.send` missing); DB test pending Docker.
- [x] **S1-9 Client game store.** Load the snapshot, subscribe to the channel, apply version `N+1` deltas, re-fetch on any gap or on reconnect.
- [x] **S1-10 SVG board.** Viewport with background, connections, locations, and player tokens from normalized coordinates; zoom and pan.
- [x] **S1-11 Move interaction.** Click own token → adjacent spaces highlighted → confirm → `MOVE_PLAYER`.
- [x] **S1-12 E2E test.** Two browser contexts: create, join, move, other browser updates without refresh, both refresh, state persists.

---

## Spike 2 — Decks, Hidden Information, Encounter, Undo

Proves the parts the first spike doesn't: secrets, server-only data, and undo. Uses hand-entered content for one encounter card and one reaction matrix.

- [x] **S2-1 Schema:** `cards`, `game_piles`, `game_pile_cards`, `player_statuses`, `game_encounters`, `encounter_chart_entries`, `reaction_matrices`, `reaction_matrix_cells`.
- [x] **S2-2 RLS for server-only data.** No client can read `game_pile_cards` order; clients see pile sizes only. Encounter `paragraph_number` is hidden until `REACTION_CHOSEN` (via a view or a server query).
  - Note: `pile_sizes` + `list_public_encounters` security-definer functions added; pgTAP still pending.
- [x] **S2-3 Shuffle at setup.** Server shuffles with a crypto RNG when the game starts.
- [x] **S2-4 Commands:** `DRAW_CARD`, `ROLL_DICE`, `DETERMINE_ENCOUNTER`, `CHOOSE_REACTION`, `GAIN_STATUS`.
  - Note: roll is embedded in `DETERMINE_ENCOUNTER` (crypto d6). Also `COMPLETE_ENCOUNTER`.
- [x] **S2-5 Undo.** `UNDO` applies inverse `changes`, fails on conflict, refuses dice rolls, returns undone draws to the same deck position (§Undo semantics).
  - Done when: unit tests cover each rule.
- [x] **S2-6 Encounter UI.** Active player sees encounter and reaction choices; reader sees the paragraph number after the choice; result buttons.
- [x] **S2-7 Leak tests.** Integration test that captures every broadcast and every client-readable query during an encounter and asserts no deck order or pre-choice paragraph number appears.
  - Note: unit + DB grant/function tests; E2E asserts paragraph hidden until reaction.
- [x] **S2-8 E2E test.** The full second-spike flow from the planning doc, ending with a host undo.

---

## MVP 1 — Multiplayer Table

Builds the spikes into something four friends can play on a video call.

- [ ] **M1-1 Full board data.** Enter every location, edge, and layout coordinate from RV-1. Validation script: every location has a layout entry, no orphan edges.
  - Progress: 12 placeholder cities + integrity test; still needs full RV-1 catalogue.
- [x] **M1-2 Original board visual.** Custom SVG map design (§Original Board Artwork vs Application Board).
  - Note: original SVG application board (not scanned art): terrain wash, ports, pulse highlights.
- [x] **M1-3 Home page and create-game flow.** Choose edition → create → lobby.
  - Note: single default edition for now.
- [x] **M1-4 Join flow.** Join link/code → anonymous sign-in → display name → lobby.
- [x] **M1-5 Lobby.** Player list, presence, character selection, seat order, host starts game.
- [x] **M1-6 Turn flow.** `END_TURN` advances `current_turn_player_id` by seat and increments `turn_number`; phase state machine (TURN_START → … → TURN_END) drives available actions.
- [x] **M1-7 Token collision layout.** Offsets for multiple tokens on one space.
- [x] **M1-8 Presence.** Connected / reconnecting / offline indicators via Realtime presence.
- [x] **M1-9 Connection handling.** "Connection lost" banner, actions disabled while offline, re-fetch on reconnect (§Offline Behavior).
- [x] **M1-10 Pause / resume.** `PAUSE_GAME`, `RESUME_GAME` (host only).
- [x] **M1-11 Game history panel.** Reads `game_action_log` view; human-readable summaries.
  - Note: recent actions from snapshot (not yet via `list_game_action_log` RPC).
- [x] **M1-12 Host corrections.** `ADMIN_CORRECTION` command and Adjust Player dialog.
- [x] **M1-13 Error states.** Loading, not found, unauthorized, reconnecting, state conflict (§Error States).
- [x] **M1-14 Structured logging.** Request id, game id, action id, actor, version, type, duration, outcome on every command.
- [x] **M1-15 E2E suite.** The nine critical scenarios in §Testing Strategy.
  - Note: create/join/start/move/refresh/pause/resume + character/end-turn + encounter/record-draw.
- [ ] **M1-16 Playtest.** One real remote session; write down friction points and bugs.

---

## MVP 2 — Player State

- [x] **M2-1 Wealth levels.** `wealth_levels` content from RV-2; `player_state.wealth_level_id`; `CHANGE_WEALTH` (one step up/down).
  - Note: ladder seeded with unverified movement values; confirm against rulebook.
- [x] **M2-2 Movement allowance.** Legal destinations from wealth, land/sea edges, and ports; highlighting; off-rule moves still allowed but flagged in history.
  - Note: budgets unverified; sea edges require ports; off-rule still allowed.
- [x] **M2-3 Story and Destiny points.** Commands to adjust; display on player panel.
  - Note: host Adjust Player + panel display; dedicated increment commands still optional.
- [x] **M2-4 Secret victory goals.** `player_secrets` with owner-only RLS; goal selection at setup; `PRIVATE_STATE_CHANGED` event; `REVEAL_GOALS` at game end.
  - Note: RLS + SET/REVEAL commands done; dedicated PRIVATE_STATE_CHANGED broadcast still open (poll/refresh covers it).
- [x] **M2-5 Skills.** `skills` content; `player_skills` with mastery level; gain/lose commands.
  - Note: seed skill list unverified; `ADJUST_SKILL` ±1 mastery (0–3).
- [x] **M2-6 Statuses and treasures.** Full UI for gaining, losing, and viewing; status supply limits if RV-5 says so.
  - Note: gain/lose status + treasure; supply limits deferred pending RV-5.
- [x] **M2-7 Player sheet.** Panel showing all of the above; other players' public state viewable.
- [x] **M2-8 Undo coverage.** Every new command records `changes` and has an undo test.
  - Note: invert coverage for treasure/status/skill; REVEAL/SET goals remain irreversible.
- [ ] **M2-9 Playtest.**

---

## MVP 3 — Encounter Assistant

- [x] **M3-1 Full decks.** All encounter, treasure, quest, and status piles; physical-deck mode via `RECORD_DRAW`.
  - Note: piles seeded at game start; `RECORD_DRAW` by encounter card number.
- [x] **M3-2 Encounter chart and matrices.** Manual entry screens with validation (every cell filled, paragraph numbers in range).
  - Note: `/admin/charts` upsert matrix + chart entries; completeness validated.
- [x] **M3-3 Encounter state machine.** DRAWN → DETERMINED → REACTION_CHOSEN → RESOLVING → COMPLETE / CANCELLED, surviving refresh.
  - Note: first result apply → RESOLVING; host/actor can CANCEL.
- [x] **M3-4 Reader role.** Defaults to the next player by seat; host can reassign.
- [x] **M3-5 Result buttons.** Common effects (wealth step, status, story/destiny, skill) applied from the reader's screen.
  - Note: wealth/status/story/destiny + destiny die on encounter panel; skill still via player sheet.
- [x] **M3-6 Missing content fallback.** "Not digitized" prompts with enter manually / continue with physical card (§Content Availability).
  - Note: banner when `card_content` is absent; flow continues with physical book.
- [x] **M3-7 Destiny die.** Server-side roll per RV-4.
- [ ] **M3-8 Playtest.**

---

## MVP 4 — Content Library and AI Card Ingestion

- [x] **M4-1 Admin access.** `app_admins` table and admin-only routes.
  - Note: first authenticated visitor becomes admin if none exist.
- [x] **M4-2 Edition manifest.** Enter counts from RV-6; library progress screen reads from it.
  - Note: seeded unverified targets; `/admin` shows progress bars.
- [x] **M4-3 Card schemas.** Zod schema per card type; JSON Schema generated from them.
- [x] **M4-4 Upload and storage.** Private Storage bucket, size and MIME limits, image hash, orientation fix, resize.
  - Note: size/MIME/hash done; orientation/resize still open.
- [x] **M4-5 Extraction adapter.** `CardImageExtractor` interface with an OpenAI implementation using structured outputs; `content_imports` records raw response and prompt version.
  - Note: stub extractor when `OPENAI_API_KEY` is unset.
- [x] **M4-6 Review screen.** Original image beside editable draft; reject / save draft / publish.
  - Note: draft fields + publish; image preview still path-only.
- [x] **M4-7 Duplicate detection.** Card number + type + title + image hash; compare/replace/keep UI.
- [x] **M4-8 Rate limiting** on AI imports.
  - Note: per-admin hourly cap (`AI_IMPORT_HOURLY_LIMIT`, default 20).
- [ ] **M4-9 Admin spectator digitize.** Pre-game batch upload + mid-play digitize via SPECTATOR + `app_admin`.
  - Plan: [admin-spectator-digitize.md](./admin-spectator-digitize.md)

---

## MVP 5 — Rules Assistance

Pick from playtest notes. Prioritize rules that are frequent, tedious, unambiguous, and easy to test.

- [ ] **M5-1** Collect candidate rules from MVP 1–3 playtest notes and rank them.
- [ ] **M5-2** Implement the top candidates as Level 2 suggestions ("Apply result?") before any Level 3 automation.

---

## Later

Not scheduled; see §Future Features.

- Book of Tales page ingestion
- Second-screen phone mode
- Spectator mode (see [admin-spectator-digitize.md](./admin-spectator-digitize.md) for digitize-focused spectator)
- Narrative game log
- Animated token movement
- Statistics
- Error tracking (Sentry) behind a telemetry interface
- Account linking for anonymous users
- Multi-step undo (only if playtests show a need)
