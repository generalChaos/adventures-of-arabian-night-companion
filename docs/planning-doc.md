# Adventures of the Tales of Arabian Nights
## Remote Multiplayer Companion App — Product & Technical Design

**Status:** Revised design (v2)  
**Purpose:** Define the product, UX, architecture, data model, realtime model, AI-assisted content ingestion, implementation stack, MVP scope, and major technical/product risks for a remote multiplayer companion application.

**v2 changes:** hidden information model, decks and card piles, wealth as a level, movement model, Book of Tales and reaction matrix content, transactional command implementation, trigger-based realtime broadcast, Supabase anonymous auth for guests, undo semantics with before/after diffs, merged membership tables, reordered MVPs, consolidated decisions table.

> Game-rule details in this document (wealth names, movement allowances, encounter procedure, card counts) are written from memory and must be verified against the rulebook for the edition being digitized. They are marked **(verify)** where it matters.

---

# 1. Product Summary

The application is a web-based companion for playing **Tales of the Arabian Nights** remotely with friends.

The application should not initially attempt to recreate the entire tabletop game as a fully automated digital game. Instead, it should function as a **shared synchronized digital table** that handles the parts of remote play that are awkward to reproduce over video chat:

- Shared board
- Player locations
- Turn state
- Player state
- Cards and game content
- Dice and randomization where useful
- Encounter references
- Statuses, treasures, skills, and counters
- Saving and resuming a game
- Synchronization between remote players

The software becomes the **single authoritative record of game state**.

Players should never be required to update a physical board and then duplicate the same action in the application.

The first version should support playing entirely from laptops or tablets. Phones may later function as optional secondary player displays but are **not required for the MVP**.

---

# 2. Product Goals

The primary goal is:

> Allow a group of friends in different locations to play Tales of the Arabian Nights together with approximately the same shared-state experience as sitting around one board.

Secondary goals:

- Eliminate manual synchronization between players.
- Allow a game to be stopped and resumed later.
- Reduce lookup friction during encounters.
- Gradually digitize game content instead of requiring all content to be entered before the first playable build.
- Make entering game components fast through AI-assisted image recognition.
- Preserve enough manual flexibility that unusual tabletop situations do not require new application code.
- Avoid requiring each player to install a native application.
- Avoid requiring every participant to use multiple devices.

---

# 3. Non-Goals

The initial product is **not**:

- A commercial digital adaptation of the game.
- A replacement for every game rule.
- An AI game master.
- A mobile-native application.
- A complete rules engine.
- A public searchable repository of copyrighted Tales of the Arabian Nights content.
- A physics simulation of a tabletop.
- A 3D game board.
- A fully offline application.

These boundaries are important.

Trying to build the complete game engine before remote play works would dramatically increase scope without proving the core experience.

---

# 4. Core Design Principles

## 4.1 One authoritative state

There must never be separate authoritative copies of:

- player position,
- current turn,
- character state,
- counters,
- statuses,
- cards,
- active quests,
- encounter progress.

The database-backed server state is canonical.

Clients display that state.

---

## 4.2 Actions, not arbitrary state mutation

A browser should not say:

```text
Set Rico's location to Baghdad.
```

It should request:

```text
MOVE_PLAYER
player = Rico
destination = Baghdad
```

The server determines whether and how state changes.

This leaves room for validation, auditing, undo, rule automation, and replay later.

---

## 4.3 Content and game state are separate domains

Reusable game content:

```text
Locations
Cards
Statuses
Treasures
Characters
Skills
Reaction tables
Encounter tables
Book entries
```

is fundamentally different from:

```text
Rico is currently Poor.
Sarah is in Damascus.
It is Mike's turn.
Encounter 371 is currently active.
```

They may live in the same PostgreSQL database, but they should use separate tables and domain boundaries.

---

## 4.4 Automate incrementally

The application should support three levels of automation:

### Level 1 — Tracking

The app simply records what happened.

Example:

> Rico gained the Sultan status.

### Level 2 — Assistance

The app knows enough to suggest actions.

Example:

> This result gives Rico +1 Story Point and the Sultan status.

Player confirms:

**Apply Result**

### Level 3 — Automatic rules

The app performs known deterministic game logic itself.

The application should progress from Level 1 toward Level 2 and selectively to Level 3.

There is no requirement that every rule reach Level 3.

---

# 5. Device Strategy

## Decision

**Laptop/tablet browser is sufficient for every player.**

Phones are optional and should not be required.

### MVP

Each player opens:

```text
https://app.example.com/game/ABC123
```

Their browser shows:

```text
┌──────────────────────────────────────────────┐
│ Game Header / Turn                          │
├────────────────────────────┬─────────────────┤
│                            │                 │
│                            │ Player / Game   │
│        Shared Board        │ Panel           │
│                            │                 │
│                            │                 │
├────────────────────────────┴─────────────────┤
│ Encounter / Actions                         │
└──────────────────────────────────────────────┘
```

Every player sees the same game state.

The currently active player receives additional available actions.

---

## Future: phone companion mode

A player may later associate multiple devices with the same player identity.

Example:

```text
Rico
├── MacBook
└── iPhone
```

The laptop might show:

- board,
- encounter,
- group state.

The phone might show:

- character sheet,
- skills,
- treasures,
- statuses,
- private information,
- player-specific buttons.

This is a valuable enhancement but should not shape the initial architecture beyond ensuring a player can eventually have multiple active connections.

---

# 6. Major User Roles

## Host

Can:

- create game,
- invite players,
- assign players/characters,
- start game,
- pause/resume game,
- correct state,
- undo recent actions,
- administer content where permitted.

The host is not technically the authoritative server.

The server remains authoritative.

---

## Player

Can:

- join a game,
- control their assigned character,
- perform permitted actions,
- view public game state,
- view their player state.

---

## Content Admin

Initially this will probably just be the developer/host.

Can:

- upload card images,
- run AI extraction,
- review extracted content,
- edit content,
- publish content,
- identify duplicates,
- manage board metadata.

---

# 7. Proposed Technology Stack

## Front End

### Next.js 16
### React
### TypeScript

Next.js 16 is the current major release documented by Next.js, and the App Router supports Server Components, Server Functions, layouts, loading/error states, and modern React features.

