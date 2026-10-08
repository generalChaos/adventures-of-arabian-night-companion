import { and, eq, inArray } from "drizzle-orm";
import {
  gameActions,
  gameEncounters,
  gamePlayers,
  games,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type {
  AssignReaderCommand,
  CancelEncounterCommand,
} from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

const OPEN_STATES = ["DRAWN", "DETERMINED", "REACTION_CHOSEN", "RESOLVING"];

export async function handleAssignReader(
  ctx: CommandContext,
  command: AssignReaderCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;

  await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, command.gameId))
      .for("update")
      .limit(1);
    if (!game) throw new DomainError("NOT_FOUND", "Game not found");
    assertExpectedVersion(game.stateVersion, command.expectedVersion);

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor || actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Only the host can reassign the reader");
    }

    const [encounter] = await tx
      .select()
      .from(gameEncounters)
      .where(
        and(
          eq(gameEncounters.id, command.encounterId),
          eq(gameEncounters.gameId, game.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!encounter) throw new DomainError("NOT_FOUND", "Encounter not found");
    if (!OPEN_STATES.includes(encounter.state)) {
      throw new DomainError("INVALID_ACTION", "Encounter is already finished");
    }

    const [reader] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(
          eq(gamePlayers.id, command.readerPlayerId),
          eq(gamePlayers.gameId, game.id),
        ),
      )
      .limit(1);
    if (!reader) throw new DomainError("NOT_FOUND", "Reader player not found");

    const previousReaderId = encounter.readerPlayerId;
    await tx
      .update(gameEncounters)
      .set({ readerPlayerId: reader.id })
      .where(eq(gameEncounters.id, encounter.id));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "ASSIGN_READER",
      payload: {
        encounterId: encounter.id,
        readerPlayerId: reader.id,
        displayName: reader.displayName,
      },
      changes: [
        {
          table: "game_encounters",
          key: { id: encounter.id },
          before: { reader_player_id: previousReaderId },
          after: { reader_player_id: reader.id },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}

export async function handleCancelEncounter(
  ctx: CommandContext,
  command: CancelEncounterCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;

  await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, command.gameId))
      .for("update")
      .limit(1);
    if (!game) throw new DomainError("NOT_FOUND", "Game not found");
    assertExpectedVersion(game.stateVersion, command.expectedVersion);

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const [encounter] = await tx
      .select()
      .from(gameEncounters)
      .where(
        and(
          eq(gameEncounters.id, command.encounterId),
          eq(gameEncounters.gameId, game.id),
          inArray(gameEncounters.state, OPEN_STATES),
        ),
      )
      .for("update")
      .limit(1);
    if (!encounter) throw new DomainError("NOT_FOUND", "No open encounter");

    const isHost = actor.role === "HOST";
    const isActor = encounter.playerId === actor.id;
    if (!isHost && !isActor) {
      throw new DomainError("FORBIDDEN", "Only host or actor can cancel");
    }

    await tx
      .update(gameEncounters)
      .set({
        state: "CANCELLED",
        completedAt: new Date(),
      })
      .where(eq(gameEncounters.id, encounter.id));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({
        stateVersion: nextVersion,
        phase: "TURN_START",
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "CANCEL_ENCOUNTER",
      payload: { encounterId: encounter.id, reason: command.reason ?? null },
      changes: [
        {
          table: "game_encounters",
          key: { id: encounter.id },
          before: { state: encounter.state },
          after: { state: "CANCELLED" },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
