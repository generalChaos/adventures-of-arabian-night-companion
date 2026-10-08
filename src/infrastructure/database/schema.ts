import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const gameEditions = pgTable("game_editions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  publisherReference: text("publisher_reference"),
  language: text("language").notNull().default("en"),
  version: text("version").notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => gameEditions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    region: text("region"),
    spaceType: text("space_type").notNull().default("CITY"),
    isPort: boolean("is_port").notNull().default(false),
    description: text("description"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [unique().on(t.editionId, t.slug)],
);

export const boardLocationLayout = pgTable("board_location_layout", {
  locationId: uuid("location_id")
    .primaryKey()
    .references(() => locations.id, { onDelete: "cascade" }),
  layoutId: text("layout_id").notNull().default("default"),
  xNormalized: numeric("x_normalized", { precision: 6, scale: 5 }).notNull(),
  yNormalized: numeric("y_normalized", { precision: 6, scale: 5 }).notNull(),
  tokenOffsetX: numeric("token_offset_x", { precision: 6, scale: 5 }).notNull().default("0"),
  tokenOffsetY: numeric("token_offset_y", { precision: 6, scale: 5 }).notNull().default("0"),
});

export const boardEdges = pgTable("board_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => gameEditions.id, { onDelete: "cascade" }),
  fromLocationId: uuid("from_location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  toLocationId: uuid("to_location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  connectionType: text("connection_type").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
});

export const wealthLevels = pgTable(
  "wealth_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => gameEditions.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    name: text("name").notNull(),
    landMovement: integer("land_movement").notNull().default(1),
    seaMovement: integer("sea_movement").notNull().default(0),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [unique().on(t.editionId, t.ordinal), unique().on(t.editionId, t.name)],
);

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => gameEditions.id),
  joinCode: text("join_code").notNull().unique(),
  status: text("status").notNull().default("LOBBY"),
  currentTurnPlayerId: uuid("current_turn_player_id"),
  turnNumber: integer("turn_number").notNull().default(0),
  phase: text("phase").notNull().default("LOBBY"),
  stateVersion: integer("state_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("PLAYER"),
    displayName: text("display_name").notNull(),
    characterId: text("character_id"),
    seat: integer("seat"),
    playerColor: text("player_color").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.gameId, t.userId), unique().on(t.gameId, t.seat)],
);

export const playerState = pgTable("player_state", {
  gamePlayerId: uuid("game_player_id")
    .primaryKey()
    .references(() => gamePlayers.id, { onDelete: "cascade" }),
  currentLocationId: uuid("current_location_id").references(() => locations.id),
  wealthLevelId: uuid("wealth_level_id").references(() => wealthLevels.id),
  storyPoints: integer("story_points").notNull().default(0),
  destinyPoints: integer("destiny_points").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerSecrets = pgTable("player_secrets", {
  gamePlayerId: uuid("game_player_id")
    .primaryKey()
    .references(() => gamePlayers.id, { onDelete: "cascade" }),
  storyGoal: integer("story_goal").notNull(),
  destinyGoal: integer("destiny_goal").notNull(),
  chosenAt: timestamp("chosen_at", { withTimezone: true }).notNull().defaultNow(),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
});

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => gameEditions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (t) => [unique().on(t.editionId, t.slug)],
);

export const playerSkills = pgTable(
  "player_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gamePlayerId: uuid("game_player_id")
      .notNull()
      .references(() => gamePlayers.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    masteryLevel: integer("mastery_level").notNull().default(1),
    source: text("source").notNull().default("manual"),
  },
  (t) => [unique().on(t.gamePlayerId, t.skillId)],
);

export const gameActions = pgTable(
  "game_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    actorPlayerId: uuid("actor_player_id").references(() => gamePlayers.id),
    actionType: text("action_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    changes: jsonb("changes").notNull().default([]),
    reversible: boolean("reversible").notNull().default(true),
    revertsActionId: uuid("reverts_action_id"),
    previousStateVersion: integer("previous_state_version").notNull(),
    resultingStateVersion: integer("resulting_state_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.gameId, t.sequence)],
);

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => gameEditions.id, { onDelete: "cascade" }),
  cardType: text("card_type").notNull(),
  cardNumber: integer("card_number"),
  title: text("title").notNull(),
  sourceImageId: text("source_image_id"),
  status: text("status").notNull().default("PUBLISHED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cardContent = pgTable("card_content", {
  cardId: uuid("card_id")
    .primaryKey()
    .references(() => cards.id, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  contentJson: jsonb("content_json").notNull().default({}),
});

export const gamePiles = pgTable("game_piles", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  pileType: text("pile_type").notNull(),
  ownerPlayerId: uuid("owner_player_id").references(() => gamePlayers.id, {
    onDelete: "cascade",
  }),
});

export const gamePileCards = pgTable(
  "game_pile_cards",
  {
    pileId: uuid("pile_id")
      .notNull()
      .references(() => gamePiles.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id),
    position: integer("position").notNull(),
  },
  (t) => [unique().on(t.pileId, t.cardId)],
);

export const playerStatuses = pgTable("player_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  gamePlayerId: uuid("game_player_id")
    .notNull()
    .references(() => gamePlayers.id, { onDelete: "cascade" }),
  statusCardId: uuid("status_card_id")
    .notNull()
    .references(() => cards.id),
  active: boolean("active").notNull().default(true),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
});