Recommended UI stack:

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
Zod
TanStack Query where client query caching is useful
Drizzle ORM (server-side database access and transactions)
```

Most game interaction screens will necessarily contain client-side React state, but static/content-heavy surfaces can remain server-rendered.

---

# 8. Backend Decision

## Recommendation: Supabase

Use Supabase for:

- PostgreSQL
- authentication
- realtime infrastructure
- file/object storage
- database migrations
- Row Level Security

Supabase currently provides PostgreSQL-backed Realtime subscriptions and private channel authorization, while its Data API security model supports database grants plus PostgreSQL Row Level Security.

This gives us one managed service instead of immediately introducing:

```text
Postgres
+
Redis
+
Socket server
+
Auth provider
+
Object storage
```

The application can still place Supabase behind project-owned interfaces where practical so game-domain code is not tightly coupled to Supabase-specific APIs.

## Database access paths

Supabase offers two ways to reach Postgres, and they serve different purposes:

| Path | Used by | Purpose |
|---|---|---|
| `supabase-js` (Data API) with the user's session | Browser and server | Reads protected by RLS; realtime subscriptions; auth |
| Direct Postgres connection (Drizzle via Supavisor pooler) | Server only | All game commands, inside real transactions |

`supabase-js` cannot run a multi-statement transaction, so it must not be used for game commands. Commands use a direct connection through the **transaction-mode pooler** (port 6543, prepared statements disabled), which suits serverless functions on Vercel.

The direct connection bypasses RLS, so command handlers must authorize the actor in application code from the verified Supabase session (see §Command Architecture). RLS remains the guard for everything the browser reads directly.

---

# 9. Architectural Rule: Vendors Behind Interfaces

Third-party services should not leak deeply into game-domain code.

Example:

```ts
interface GameRepository {
  getGame(id: GameId): Promise<Game>
  commitAction(action: GameAction): Promise<GameState>
}

interface RealtimePublisher {
  publishGameUpdated(gameId: GameId, event: GameEvent): Promise<void>
}

interface CardImageExtractor {
  extract(image: ImageInput): Promise<CardDraft>
}

interface BlobStorage {
  save(file: File): Promise<StoredFile>
}
```

Then implementations may initially be:

```text
SupabaseGameRepository
SupabaseRealtimePublisher
OpenAICardImageExtractor
SupabaseBlobStorage
```

This prevents the core game model from depending directly on a particular vendor.

---

# 10. High-Level Architecture

```text
                           ┌──────────────────────┐
                           │     Web Browser      │
                           │                      │
                           │ Board                │
                           │ Character            │
                           │ Encounter UI         │
                           └──────────┬───────────┘
                                      │
                              HTTPS / Realtime
                                      │
                           ┌──────────▼───────────┐
                           │     Next.js App      │
                           │                      │
                           │ Commands/API         │
                           │ Game Engine          │
                           │ Validation           │
                           │ Content Admin        │
                           └──────────┬───────────┘
                                      │
                  ┌───────────────────┼──────────────────┐
                  │                   │                  │
          ┌───────▼────────┐ ┌────────▼────────┐ ┌──────▼───────┐
          │ PostgreSQL     │ │ Realtime        │ │ File Storage │
          │                │ │                 │ │              │
          │ content        │ │ game channels   │ │ card photos  │
          │ state          │ │ presence        │ │ assets       │
          │ action log     │ │ events          │ │              │
          └────────────────┘ └─────────────────┘ └──────────────┘

                                      │
                              Content ingestion
                                      │
                           ┌──────────▼───────────┐
                           │ Vision / AI Adapter  │
                           │                     │
                           │ image → draft JSON  │
                           └──────────────────────┘
```

---

# 11. Database Model

The database should distinguish four categories:

1. Game definition/content
2. Game sessions
3. Current player/session state
4. Historical game events

---

# 12. Content Data Model

## game_editions

```text
id
name
publisher_reference
language
version
created_at
```

Supporting editions from the beginning avoids embedding one edition implicitly throughout the data.

---

## locations

```text
id
edition_id
slug
name
region
space_type
is_port
description
metadata
```

`space_type` distinguishes cities from terrain and sea spaces (exact categories **(verify)**). `is_port` marks spaces where sea travel can begin or end.

---

## board_location_layout

Presentation data.

```text
location_id
layout_id
x_normalized
y_normalized
token_offset_x
token_offset_y
```

Coordinates should use normalized values:

```text
0.0 - 1.0
```

instead of pixels.

Game state never stores coordinates.

---

## board_edges

```text
id
from_location_id
to_location_id
connection_type
metadata
```

The board becomes a graph.

Example:

```text
Baghdad
 ├── Damascus
 ├── Basra
 └── Samarkand
```

This allows future legal-move highlighting and path calculation.

`connection_type` is `LAND` or `SEA`. Movement cost and allowance depend on connection type and on the player's wealth level (see `wealth_levels`), so legal moves are computed from the graph plus player state, not from adjacency alone.

---

## wealth_levels

Wealth is an ordered named level, not a number.

```text
id
edition_id
ordinal
name
land_movement
sea_movement
metadata
```

Example ordering (names and movement values **(verify)**):

```text
0  Destitute
1  Poor
2  Average
3  Prosperous
4  Rich
5  Fabulously Rich
```

Player state stores `wealth_level_id`. Gaining or losing wealth moves one step along `ordinal`.

---

## skills

```text
id
edition_id
slug
name
description
```

---

## cards

Generic card metadata.

```text
id
edition_id
card_type
card_number
title
source_image_id
status
created_at
updated_at
```

Possible types:

```text
QUEST
TREASURE
ENCOUNTER
STATUS
REFERENCE
OTHER
```

BoardGameGeek's component listing for the 2009 edition describes 216 cards distributed across quests, treasures, encounters, and status cards, along with the Book of Tales, reaction matrices, board and other components **(verify count against the box)**. That is a strong indication that content ingestion should support several schemas rather than treating everything as one generic card format.

Each physical card is one `cards` row. If the box contains several identical copies of a card, each copy gets its own row (sharing content), so deck and ownership tables can always point at a specific physical card.

## edition_manifest

Expected component counts per edition, entered once from the box contents:

```text
edition_id
component_type
expected_count
```

The content library compares digitized counts against this manifest instead of hardcoded totals.

---

## card_content

Prefer typed JSON validated against schemas.

```text
card_id
schema_version
content_json
```

Example:

```json
{
  "title": "Example",
  "effects": [],
  "notes": null
}
```

Different card families can have different Zod schemas.

---

## Book of Tales and reaction matrices

Most of the game's text lives in the Book of Tales rather than on cards. The encounter procedure is roughly **(verify)**:

```text
Draw encounter card / use location card
      ↓
Determine encounter (character + descriptor, via die roll and encounter chart)
      ↓
Player chooses a reaction from the reaction matrix
      ↓
Matrix cell gives a paragraph number
      ↓
Another player reads the paragraph; skills may branch the result
      ↓
Apply results (wealth, statuses, story/destiny, movement)
```

Content tables:

```text
encounter_chart_entries
  id
  edition_id
  encounter_key        (character/encounter identifier)
  roll_min
  roll_max
  descriptor
  matrix_id

reaction_matrices
  id
  edition_id
  matrix_number

reaction_matrix_cells
  matrix_id
  row_key              (descriptor/encounter row)
  reaction             (e.g. AID, ATTACK, AVOID ...)
  paragraph_number

