import type { EditionId, GameId, GamePlayerId, LocationId, UserId } from "./ids";

export type GameStatus = "LOBBY" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ABANDONED";
export type PlayerRole = "HOST" | "PLAYER" | "SPECTATOR";
export type ConnectionType = "LAND" | "SEA";

export type Game = {
  id: GameId;
  editionId: EditionId;
  joinCode: string;
  status: GameStatus;
  currentTurnPlayerId: GamePlayerId | null;
  turnNumber: number;
  phase: string;
  stateVersion: number;
};

export type GamePlayer = {
  id: GamePlayerId;
  gameId: GameId;
  userId: UserId;
  role: PlayerRole;
  displayName: string;
  characterId: string | null;
  seat: number | null;
  playerColor: string;
};

export type PlayerState = {
  gamePlayerId: GamePlayerId;
  currentLocationId: LocationId | null;
  wealthLevelId: string | null;
  wealthName: string | null;
  landMovement: number | null;
  seaMovement: number | null;
  storyPoints: number;
  destinyPoints: number;
};

export type BoardLocation = {
  id: LocationId;
  slug: string;
  name: string;
  spaceType: string;
  isPort: boolean;
  x: number;
  y: number;
};

export type BoardEdge = {
  id: string;
  fromLocationId: LocationId;
  toLocationId: LocationId;
  connectionType: ConnectionType;
};

export type StateChange = {
  table: string;
  key: Record<string, string>;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type GameActionRecord = {
  id: string;
  gameId: GameId;
  sequence: number;
  actorPlayerId: GamePlayerId | null;
  actionType: string;
  payload: Record<string, unknown>;
  changes: StateChange[];
  reversible: boolean;
  previousStateVersion: number;
  resultingStateVersion: number;
};

export type PlayerSecretsView = {
  storyGoal: number;
  destinyGoal: number;
  chosenAt: string;
};

export type RevealedGoalView = {
  gamePlayerId: GamePlayerId;
  displayName: string;
  storyGoal: number;
  destinyGoal: number;
};

export type GameSnapshot = {
  game: Game;
  players: GamePlayer[];
  playerStates: PlayerState[];
  locations: BoardLocation[];
  edges: BoardEdge[];
  me: GamePlayer | null;
  /** OWNER-only; null for spectators / other players' secrets. */
  mySecrets: PlayerSecretsView | null;
  /** Populated after REVEAL_GOALS. */
  revealedGoals: RevealedGoalView[];
  playersWithGoalsSet: GamePlayerId[];
  activeEncounter: ActiveEncounter | null;
  availableReactions: string[];
  statuses: PlayerStatusView[];
  treasures: PlayerTreasureView[];
  statusCatalog: CardCatalogEntry[];
  treasureCatalog: CardCatalogEntry[];
  skillsCatalog: SkillCatalogEntry[];
  playerSkills: PlayerSkillView[];
  recentActions: PublicActionSummary[];
  lastDestinyRoll: number | null;
};

export type CardCatalogEntry = {
  id: string;
  title: string;
  cardNumber: number | null;
};

export type SkillCatalogEntry = {
  id: string;
  slug: string;
  name: string;
};

export type PlayerSkillView = {
  id: string;
  gamePlayerId: GamePlayerId;
  skillId: string;
  skillName: string;
  masteryLevel: number;
};

export type ActiveEncounter = {
  id: string;
  playerId: GamePlayerId;
  readerPlayerId: GamePlayerId | null;
  encounterCardId: string | null;
  cardTitle: string | null;
  cardNumber: number | null;
  dieRoll: number | null;
  descriptor: string | null;
  chosenReaction: string | null;
  /** Null until REACTION_CHOSEN / later (SERVER_ONLY before that). */
  paragraphNumber: number | null;
  state: string;
  /** False when card_content is missing — use physical Book of Tales. */
  contentDigitized: boolean;
};

export type PlayerStatusView = {
  id: string;
  gamePlayerId: GamePlayerId;
  statusCardId: string;
  title: string;
  active: boolean;
};

export type PlayerTreasureView = {
  id: string;
  gamePlayerId: GamePlayerId;
  treasureCardId: string;
  title: string;
  state: string;
};

export type PublicActionSummary = {
  sequence: number;
  actionType: string;
  actorPlayerId: string | null;
  payload: Record<string, unknown>;
};
