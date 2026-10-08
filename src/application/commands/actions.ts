"use server";

import { z } from "zod";
import { DomainError } from "@/domain/game/types/errors";
import { runCommand } from "./run-command";
import type { GameSnapshot } from "@/domain/game/types/game";

export type ActionResult =
  | { ok: true; snapshot: GameSnapshot }
  | { ok: false; code: string; message: string; status: number };

function toResult(error: unknown): ActionResult {
  if (error instanceof DomainError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      status: error.status,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "INVALID_ACTION",
      message: error.issues[0]?.message ?? "Invalid input",
      status: 400,
    };
  }
  console.error(error);
  return {
    ok: false,
    code: "INTERNAL",
    message: "Unexpected server error",
    status: 500,
  };
}

const createSchema = z.object({
  editionId: z.string().uuid(),
  displayName: z.string().min(1).max(40),
});

export async function createGameAction(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const data = createSchema.parse(input);
    const { snapshot } = await runCommand({ type: "CREATE_GAME", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const joinSchema = z.object({
  joinCode: z.string().min(4).max(12),
  displayName: z.string().min(1).max(40),
});

export async function joinGameAction(
  input: z.infer<typeof joinSchema>,
): Promise<ActionResult> {
  try {
    const data = joinSchema.parse(input);
    const { snapshot } = await runCommand({ type: "JOIN_GAME", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const moveSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  destinationId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function movePlayerAction(
  input: z.infer<typeof moveSchema>,
): Promise<ActionResult> {
  try {
    const data = moveSchema.parse(input);
    const { snapshot } = await runCommand({ type: "MOVE_PLAYER", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const startSchema = z.object({
  gameId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function startGameAction(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult> {
  try {
    const data = startSchema.parse(input);
    const { snapshot } = await runCommand({ type: "START_GAME", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

export async function undoAction(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult> {
  try {
    const data = startSchema.parse(input);
    const { snapshot } = await runCommand({ type: "UNDO", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const drawSchema = z.object({
  gameId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function drawCardAction(
  input: z.infer<typeof drawSchema>,
): Promise<ActionResult> {
  try {
    const data = drawSchema.parse(input);
    const { snapshot } = await runCommand({
      type: "DRAW_CARD",
      pileType: "ENCOUNTER_DECK",
      ...data,
    });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const recordDrawSchema = z.object({
  gameId: z.string().uuid(),
  cardNumber: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function recordDrawAction(
  input: z.infer<typeof recordDrawSchema>,
): Promise<ActionResult> {
  try {
    const data = recordDrawSchema.parse(input);
    const { snapshot } = await runCommand({ type: "RECORD_DRAW", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const encounterIdSchema = z.object({
  gameId: z.string().uuid(),
  encounterId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function determineEncounterAction(
  input: z.infer<typeof encounterIdSchema>,
): Promise<ActionResult> {
  try {
    const data = encounterIdSchema.parse(input);
    const { snapshot } = await runCommand({ type: "DETERMINE_ENCOUNTER", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const chooseSchema = encounterIdSchema.extend({
  reaction: z.string().min(1).max(40),
});

export async function chooseReactionAction(
  input: z.infer<typeof chooseSchema>,
): Promise<ActionResult> {
  try {
    const data = chooseSchema.parse(input);
    const { snapshot } = await runCommand({ type: "CHOOSE_REACTION", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const gainStatusSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  statusCardId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function gainStatusAction(
  input: z.infer<typeof gainStatusSchema>,
): Promise<ActionResult> {
  try {
    const data = gainStatusSchema.parse(input);
    const { snapshot } = await runCommand({ type: "GAIN_STATUS", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const loseStatusSchema = z.object({
  gameId: z.string().uuid(),
  statusInstanceId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function loseStatusAction(
  input: z.infer<typeof loseStatusSchema>,
): Promise<ActionResult> {
  try {
    const data = loseStatusSchema.parse(input);
    const { snapshot } = await runCommand({ type: "LOSE_STATUS", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const gainTreasureSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  treasureCardId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function gainTreasureAction(
  input: z.infer<typeof gainTreasureSchema>,
): Promise<ActionResult> {
  try {
    const data = gainTreasureSchema.parse(input);
    const { snapshot } = await runCommand({ type: "GAIN_TREASURE", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const loseTreasureSchema = z.object({
  gameId: z.string().uuid(),
  treasureInstanceId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function loseTreasureAction(
  input: z.infer<typeof loseTreasureSchema>,
): Promise<ActionResult> {
  try {
    const data = loseTreasureSchema.parse(input);
    const { snapshot } = await runCommand({ type: "LOSE_TREASURE", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

export async function completeEncounterAction(
  input: z.infer<typeof encounterIdSchema>,
): Promise<ActionResult> {
  try {
    const data = encounterIdSchema.parse(input);
    const { snapshot } = await runCommand({ type: "COMPLETE_ENCOUNTER", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const assignReaderSchema = z.object({
  gameId: z.string().uuid(),
  encounterId: z.string().uuid(),
  readerPlayerId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function assignReaderAction(
  input: z.infer<typeof assignReaderSchema>,
): Promise<ActionResult> {
  try {
    const data = assignReaderSchema.parse(input);
    const { snapshot } = await runCommand({ type: "ASSIGN_READER", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const cancelEncounterSchema = z.object({
  gameId: z.string().uuid(),
  encounterId: z.string().uuid(),
  reason: z.string().max(200).optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function cancelEncounterAction(
  input: z.infer<typeof cancelEncounterSchema>,
): Promise<ActionResult> {
  try {
    const data = cancelEncounterSchema.parse(input);
    const { snapshot } = await runCommand({ type: "CANCEL_ENCOUNTER", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

export async function endTurnAction(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult> {
  try {
    const data = startSchema.parse(input);
    const { snapshot } = await runCommand({ type: "END_TURN", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

export async function pauseGameAction(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult> {
  try {
    const data = startSchema.parse(input);
    const { snapshot } = await runCommand({ type: "PAUSE_GAME", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

export async function resumeGameAction(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult> {
  try {
    const data = startSchema.parse(input);
    const { snapshot } = await runCommand({ type: "RESUME_GAME", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const selectCharacterSchema = z.object({
  gameId: z.string().uuid(),
  characterId: z.string().min(1).max(64),
  expectedVersion: z.number().int().nonnegative(),
});

export async function selectCharacterAction(
  input: z.infer<typeof selectCharacterSchema>,
): Promise<ActionResult> {
  try {
    const data = selectCharacterSchema.parse(input);
    const { snapshot } = await runCommand({ type: "SELECT_CHARACTER", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const adminCorrectionSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  storyPoints: z.number().int().min(0).max(100).optional(),
  destinyPoints: z.number().int().min(0).max(100).optional(),
  note: z.string().max(200).optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function adminCorrectionAction(
  input: z.infer<typeof adminCorrectionSchema>,
): Promise<ActionResult> {
  try {
    const data = adminCorrectionSchema.parse(input);
    const { snapshot } = await runCommand({ type: "ADMIN_CORRECTION", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const changeWealthSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  direction: z.enum(["UP", "DOWN"]),
  expectedVersion: z.number().int().nonnegative(),
});

export async function changeWealthAction(
  input: z.infer<typeof changeWealthSchema>,
): Promise<ActionResult> {
  try {
    const data = changeWealthSchema.parse(input);
    const { snapshot } = await runCommand({ type: "CHANGE_WEALTH", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const setVictoryGoalsSchema = z.object({
  gameId: z.string().uuid(),
  storyGoal: z.number().int().min(0).max(100),
  destinyGoal: z.number().int().min(0).max(100),
  expectedVersion: z.number().int().nonnegative(),
});

export async function setVictoryGoalsAction(
  input: z.infer<typeof setVictoryGoalsSchema>,
): Promise<ActionResult> {
  try {
    const data = setVictoryGoalsSchema.parse(input);
    const { snapshot } = await runCommand({
      type: "SET_VICTORY_GOALS",
      ...data,
    });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

export async function revealGoalsAction(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult> {
  try {
    const data = startSchema.parse(input);
    const { snapshot } = await runCommand({ type: "REVEAL_GOALS", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const adjustSkillSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  skillId: z.string().uuid(),
  delta: z.union([z.literal(1), z.literal(-1)]),
  expectedVersion: z.number().int().nonnegative(),
});

export async function adjustSkillAction(
  input: z.infer<typeof adjustSkillSchema>,
): Promise<ActionResult> {
  try {
    const data = adjustSkillSchema.parse(input);
    const { snapshot } = await runCommand({ type: "ADJUST_SKILL", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

export async function rollDestinyDieAction(
  input: z.infer<typeof startSchema>,
): Promise<ActionResult> {
  try {
    const data = startSchema.parse(input);
    const { snapshot } = await runCommand({
      type: "ROLL_DESTINY_DIE",
      ...data,
    });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}

const adjustPointsSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  storyDelta: z.number().int().min(-5).max(5).optional(),
  destinyDelta: z.number().int().min(-5).max(5).optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export async function adjustPointsAction(
  input: z.infer<typeof adjustPointsSchema>,
): Promise<ActionResult> {
  try {
    const data = adjustPointsSchema.parse(input);
    const { snapshot } = await runCommand({ type: "ADJUST_POINTS", ...data });
    return { ok: true, snapshot };
  } catch (error) {
    return toResult(error);
  }
}