book_entries
  id
  edition_id
  paragraph_number
  text
  skill_branches_json
  results_json
  lifecycle            (MISSING / DRAFT / REVIEWED / PUBLISHED)
```

All of these are optional at runtime. With only `reaction_matrix_cells` digitized, the app can already tell the reader which paragraph to read from the physical book.

---

# 13. AI Card Ingestion

Image extraction should be an **admin workflow**, not runtime game logic.

OpenAI's current API supports image inputs through the Responses API, including uploaded files or image URLs, making an image-to-structured-draft pipeline viable.

Flow:

```text
Upload image
     │
     ▼
Store original
     │
     ▼
Determine expected card type
     │
     ▼
Vision extraction
     │
     ▼
Validated Draft JSON
     │
     ▼
Human Review
     │
     ├── Correct
     │
     ├── Edit
     │
     └── Reject
     │
     ▼
Publish
```

AI should **never directly publish canonical game content**.

Extraction should use the provider's structured-output mode with a JSON Schema generated from the same Zod schema used for review and storage, so the draft shape is guaranteed and only the values need human checking.

## Card ingestion vs page ingestion

Card ingestion handles one image → one card draft.

The Book of Tales and reaction matrices are a different problem:

- one page image contains many paragraphs,
- paragraphs continue across pages,
- entries cross-reference other paragraph numbers,
- matrices are dense tables where a single misread cell silently breaks lookups.

Page ingestion therefore gets its own pipeline (page → many `book_entries` drafts, with paragraph-number continuity checks), and is **out of scope for the card ingestion MVP**. Reaction matrices are small enough that manual entry with a validation pass (every cell filled, every paragraph number in range) is likely faster and safer than AI extraction.

---

# 14. Import Record Model

## content_imports

```text
id
image_id
requested_type
model
prompt_version
raw_response
parsed_data
confidence_metadata
status
created_by
created_at
reviewed_by
reviewed_at
```

Statuses:

```text
UPLOADED
PROCESSING
NEEDS_REVIEW
APPROVED
REJECTED
FAILED
```

Keeping the raw extraction result is useful when an ingestion prompt or schema changes.

---

# 15. Duplicate Detection

Uploading the same card twice is likely.

Before publication:

1. check card number,
2. check card type,
3. compare title,
4. optionally compare image hash.

Possible UI:

```text
Possible duplicate found

Existing:
Encounter Card #27

Incoming:
Encounter Card #27

[Compare] [Replace] [Keep Separate]
```

---

# 16. Board Rendering

## Decision: SVG-based board UI

Do **not** use:

- Unity,
- HTML canvas initially,
- PixiJS,
- WebGL,
- Mapbox.

The board needs:

- fixed locations,
- fixed routes,
- player tokens,
- zooming,
- panning,
- highlighting.

SVG is a very good fit.

---

# 17. Board Layers

```text
BoardViewport
│
├── BoardBackground
├── ConnectionLayer
├── LocationLayer
├── HighlightLayer
├── PlayerTokenLayer
└── OverlayLayer
```

Locations are anchored from normalized layout coordinates.

Example:

```ts
type BoardLocationLayout = {
  locationId: string
  x: number
  y: number
}
```

Player state stores:

```text
current_location_id
```

not:

```text
x
y
```

The renderer translates semantic location → visual coordinates.

---

# 18. Original Board Artwork vs Application Board

This needs to be deliberately separated.

There are two possible implementations.

## A. Scanned original board

Fastest for personal experimentation.

However, bundling or distributing publisher artwork or extensive game text introduces intellectual-property concerns.

## B. Original digital representation

Recommended for anything beyond private experimentation.

Create an original map visualization containing:

- location names,
- nodes,
- connection lines,
- regions,
- custom artwork.

The underlying graph represents game mechanics, while the visual design is original.

The application architecture should work with either board presentation.

---

# 19. Game Session Model

## games

```text
id
edition_id
join_code
status
current_turn_player_id
turn_number
phase
state_version
created_at
started_at
finished_at
updated_at
```

Statuses:

```text
LOBBY
ACTIVE
PAUSED
COMPLETED
ABANDONED
```

`state_version` is the **only** version counter for a game. Every command increments it, regardless of which table it touches.

Turn order is `game_players.seat`. The host is the `game_players` row with role `HOST`, so there is no separate `host_user_id`.

---

# 20. Game Players

## game_players

```text
id
game_id
user_id          (Supabase auth user; may be anonymous)
role             (HOST / PLAYER / SPECTATOR)
display_name
character_id
seat
player_color
joined_at
```

This is the single membership table. RLS policies for every game table check membership through `game_players`.

Every participant has a Supabase auth user, but that user may be **anonymous** (see §Joining). A guest can later link an email or OAuth identity to the same user without changing `user_id`.

---

# 21. Player State

## player_state

```text
game_player_id
current_location_id
wealth_level_id
story_points
destiny_points
updated_at
```

There is no per-player version; concurrency uses `games.state_version` only.

Quest destinations come from the player's active quest card rather than a column here.

Related entities should generally live in child tables rather than increasingly large JSON.

---

## player_secrets

Information only the owning player may see.

```text
game_player_id
story_goal
destiny_goal
chosen_at
```

At setup each player secretly splits the victory total between Story and Destiny **(verify total and timing)**. RLS allows `SELECT` only where `game_player_id` belongs to `auth.uid()`. Not even the host can read it; host corrections that need it go through a server command.

At game end, secrets are revealed by a `REVEAL_GOALS` command that copies them into the public action log.

---

# 22. Player Skills

```text
player_skills

game_player_id
skill_id
mastery_level
source
```

---

# 23. Player Statuses

```text
player_statuses

id
game_player_id
status_card_id
active
acquired_at
removed_at
metadata
```

---

# 24. Player Treasures

```text
player_treasures

