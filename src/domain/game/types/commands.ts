import type { GameId, GamePlayerId, LocationId } from "./ids";

export type CreateGameCommand = {
  type: "CREATE_GAME";
  editionId: string;
  displayName: string;
};

export type JoinGameCommand = {
  type: "JOIN_GAME";
  joinCode: string;
  displayName: string;
};

export type MovePlayerCommand = {
  type: "MOVE_PLAYER";
  gameId: GameId;
  playerId: GamePlayerId;
  destinationId: LocationId;
  expectedVersion: number;
};

export type StartGameCommand = {
  type: "START_GAME";
  gameId: GameId;
  expectedVersion: number;
};

export type UndoCommand = {
  type: "UNDO";
  gameId: GameId;
  expectedVersion: number;
};

export type DrawCardCommand = {
  type: "DRAW_CARD";
  gameId: GameId;
  pileType: "ENCOUNTER_DECK";
  expectedVersion: number;
};

export type RecordDrawCommand = {
  type: "RECORD_DRAW";
  gameId: GameId;
  cardNumber: number;
  expectedVersion: number;
};

export type DetermineEncounterCommand = {
  type: "DETERMINE_ENCOUNTER";
  gameId: GameId;
  encounterId: string;
  expectedVersion: number;
};

export type ChooseReactionCommand = {
  type: "CHOOSE_REACTION";
  gameId: GameId;
  encounterId: string;
  reaction: string;
  expectedVersion: number;
};

export type GainStatusCommand = {
  type: "GAIN_STATUS";
  gameId: GameId;
  playerId: GamePlayerId;
  statusCardId: string;
  expectedVersion: number;
};

export type LoseStatusCommand = {
  type: "LOSE_STATUS";
  gameId: GameId;
  statusInstanceId: string;
  expectedVersion: number;
};

export type GainTreasureCommand = {
  type: "GAIN_TREASURE";
  gameId: GameId;
  playerId: GamePlayerId;
  treasureCardId: string;
  expectedVersion: number;
};

export type LoseTreasureCommand = {
  type: "LOSE_TREASURE";
  gameId: GameId;
  treasureInstanceId: string;
  expectedVersion: number;
};

export type CompleteEncounterCommand = {
  type: "COMPLETE_ENCOUNTER";
  gameId: GameId;
  encounterId: string;
  expectedVersion: number;
};

export type AssignReaderCommand = {
  type: "ASSIGN_READER";
  gameId: GameId;
  encounterId: string;
  readerPlayerId: GamePlayerId;
  expectedVersion: number;
};

export type CancelEncounterCommand = {
  type: "CANCEL_ENCOUNTER";
  gameId: GameId;
  encounterId: string;
  reason?: string;
  expectedVersion: number;
};

export type EndTurnCommand = {
  type: "END_TURN";
  gameId: GameId;
  expectedVersion: number;
};

export type PauseGameCommand = {
  type: "PAUSE_GAME";
  gameId: GameId;
  expectedVersion: number;
};

export type ResumeGameCommand = {
  type: "RESUME_GAME";
  gameId: GameId;
  expectedVersion: number;
};

export type SelectCharacterCommand = {
  type: "SELECT_CHARACTER";
  gameId: GameId;
  characterId: string;
  expectedVersion: number;
};

export type AdminCorrectionCommand = {
  type: "ADMIN_CORRECTION";
  gameId: GameId;
  playerId: GamePlayerId;
  locationId?: LocationId;
  storyPoints?: number;
  destinyPoints?: number;
  note?: string;
  expectedVersion: number;
};

export type ChangeWealthCommand = {
  type: "CHANGE_WEALTH";
  gameId: GameId;
  playerId: GamePlayerId;
  direction: "UP" | "DOWN";
  expectedVersion: number;
};

export type SetVictoryGoalsCommand = {
  type: "SET_VICTORY_GOALS";
  gameId: GameId;
  storyGoal: number;
  destinyGoal: number;
  expectedVersion: number;
};

export type RevealGoalsCommand = {
  type: "REVEAL_GOALS";
  gameId: GameId;
  expectedVersion: number;
};

export type AdjustSkillCommand = {
  type: "ADJUST_SKILL";
  gameId: GameId;
  playerId: GamePlayerId;
  skillId: string;
  delta: 1 | -1;
  expectedVersion: number;
};

export type RollDestinyDieCommand = {
  type: "ROLL_DESTINY_DIE";
  gameId: GameId;
  expectedVersion: number;
};

export type AdjustPointsCommand = {
  type: "ADJUST_POINTS";
  gameId: GameId;
  playerId: GamePlayerId;
  storyDelta?: number;
  destinyDelta?: number;
  expectedVersion: number;
};

export type GameCommand =
  | CreateGameCommand
  | JoinGameCommand
  | MovePlayerCommand
  | StartGameCommand
  | UndoCommand
  | DrawCardCommand
  | RecordDrawCommand
  | DetermineEncounterCommand
  | ChooseReactionCommand
  | GainStatusCommand
  | LoseStatusCommand
  | GainTreasureCommand
  | LoseTreasureCommand
  | CompleteEncounterCommand
  | AssignReaderCommand
  | CancelEncounterCommand
  | EndTurnCommand
  | PauseGameCommand
  | ResumeGameCommand
  | SelectCharacterCommand
  | AdminCorrectionCommand
  | ChangeWealthCommand
  | SetVictoryGoalsCommand
  | RevealGoalsCommand
  | AdjustSkillCommand
  | RollDestinyDieCommand
  | AdjustPointsCommand;
