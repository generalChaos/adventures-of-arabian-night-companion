import { and, eq } from "drizzle-orm";
import { gameActions, gameEncounters, gamePlayers, games } from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type { CompleteEncounterCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleCompleteEncounter(
  ctx: CommandContext,
  command: CompleteEncounterCommand,
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
        ),
      )
      .for("update")
      .limit(1);

    if (!encounter) throw new DomainError("NOT_FOUND", "Encounter not found");
    if (!["REACTION_CHOSEN", "RESOLVING"].includes(encounter.state)) {
      throw new DomainError("INVALID_ACTION", "Encounter cannot be completed yet");
    }

    const isReader = encounter.readerPlayerId === actor.id;
    const isActor = encounter.playerId === actor.id;
    const isHost = actor.role === "HOST";
    if (!isReader && !isActor && !isHost) {
      throw new DomainError("FORBIDDEN", "Only reader, actor, or host can complete");
    }

    await tx
      .update(gameEncounters)
      .set({
        state: "COMPLETE",
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
      actionType: "COMPLETE_ENCOUNTER",
      payload: { encounterId: encounter.id },
      changes: [
        {
          table: "game_encounters",
          key: { id: encounter.id },
          before: { state: encounter.state },
          after: { state: "COMPLETE" },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