id
game_player_id
treasure_card_id
state
acquired_at
metadata
```

---

# 25. Decks and Card Piles

Every physical card in a game is in exactly one place: a pile, a player's possession, or removed from the game.

## game_piles

```text
id
game_id
pile_type
owner_player_id   (null for shared piles)
```

Pile types:

```text
ENCOUNTER_DECK
ENCOUNTER_DISCARD
TREASURE_DECK
TREASURE_DISCARD
QUEST_DECK
STATUS_SUPPLY
REMOVED
```

## game_pile_cards

```text
pile_id
card_id
position
```

Unique on `(game_id, card_id)` across piles and player possession tables, enforced in the command layer and checked in tests.

## Rules

- The server shuffles at setup with a cryptographically secure RNG and stores the resulting order.
- Drawing is a command (`DRAW_CARD`) that takes the top card. Clients never see deck order.
- If supply is limited (e.g. status cards), acquiring one moves it from `STATUS_SUPPLY` to the player; an empty supply is visible to everyone.
- Decks work even when card **content** is missing. A deck of card numbers is enough to draw "Encounter #31" and read it from the physical card.
- **Physical deck mode:** if the group prefers to draw real cards, `RECORD_DRAW` lets the active player enter the card number they drew instead.

---

# 26. Hidden Information

Not all state is public. Every piece of state belongs to one visibility class:

| Class | Who can read | Examples |
|---|---|---|
| `PUBLIC` | All game members | Locations, wealth, story/destiny points, statuses, treasures, turn, action log |
| `OWNER` | The owning player only | Secret victory goals |
| `SERVER_ONLY` | No client until revealed | Deck order, encounter outcomes before a reaction is chosen |

Rules:

1. Visibility is enforced in the database (RLS) and in the query layer, never by hiding things in the UI.
2. Realtime broadcasts go to everyone on the game channel, so **broadcast payloads contain only `PUBLIC` data**. Clients fetch `OWNER` data through RLS-protected queries after a signal.
3. `SERVER_ONLY` data becomes `PUBLIC` only through an explicit command (e.g. drawing a card, choosing a reaction), which is logged.
4. Action log entries are public, so actions involving secrets log a redacted payload (e.g. "Rico chose victory goals") and store the private part in an owner-only table.

During an encounter, the active player picks a reaction **before** the client learns which paragraph or result it leads to. The client receives the encounter descriptor and the list of available reactions; the paragraph number and any digitized text arrive only after `CHOOSE_REACTION` commits.

---

# 27. Game State: Snapshot + Action Log

A pure event-sourced architecture is unnecessary initially.

However, an action log is extremely valuable.

Use:

```text
CURRENT STATE
+
ACTION HISTORY
```

rather than either one alone.

---

# 28. game_actions

```text
id
game_id
sequence
actor_player_id
action_type
payload
changes
reversible
reverts_action_id
previous_state_version
resulting_state_version
created_at
```

`changes` records every row-level change the action made, with before and after values. This is what makes undo possible without event sourcing.

Example:

```json
{
  "actionType": "MOVE_PLAYER",
  "payload": {
    "destination": "damascus"
  },
  "changes": [
    {
      "table": "player_state",
      "key": { "game_player_id": "p1" },
      "before": { "current_location_id": "baghdad" },
      "after": { "current_location_id": "damascus" }
    }
  ],
  "reversible": true
}
```

`changes` may include `OWNER` or `SERVER_ONLY` data, so clients never read `game_actions` directly. They read a `game_action_log` view that exposes only `sequence`, actor, `action_type`, a public summary, and the redacted payload.

---

# 29. Why maintain an action log?

It enables:

- debugging,
- game history,
- identifying synchronization problems,
- host undo,
- audit trails,
- replay,
- statistics,
- future spectator timeline.

Example history:

```text
#105 Rico moved Alexandria → Cairo
#106 Sarah gained Wealth
#107 Mike drew Encounter #31
#108 Rico gained Story +1
```

---

# 30. Undo

Undo is essential because this is adapting a tabletop game.

Humans make mistakes.

Recommended MVP behavior:

Host can undo the **most recent reversible action**.

Later:

```text
Game History
─────────────────────────────

✓ Rico moved to Baghdad
✓ Sarah gained +1 Destiny
✓ Mike received Sultan
✓ Encounter #341 started

             [Undo]
```

Do not initially implement arbitrary history rewinding.

## Undo semantics

- Undo is itself a command (`UNDO`) that creates a new action with `reverts_action_id` set. History is never deleted.
- Undo applies the inverse of the target action's `changes`. It fails with `STATE_CONFLICT` if any affected row no longer matches the recorded `after` value.
- Only the most recent non-undone reversible action can be undone in the MVP.
- **Dice rolls are not reversible.** A roll is a fact everyone has seen. The action that *used* the roll can be undone, but re-rolling is a separate, logged action the host must choose explicitly.
- **Undoing a draw returns the card to the top of its pile in the same position.** Drawing again yields the same card, so undo cannot be used to fish for a better card.
- Revealing secrets (`REVEAL_GOALS`) and ending the game are not reversible.

---

# 31. Concurrency

Two players may act nearly simultaneously.

Every game state mutation should include:

```text
expected_state_version
```

Example:

```text
client sees version 52

MOVE request:
expectedVersion = 52

server transaction:
WHERE state_version = 52

success:
state_version = 53
```

If another action already produced version 53:

```text
409 STATE_CONFLICT
```

Client reloads current state.

This prevents silent overwrites.

## Implementation

The version check and the writes must happen in the same transaction. Checking first and writing later leaves a race window.

```sql
BEGIN;

SELECT state_version, phase, current_turn_player_id
FROM games
WHERE id = $game_id
FOR UPDATE;          -- serializes commands per game

-- application validates expected_version and the action here

UPDATE player_state ...;
INSERT INTO game_actions ...;

UPDATE games
SET state_version = state_version + 1
WHERE id = $game_id;

COMMIT;
```

Commands run through Drizzle on a direct Postgres connection (see §Backend Decision), so domain validation stays in TypeScript while still executing inside the transaction. Row locking on `games` means commands for one game execute one at a time, which is exactly the semantics of a turn-based tabletop game.

---

# 32. Realtime Synchronization

Realtime is a **delivery mechanism**, not the authoritative state.

That distinction matters.

Correct flow:

```text
Player
  │
  ▼
Server Action
  │
  ▼
DB Transaction
  ├── state changes
  ├── INSERT game_actions
  └── trigger queues realtime broadcast
  │
  ▼
Commit  (broadcast is delivered only if the commit succeeds)
  │
  ▼
Connected Clients
  │
  ▼
Refresh/update view
```

## Broadcast from the database, not from application code

Publishing from the server *after* commit has a failure window: the commit succeeds, the publish call fails or the function times out, and clients never hear about the change.

Instead, an `AFTER INSERT` trigger on `game_actions` calls Supabase's `realtime.send` (or `realtime.broadcast_changes`) on the private topic `game:{gameId}`. The broadcast is written as part of the same transaction, so a committed action always produces an event and a rolled-back action never does.

The `RealtimePublisher` interface (§Vendors Behind Interfaces) still exists for non-state events such as typing indicators or "Rico is looking at Damascus".

## Gap detection

Every broadcast carries `resulting_state_version`. A client that holds version `N` and receives `N + 1` may apply the public delta. If it receives anything else (`N + 2`, or a version it can't reconcile), it re-fetches the canonical snapshot. Missed events are therefore always self-healing.

Incorrect:

```text
Browser A
  │
WebSocket event
  │
