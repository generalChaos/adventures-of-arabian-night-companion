import { getDb } from "@/infrastructure/database/drizzle";
import type { GameCommand } from "@/domain/game/types/commands";
import { DomainError } from "@/domain/game/types/errors";
import { ensureAuthenticatedUser } from "@/application/services/auth";
import {
  createRequestId,
  expectedVersionFromCommand,
  gameIdFromCommand,
  logCommand,
} from "@/application/services/command-log";
import { handleCreateGame } from "./create-game";
import { handleJoinGame } from "./join-game";
import { handleMovePlayer } from "./move-player";
import { handleStartGame } from "./start-game";
import { handleUndo } from "./undo";
import { handleDrawCard } from "./draw-card";
import { handleRecordDraw } from "./record-draw";
import { handleDetermineEncounter } from "./determine-encounter";
import { handleChooseReaction } from "./choose-reaction";
import { handleGainStatus } from "./gain-status";
import { handleCompleteEncounter } from "./complete-encounter";
import {
  handleAssignReader,
  handleCancelEncounter,
} from "./encounter-control";
import {
  handleEndTurn,
  handlePauseGame,
  handleResumeGame,
} from "./turn-control";
import {
  handleAdminCorrection,
  handleSelectCharacter,
} from "./admin-correction";
import { handleChangeWealth } from "./change-wealth";
import {
  handleRevealGoals,
  handleSetVictoryGoals,
} from "./victory-goals";
import { handleAdjustSkill } from "./adjust-skill";
import {
  handleGainTreasure,
  handleLoseStatus,
  handleLoseTreasure,
} from "./inventory";
import { handleRollDestinyDie } from "./roll-destiny";
import { handleAdjustPoints } from "./adjust-points";
import type { CommandResult } from "./types";

export async function runCommand(command: GameCommand): Promise<CommandResult> {
  const requestId = createRequestId();
  const started = Date.now();
  const user = await ensureAuthenticatedUser();
  const db = getDb();
  const ctx = { db, userId: user.id };

  try {
    let result: CommandResult;
    switch (command.type) {
      case "CREATE_GAME":
        result = await handleCreateGame(ctx, command);
        break;
      case "JOIN_GAME":
        result = await handleJoinGame(ctx, command);
        break;
      case "MOVE_PLAYER":
        result = await handleMovePlayer(ctx, command);
        break;
      case "START_GAME":
        result = await handleStartGame(ctx, command);
        break;
      case "UNDO":
        result = await handleUndo(ctx, command);
        break;
      case "DRAW_CARD":
        result = await handleDrawCard(ctx, command);
        break;
      case "RECORD_DRAW":
        result = await handleRecordDraw(ctx, command);
        break;
      case "DETERMINE_ENCOUNTER":
        result = await handleDetermineEncounter(ctx, command);
        break;
      case "CHOOSE_REACTION":
        result = await handleChooseReaction(ctx, command);
        break;
      case "GAIN_STATUS":
        result = await handleGainStatus(ctx, command);
        break;
      case "LOSE_STATUS":
        result = await handleLoseStatus(ctx, command);
        break;
      case "GAIN_TREASURE":
        result = await handleGainTreasure(ctx, command);
        break;
      case "LOSE_TREASURE":
        result = await handleLoseTreasure(ctx, command);
        break;
      case "COMPLETE_ENCOUNTER":
        result = await handleCompleteEncounter(ctx, command);
        break;
      case "ASSIGN_READER":
        result = await handleAssignReader(ctx, command);
        break;
      case "CANCEL_ENCOUNTER":
        result = await handleCancelEncounter(ctx, command);
        break;
      case "END_TURN":
        result = await handleEndTurn(ctx, command);
        break;
      case "PAUSE_GAME":
        result = await handlePauseGame(ctx, command);
        break;
      case "RESUME_GAME":
        result = await handleResumeGame(ctx, command);
        break;
      case "SELECT_CHARACTER":
        result = await handleSelectCharacter(ctx, command);
        break;
      case "ADMIN_CORRECTION":
        result = await handleAdminCorrection(ctx, command);
        break;
      case "CHANGE_WEALTH":
        result = await handleChangeWealth(ctx, command);
        break;
      case "SET_VICTORY_GOALS":
        result = await handleSetVictoryGoals(ctx, command);
        break;
      case "REVEAL_GOALS":
        result = await handleRevealGoals(ctx, command);
        break;
      case "ADJUST_SKILL":
        result = await handleAdjustSkill(ctx, command);
        break;
      case "ROLL_DESTINY_DIE":
        result = await handleRollDestinyDie(ctx, command);
        break;
      case "ADJUST_POINTS":
        result = await handleAdjustPoints(ctx, command);
        break;
      default: {
        const _exhaustive: never = command;
        throw new DomainError(
          "INVALID_ACTION",
          `Unknown command: ${JSON.stringify(_exhaustive)}`,
        );
      }
    }

    logCommand({
      requestId,
      gameId: gameIdFromCommand(command) ?? result.snapshot.game.id,
      actorId: user.id,
      actionType: command.type,
      expectedVersion: expectedVersionFromCommand(command),
      durationMs: Date.now() - started,
      success: true,
    });
    return result;
  } catch (error) {
    logCommand({
      requestId,
      gameId: gameIdFromCommand(command),
      actorId: user.id,
      actionType: command.type,
      expectedVersion: expectedVersionFromCommand(command),
      durationMs: Date.now() - started,
      success: false,
      errorCode: error instanceof DomainError ? error.code : "INTERNAL",
    });
    throw error;
  }
}