export const playerTreasures = pgTable("player_treasures", {
  id: uuid("id").primaryKey().defaultRandom(),
  gamePlayerId: uuid("game_player_id")
    .notNull()
    .references(() => gamePlayers.id, { onDelete: "cascade" }),
  treasureCardId: uuid("treasure_card_id")
    .notNull()
    .references(() => cards.id),
  state: text("state").notNull().default("HELD"),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({}),
});

export const gameEncounters = pgTable("game_encounters", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => gamePlayers.id),
  locationId: uuid("location_id").references(() => locations.id),
  encounterCardId: uuid("encounter_card_id").references(() => cards.id),
  dieRoll: integer("die_roll"),
  encounterChartEntryId: uuid("encounter_chart_entry_id"),
  readerPlayerId: uuid("reader_player_id").references(() => gamePlayers.id),
  chosenReaction: text("chosen_reaction"),
  paragraphNumber: integer("paragraph_number"),
  state: text("state").notNull().default("DRAWN"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
});

export const reactionMatrices = pgTable("reaction_matrices", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => gameEditions.id, { onDelete: "cascade" }),
  matrixNumber: integer("matrix_number").notNull(),
});

export const reactionMatrixCells = pgTable(
  "reaction_matrix_cells",
  {
    matrixId: uuid("matrix_id")
      .notNull()
      .references(() => reactionMatrices.id, { onDelete: "cascade" }),
    rowKey: text("row_key").notNull(),
    reaction: text("reaction").notNull(),
    paragraphNumber: integer("paragraph_number").notNull(),
  },
  (t) => [unique().on(t.matrixId, t.rowKey, t.reaction)],
);

export const encounterChartEntries = pgTable("encounter_chart_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => gameEditions.id, { onDelete: "cascade" }),
  encounterKey: text("encounter_key").notNull(),
  rollMin: integer("roll_min").notNull(),
  rollMax: integer("roll_max").notNull(),
  descriptor: text("descriptor").notNull(),
  matrixId: uuid("matrix_id").references(() => reactionMatrices.id),
});

export const appAdmins = pgTable("app_admins", {
  userId: uuid("user_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const editionManifest = pgTable("edition_manifest", {
  editionId: uuid("edition_id")
    .primaryKey()
    .references(() => gameEditions.id, { onDelete: "cascade" }),
  encounterCards: integer("encounter_cards").notNull().default(0),
  treasureCards: integer("treasure_cards").notNull().default(0),
  questCards: integer("quest_cards").notNull().default(0),
  statusCards: integer("status_cards").notNull().default(0),
  skills: integer("skills").notNull().default(0),
  wealthLevels: integer("wealth_levels").notNull().default(0),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentImports = pgTable("content_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => gameEditions.id, { onDelete: "cascade" }),
  imagePath: text("image_path").notNull(),
  imageHash: text("image_hash"),
  requestedType: text("requested_type").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version").notNull().default("v1"),
  rawResponse: jsonb("raw_response"),
  parsedData: jsonb("parsed_data"),
  confidenceMetadata: jsonb("confidence_metadata").notNull().default({}),
  status: text("status").notNull().default("UPLOADED"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedCardId: uuid("published_card_id").references(() => cards.id),
});