Browser B changes its own state
```

Clients should never create canonical state based only on receiving another client's event.

---

# 33. Realtime Channel

Each game receives a private channel:

```text
game:{gameId}
```

Events might include:

```text
GAME_UPDATED
PLAYER_MOVED
TURN_CHANGED
ENCOUNTER_STARTED
ENCOUNTER_UPDATED
CONTENT_UPDATED
PLAYER_JOINED
PLAYER_LEFT
```

Events can include useful **public** deltas (see §Hidden Information), but clients should always be capable of re-fetching canonical state.

Additional event:

```text
PRIVATE_STATE_CHANGED   (payload: game_player_id only; that player re-fetches via RLS)
```

Supabase supports private realtime channels with authorization policies controlling which authenticated clients can receive or broadcast messages.

---

# 34. Connection Recovery

Users will:

- close laptops,
- refresh pages,
- lose Wi-Fi,
- sleep their computer.

Reconnect behavior:

```text
Socket reconnect
      │
      ▼
Fetch canonical game snapshot
      │
      ▼
Compare state version
      │
      ▼
Render latest state
```

Do not try to replay missed client websocket messages to rebuild the game.

The database snapshot solves that problem.

---

# 35. Presence

Presence information is ephemeral.

Useful information:

```text
Rico     ● Connected
Sarah    ● Connected
Mike     ○ Reconnecting
John     ○ Offline
```

Presence does **not** belong in saved game state.

---

# 36. Game Creation Flow

```text
Home
  │
  ├── New Game
  │
  ▼
Choose Edition
  │
  ▼
Create Game
  │
  ▼
Lobby
```

Example lobby:

```text
TALES OF THE ARABIAN NIGHTS

Game Code
────────────
Q7K4PM

Players
────────────
Rico      Host
Sarah     Ready
Mike      Ready
John      Selecting character

Invite:
https://app.example.com/join/Q7K4PM

             [Start Game]
```

---

# 37. Joining

MVP can use lightweight authentication.

Recommended:

```text
Join link
   ↓
Enter display name
   ↓
Select available player/character
   ↓
Join lobby
```

Persistent user accounts may be offered but should not be required for early private games.

## Decision: Supabase anonymous sign-ins for guests

Opening a join link with no session calls `signInAnonymously()`. The guest gets a real Supabase auth user and JWT, so:

- RLS policies work unchanged (`auth.uid()` is the guest),
- private realtime channel authorization works unchanged,
- the guest can later link an email/OAuth identity and keep their games.

Custom signed guest tokens are rejected because neither RLS nor Realtime authorization would recognize them.

Mitigations for anonymous abuse: enable CAPTCHA on anonymous sign-in if the app is ever public, and periodically delete anonymous users with no game membership.

---

# 38. Primary Game Screen

Desktop layout:

```text
┌───────────────────────────────────────────────────────┐
│ Tales of the Arabian Nights          Turn: Rico      │
├──────────────────────────────────────┬────────────────┤
│                                      │ Rico           │
│                                      │                │
│                                      │ Story      7   │
│             GAME BOARD               │ Destiny    5   │
│                                      │ Wealth  Poor   │
│                                      │                │
│                                      │ Skills         │
│                                      │ Statuses       │
│                                      │ Treasures      │
│                                      │                │
├──────────────────────────────────────┴────────────────┤
│ Current Encounter / Turn Actions                     │
└───────────────────────────────────────────────────────┘
```

---

# 39. Board Interaction

Selecting the active player's token:

```text
Current Location:
Baghdad

Available Destinations:
● Damascus
● Basra
● Samarkand
```

Legal destinations can be highlighted.

Highlighting grows with the rules model:

| Stage | "Available destinations" means |
|---|---|
| MVP 1 | Spaces adjacent to the current location (any connection type). The player may also pick any space; the move is accepted and logged. |
| MVP 2 | Spaces reachable within the movement allowance for the player's wealth level, respecting land vs sea connections and ports **(verify rules)**. |
| Later | Status effects that restrict or alter movement. |

Until movement validation exists, the server accepts any destination but records whether it was "highlighted" so unusual moves are visible in history.

Selecting destination:

```text
Move Rico to Damascus?

[Cancel] [Move]
```

After server confirmation:

```text
Player state changes
       ↓
Game action created
       ↓
Realtime event emitted
       ↓
All clients animate token
```

Animation is presentation only.

The database immediately knows the destination.

---

# 40. Token Collision

Multiple players can occupy one space.

The board renderer should handle this visually rather than changing coordinates in saved state.

Example layout:

```text
      ● Rico

● Sarah   ○ Mike

      ● John
```

Given:

```text
playersAtLocation.length
```

the UI chooses token offsets.

---

# 41. Game Phases

Avoid hardcoding turn behavior throughout components.

Represent a lightweight state machine:

```text
TURN_START
MOVEMENT
ENCOUNTER
RESOLUTION
TURN_END
```

Not every phase has to be automated at first.

The phase primarily controls:

- UI,
- available actions,
- active player.

---

# 42. Encounter Model

## game_encounters

```text
id
game_id
player_id
location_id
encounter_card_id
die_roll
encounter_chart_entry_id
reader_player_id
chosen_reaction
paragraph_number
state
started_at
completed_at
metadata
```

States:

```text
DRAWN              card drawn, encounter not yet determined
DETERMINED         roll + chart gave the encounter; reactions visible
REACTION_CHOSEN    paragraph number revealed to everyone
RESOLVING          reader reads; results being applied
COMPLETE
CANCELLED
```

`paragraph_number` is `SERVER_ONLY` until `REACTION_CHOSEN`. When the matrix isn't digitized, the reader looks it up in the physical book and enters it, and the state machine is the same.

`reader_player_id` defaults to the next player in seat order. Their screen shows the paragraph number prominently (and the text, if digitized) with buttons for applying results.

This prevents encounter context from disappearing when someone refreshes the page.

---

# 43. Manual Overrides

A tabletop companion needs an escape hatch.

Host interface:

```text
Adjust Player

Location        Baghdad
Story           7
Destiny         5
Wealth          Poor ▾

Statuses
☑ Sultan
☐ Lost
☑ Married

[Save Correction]
```

Corrections generate explicit actions:

```text
ADMIN_CORRECTION
```

rather than secretly changing database rows.

---

# 44. Randomization

Where useful, dice should be server-authoritative.

Example:

```text
ROLL_DICE
```

server:

```text
crypto-secure random result
```

then logs:

```text
D6 = 4
Destiny Die = +
```

This ensures all players receive the same result.

Physical dice can still be allowed through manual result entry.

---

# 45. Content Availability

The app should not require 100% content ingestion before it works.

Content can have lifecycle:

```text
MISSING
DRAFT
REVIEWED
PUBLISHED
```

If the game reaches missing content:

```text
Encounter Card #42 has not been digitized.

[Enter manually]
[Upload photo]
[Continue with physical card]
```

This is important for incremental development.

---

# 46. Content Admin Screen

```text
CONTENT LIBRARY

Encounter Cards    31 / N
Status Cards       48 / N
Treasure Cards     17 / N
Quest Cards         7 / N
Matrix Cells      410 / N
Book Entries       12 / N

