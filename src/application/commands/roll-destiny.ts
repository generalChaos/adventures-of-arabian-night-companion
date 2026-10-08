import { and, eq } from "drizzle-orm";
import { gameActions, gamePlayers, games } from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { rollDie } from "@/domain/game/rules/dice";
import { DomainError } from "@/domain/game/types/errors";
import type { RollDestinyDieCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

/** Server-authoritative destiny die (d6). Irreversible. */
export async function handleRollDestinyDie(
  ctx: CommandContext,
  command: RollDestinyDieCommand,
): Promise<CommandResult> {
  const { db, userId } = ctx;
  let result = 0;

  await db.transaction(async (tx) => {
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, command.gameId))
      .for("update")
      .limit(1);

    if (!game) throw new DomainError("NOT_FOUND", "Game not found");
    assertExpectedVersion(game.stateVersion, command.expectedVersion);
    if (game.status !== "ACTIVE") {
      throw new DomainError("INVALID_ACTION", "Game is not active");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    result = rollDie(6);
    const nextVersion = game.stateVersion + 1;

    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "ROLL_DESTINY_DIE",
      payload: { result, sides: 6 },
      changes: [],
      reversible: false,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  const snapshot = await loadGameSnapshot(db, command.gameId, userId);
  return { snapshot };
}