[Upload Cards]
```

`N` comes from `edition_manifest`, not from hardcoded totals.

Filters:

```text
Type
Number
Published state
Needs review
Missing
Duplicate
```

---

# 47. AI Import Review Screen

```text
┌────────────────────┬─────────────────────────────┐
│                    │ Card Type                   │
│   ORIGINAL IMAGE   │ Encounter                   │
│                    │                             │
│                    │ Card Number                 │
│                    │ 37                          │
│                    │                             │
│                    │ Title                       │
│                    │ Strange Merchant            │
│                    │                             │
│                    │ Extracted data...           │
│                    │                             │
├────────────────────┴─────────────────────────────┤
│ [Reject]              [Save Draft]   [Publish]   │
└──────────────────────────────────────────────────┘
```

Human review is mandatory.

---

# 48. Image Processing

Before sending images to an AI provider:

- resize unnecessarily huge images,
- correct orientation,
- preserve readable text,
- optionally crop card edges,
- calculate image hash.

Store:

```text
original image
processed image
```

if needed.

---

# 49. Authentication and Authorization

MVP authentication can be intentionally lightweight.

However:

- users should only access games they joined,
- private uploaded assets should not be globally accessible,
- admin functions must require admin authorization,
- service credentials must never reach the browser.

Supabase recommends using PostgreSQL RLS and appropriate grants to restrict database access, and its documentation specifically warns that exposed tables should be protected with RLS.

---

# 50. Suggested Authorization Model

Two scopes of role:

```text
Global (app_admins table)
  app_admin          content administration

Per game (game_players.role)
  HOST
  PLAYER
  SPECTATOR
```

"Guest" is not a role. It is any auth user that happens to be anonymous, and it can hold any per-game role.

Permission examples:

| Action | Player | Host |
|---|---:|---:|
| View game | Yes | Yes |
| Move own player | Yes | Yes |
| Move another player | No | Correction only |
| Start game | No | Yes |
| Pause game | No | Yes |
| Undo | No | Yes |
| See another player's victory goals | No | No |
| See deck order | No | No |
| Modify published content | No | Only if `app_admin` |

---

# 51. State Ownership Matrix

This eliminates ambiguity.

| Data | Authority |
|---|---|
| Player location | Server/database |
| Player counters | Server/database |
| Turn | Server/database |
| Encounter | Server/database |
| Deck order | Server/database (`SERVER_ONLY`) |
| Victory goals | Server/database (`OWNER`) |
| Game content | Content database |
| Board coordinates | Content/layout data |
| Token screen coordinates | Client renderer |
| Zoom/pan | Local client |
| Hover state | Local client |
| Open panel | Local client |
| Connection presence | Realtime presence |
| Animations | Local client |

---

# 52. Offline Behavior

Full offline multiplayer is out of scope.

If connection disappears:

```text
Connection lost.

Showing game state from 10:42 PM.
Actions are disabled until connection returns.

[Reconnect]
```

The client must not queue important game actions blindly while offline.

Otherwise two players could submit incompatible actions after reconnecting.

---

# 53. Refresh Behavior

Refreshing should be completely safe.

The app reconstructs itself from:

```text
game
game_players
player_state
player_secrets   (own row only)
pile sizes       (counts only, never order)
active encounter
action log
content
```

No critical session state may exist only in React memory.

---

# 54. Save/Resume

There should be no special "save game" operation.

Because actions persist continuously:

```text
playing game
   =
saved game
```

Pause simply changes:

```text
game.status = PAUSED
```

Resume:

```text
PAUSED → ACTIVE
```

---

# 55. Error States

Important UX states:

### Loading

```text
Loading game…
```

### Game not found

```text
This game no longer exists.
```

### Unauthorized

```text
You are not a member of this game.
```

### Reconnecting

```text
Connection interrupted. Reconnecting…
```

### State conflict

```text
The game changed before your action completed.

We've refreshed the board.
```

### AI import failure

```text
We couldn't reliably extract this card.

[Try Again]
[Enter Manually]
```

### Missing content

Provide physical/manual fallback.

---

# 56. Observability

At minimum capture:

```text
request id
game id
action id
actor id
state version
action type
duration
success/failure
```

A failed game action should be traceable end-to-end.

For MVP 1, structured server logs (Vercel log output) with these fields are enough. Add error tracking once friends outside the developer are playing regularly:

- Sentry or equivalent behind a project-owned telemetry interface.

---

# 57. Testing Strategy

## Unit tests

Focus heavily on game-domain functions.

Examples:

```text
valid movement
invalid movement
phase transition
state version conflict
counter changes
status application
undo eligibility
```

---

## Database tests

Test:

- migrations,
- constraints,
- RLS,
- transaction behavior.

Supabase explicitly recommends testing allow/deny behavior for RLS policies rather than assuming policies are correct.

Run these against the local Supabase stack (`supabase start`) with pgTAP or test-runner SQL. Required cases:

- a player cannot read another player's `player_secrets`,
- no client role can read `game_pile_cards` order or `game_actions.changes`,
- a non-member cannot read any game table,
- the `game_actions` trigger produces exactly one broadcast per committed action and none on rollback.

---

## Integration tests

Test:

```text
command
  ↓
database mutation
  ↓
action history
  ↓
updated snapshot
```

---

## Realtime integration

Open two browser contexts.

Player A:

```text
Move to Baghdad
```

Player B should:

```text
see Baghdad
```

without refresh.

Also assert that no broadcast payload received by Player B contains Player A's private fields, and that a client which misses an event (simulated by dropping one) recovers through gap detection.

---

## E2E tests

Use Playwright.

Critical scenarios:

1. host creates game,
2. second player joins,
3. host starts game,
4. player moves,
5. second browser updates,
6. player refreshes,
7. state persists,
8. game pauses,
9. game resumes.

---

# 58. Deployment

Suggested initial infrastructure:

```text
Vercel
  └── Next.js

Supabase
  ├── Postgres (commands via Supavisor transaction pooler)
  ├── Auth (including anonymous sign-ins)
  ├── Realtime (broadcast from DB triggers)
  └── Storage

OpenAI API
  └── Content extraction
```

This is enough infrastructure for the first useful version.

Do not introduce:

- Redis,
- Kafka,
- dedicated WebSocket server,
- Kubernetes,
- microservices.

There is no current need.

---

# 59. Intellectual Property Boundary

This project should distinguish between:

```text
Software
```

and:

```text
copyrighted game assets/content
```

The application code, state engine, custom board visualization, database schema, UI, and networking system can be independent.

Scanned cards, board artwork, books, reaction tables, and reproduced game text should be treated separately.

For private experimentation this may be practically straightforward, but distributing a public service containing substantial copyrighted game material raises a different rights question.

Recommended architecture:

```text
open/application code
       │
       └──── no copyrighted game assets required

private content database
       │
       └──── user/admin supplied game content
```

This also makes the underlying companion framework reusable for other games.

---

# 60. Security

Required baseline:

- RLS on exposed game tables.
- Private game realtime channels.
- Signed/controlled asset access.
- Server-only OpenAI credentials.
- Server-only Supabase privileged credentials.
- Upload size restrictions.
- Image MIME validation.
- Rate limiting on AI imports.
- Server validation of every game command.
- No trusting `playerId` merely because the browser supplied it. The actor is always derived from the verified session.
- Server Actions are public POST endpoints; each one re-authenticates and re-authorizes.
- Direct Postgres credentials (which bypass RLS) exist only in server environment variables.
- Realtime broadcast payloads contain only public data.

---

# 61. Major Product Risks

## Risk 1 — Attempting full rules automation too early

**Resolution:** Progressive automation.

---

## Risk 2 — Duplicated board state

Physical board + digital board would become inconsistent.

**Resolution:** Digital game state is canonical.

---

## Risk 3 — Realtime becoming game state

WebSocket events can be missed.

**Resolution:** DB snapshot is authoritative. Realtime signals changes.

---

## Risk 4 — AI introduces incorrect card text

**Resolution:** AI produces drafts only. Human publication required.

---

## Risk 5 — Content entry blocks development

**Resolution:** Missing-content fallback allows physical components.

---

## Risk 6 — Phones create unnecessary setup friction

**Resolution:** One browser per player is sufficient.

---

## Risk 7 — Board UI becomes overly complicated

**Resolution:** SVG graph with normalized anchors.

---

## Risk 8 — Game corrections are impossible

Tabletop games routinely involve judgment calls.

**Resolution:** Host corrections + action log.

---

## Risk 9 — Multiple simultaneous actions overwrite one another

**Resolution:** state versions + transactional commands.

---

## Risk 10 — Private information leaks

Secret goals or deck order leak through a broadcast, an over-broad query, or the action log.

**Resolution:** Visibility classes, RLS on private tables, public-only broadcast payloads, redacted action log view, and explicit RLS tests.

---

## Risk 11 — Undo used to manipulate randomness

Undoing a draw or roll to get a better result.

**Resolution:** Rolls are not reversible; undone draws return to the same deck position.

---

## Risk 12 — Rule details remembered incorrectly

This document describes rules from memory.

**Resolution:** Rule-dependent values live in content tables (wealth levels, matrices, charts), not in code, and are verified against the rulebook during content entry.

---

# 62. Resolved Design Decisions

This table is the single source of truth for decisions. Sections above explain the details.

| Topic | Decision | Why |
|---|---|---|
| Authoritative state | Server/database | One record of truth; clients only display |
| Physical board state | Not tracked separately | Avoids double bookkeeping |
| Required devices | One laptop/tablet browser per player | Lowest setup friction |
| Phone | Optional future companion | Valuable but not needed to play |
| Front end | Next.js + React + TypeScript | Server rendering plus rich client interaction |
| Board renderer | SVG | Fixed graph, zoom/pan, highlighting; no game engine needed |
| Player position | Semantic location ID | Renderer maps to coordinates |
| Wealth | Ordered level (`wealth_levels`) | Matches the game; drives movement |
| Database | PostgreSQL (Supabase) | Relational content + transactional state |
| Command DB access | Drizzle over direct connection (transaction pooler) | `supabase-js` has no multi-statement transactions |
| Read DB access | `supabase-js` with RLS | Browser reads protected by policy |
| Mutations | Server-authoritative commands | Validation, audit, undo |
| Concurrency | Single `games.state_version`, `SELECT ... FOR UPDATE` | Serializes commands per game; no silent overwrites |
| Realtime | Private channel per game, broadcast from DB trigger | Event exists iff the commit exists |
| Missed events | Version gap detection → re-fetch snapshot | Self-healing |
| Guest players | Supabase anonymous sign-ins | RLS and realtime auth work unchanged |
| Membership | `game_players` only, with per-game role | One table for policies |
| Hidden information | Visibility classes: PUBLIC / OWNER / SERVER_ONLY | Secret goals, deck order, encounter outcomes |
| Decks | Server-shuffled piles with explicit positions; physical-deck fallback | Fair shared randomness |
| Historical state | Action log with before/after `changes` + current snapshot | Undo and audit without event sourcing |
| Full event sourcing | No | Unnecessary complexity |
| Undo | Last reversible action; rolls irreversible; draws return to same position | Fixes mistakes without enabling manipulation |
| AI ingestion | Structured-output draft → human review; cards first, book pages later | AI never authoritative |
| Content completeness before play | Not required | Physical fallback for anything missing |
| Full rules automation | No | Progressive automation |
| Save/resume | Continuous persistence | Playing game = saved game |

---

# 63. MVP Scope

The first playable milestone should prove the entire technical loop without digitizing the whole game.

## MVP 1 — Multiplayer Table

Build:

- homepage,
- create game,
- join code,
- game lobby,
- guest/player identity (Supabase anonymous sign-in),
- shared board,
- board locations,
- board connections,
- character selection,
- player tokens,
- current player,
- player movement,
- realtime synchronization,
- persistence,
- disconnect/reconnect,
- pause/resume,
- game history,
- host state correction.

At this point four friends should be able to sit on a video call and use the application as the shared board.

---

# 64. MVP 2 — Player State

Add:

- wealth levels,
- movement allowance from wealth (land/sea, ports),
- story points,
- destiny points,
- secret victory goals (`player_secrets`) and end-of-game reveal,
- skills,
- statuses,
- treasures,
- player sheet,
- undo with before/after `changes`.

The application increasingly replaces physical bookkeeping.

---

# 65. MVP 3 — Encounter Assistant

Encounter lookup is the most awkward part of remote play, so it comes before AI ingestion. It works with **hand-entered** content.

Add:

- decks and piles (`game_piles`, `DRAW_CARD`, physical-deck `RECORD_DRAW`),
- server-authoritative die rolls,
- encounter chart and reaction matrices entered manually with validation,
- encounter state machine with hidden paragraph number until reaction chosen,
- reader role,
- result buttons for common effects (wealth step, status gain/loss, story/destiny change).

```text
Start encounter
       ↓
draw encounter card
       ↓
roll + chart → encounter
       ↓
active player chooses reaction
       ↓
paragraph number revealed to reader
       ↓
reader reads from physical book (or digitized entry)
       ↓
apply results
```

Manual fallback remains available at every step.

---

# 66. MVP 4 — Content Library and AI Card Ingestion

Add:

- content admin,
- card schemas,
- uploads,
- AI extraction with structured outputs,
- review workflow,
- publishing,
- duplicate detection,
- manifest-based progress tracking.

Content can then grow incrementally. Book of Tales page ingestion is a separate later feature (see §Future Features).

---

# 67. MVP 5 — Rules Assistance

Gradually encode high-value deterministic rules.

Prioritize rules that are:

- frequent,
- tedious,
- unambiguous,
- easy to test.

Do not prioritize obscure edge cases just because they can be automated.

---

# 68. Future Features

Once the base system works:

### Second-screen phone mode

Player-specific character panel.

### Spectator mode

View game without controlling a player.

### Game log narrative

Example:

```text
Rico traveled from Baghdad to Damascus.

There he encountered a mysterious stranger and gained Wisdom.

Sarah became Lost at Sea.
```

### Animated board movement

Pure presentation layer.

### Encounter history

Review previous stories.

### Book of Tales page ingestion

Page image → many `book_entries` drafts, with paragraph continuity and cross-reference checks. Enables showing paragraph text in-app instead of reading from the physical book.

### Statistics

```text
Places visited
Stories encountered
Statuses acquired
Longest journey
Most unfortunate player
```

### Multiple campaigns/sessions

Player account history.

### AI rules assistant

Ask:

> Does the Imprisoned status prevent this action?

This should reference entered rule content rather than invent game rules.

---

# 69. Important Open Questions

Most architecture decisions can be made now. These remaining questions should be answered through prototyping or game-specific analysis rather than blocking implementation.

## 69.1 How much information is private? (largely resolved)

Resolved in §Hidden Information: secret victory goals are `OWNER`; deck order and pre-choice encounter outcomes are `SERVER_ONLY`; everything else is `PUBLIC`.

Remaining question: are there statuses, quests, or treasures whose details should be private? Check while entering card content. Since private data is small and fits in a side panel, this does not change the decision that phones are optional.

---

## 69.2 How complicated is movement? (narrowed)

The base model is decided: graph + `LAND`/`SEA` edges + ports + wealth-driven allowance, staged as described in §Board Interaction.

Still to catalogue from the rulebook:

- exact allowance per wealth level,
- sea travel rules and costs,
- statuses that restrict or alter movement,
- quest destination markers,
- any other unusual movement rules.

---

## 69.3 Rulebook verification checklist

Before MVP 2 and MVP 3, confirm against the rulebook:

- wealth level names and movement values,
- victory point total and how goals are chosen,
- encounter procedure (card → roll → chart → matrix → paragraph),
- destiny die/dice behavior,
- whether status cards are a limited supply,
- component counts for `edition_manifest`.

---

## 69.4 How much of the Book of Tales should be represented structurally?

Possible progression:

```text
raw reference
      ↓
digitized entry
      ↓
structured choices
      ↓
machine-applicable results
```

We should avoid prematurely trying to convert every story result into executable rules.

---

## 69.5 Exact correction/undo semantics

Resolved for the MVP in §Undo: undo only the last reversible action, rolls are irreversible, and undone draws return to the same position.

Open: whether multi-step undo is needed. Decide after real play sessions.

---

# 70. Recommended Repository Structure

```text
src/
├── app/
│   ├── game/
│   ├── join/
│   ├── admin/
│   └── api/
│
├── components/
│   ├── board/
│   ├── game/
│   ├── player/
│   └── content/
│
├── domain/
│   ├── game/
│   │   ├── actions/
│   │   ├── rules/
│   │   ├── state/
│   │   └── types/
│   │
│   └── content/
│
├── application/
│   ├── commands/
│   ├── queries/
│   └── services/
│
├── infrastructure/
│   ├── database/
│   │   └── supabase/
│   ├── realtime/
│   │   └── supabase/
│   ├── ai/
│   │   └── openai/
│   └── storage/
│       └── supabase/
│
└── lib/
```

The important boundary is:

```text
DOMAIN

must not depend on

SUPABASE / OPENAI / VERCEL
```

This is the target shape, not a day-one requirement. For MVP 1 only `domain/game`, `application/commands`, and `infrastructure/database` need to exist; add the other folders when a feature needs them. The domain boundary is the one rule to keep from the start.

Database migrations, RLS policies, and triggers live in `supabase/migrations/` at the repo root, managed by the Supabase CLI. Drizzle schema definitions mirror them for typed queries.

---

# 71. Example Command Architecture

```ts
type MovePlayerCommand = {
  type: "MOVE_PLAYER"
  gameId: string
  playerId: string
  destinationId: string
  expectedVersion: number
}
```

The actor is not part of the command. It comes from the verified Supabase session.

Processing:

```text
MovePlayerCommand
      │
      ▼
Resolve actor from session (auth.uid → game_players row)
      │
      ▼
Begin transaction
      │
      ├── SELECT games ... FOR UPDATE
      ├── validate expectedVersion
      ├── authorize actor for this action
      ├── validate action (domain rules)
      ├── update player_state
      ├── insert game_actions (with changes)   → trigger queues broadcast
      └── increment games.state_version
      │
      ▼
Commit  → broadcast delivered
      │
      ▼
Return new public state to caller
```

All validation happens inside the transaction, after the lock. This should become the standard mutation pattern.

---

# 72. Product Definition

The clearest way to describe the application is:

> **A synchronized remote tabletop for Tales of the Arabian Nights that progressively assists with bookkeeping, content lookup, and game rules without requiring the entire game to be digitally reimplemented.**

That positioning gives the project a very manageable path:

```text
DIGITAL BOARD
     ↓
DIGITAL BOOKKEEPING
     ↓
ENCOUNTER ASSISTANCE
     ↓
DIGITAL CONTENT
     ↓
SELECTIVE RULE AUTOMATION
```

rather than attempting:

```text
FULL DIGITAL GAME
```

from day one.

---

# 73. Recommended First Technical Spike

Before building significant game functionality, create one vertical slice:

```text
Create Game
      ↓
Player A joins
      ↓
Player B joins
      ↓
SVG board renders
      ↓
Both players see tokens
      ↓
Player A clicks neighboring location
      ↓
Server accepts MOVE_PLAYER
      ↓
Postgres updates
      ↓
Action log records move
      ↓
Realtime update arrives
      ↓
Player B sees token move
      ↓
Both refresh browsers
      ↓
Same state remains
```

The first spike runs as an anonymous Supabase user per browser, with the broadcast coming from the `game_actions` trigger.

Then add a second slice that exercises hidden information and decks, using hand-entered content for one encounter card and one reaction matrix:

```text
Server shuffles a small encounter deck
      ↓
Player A draws (Player B sees "Encounter #N drawn", not the deck order)
      ↓
Server rolls; chart gives the encounter
      ↓
Player A chooses a reaction
      ↓
Paragraph number revealed to Player B (the reader)
      ↓
Player B applies a result (e.g. Player A gains a status)
      ↓
Host undoes it; card/status return correctly
```

If those two flows work reliably, almost every major architectural assumption in this document has been validated. AI card ingestion can be spiked afterwards; it is independent of the game loop.

---

# 74. Overall Recommendation

Build the project as a **stateful multiplayer web application**, not as a digital board-game simulation.

The full list of decisions is in §Resolved Design Decisions. The first milestone proves shared state, synchronization, and hidden information before reproducing the game itself.

