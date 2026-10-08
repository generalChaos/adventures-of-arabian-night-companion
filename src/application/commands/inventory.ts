import { and, eq } from "drizzle-orm";
import {
  cards,
  gameActions,
  gamePlayers,
  games,
  playerStatuses,
  playerTreasures,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type {
  GainTreasureCommand,
  LoseStatusCommand,
  LoseTreasureCommand,
} from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleGainTreasure(
  ctx: CommandContext,
  command: GainTreasureCommand,
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
    if (game.status !== "ACTIVE") {
      throw new DomainError("INVALID_ACTION", "Game is not active");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const [target] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.id, command.playerId), eq(gamePlayers.gameId, game.id)),
      )
      .limit(1);
    if (!target) throw new DomainError("NOT_FOUND", "Target player not found");
    if (actor.id !== target.id && actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Can only grant treasure to yourself");
    }

    const [card] = await tx
      .select()
      .from(cards)
      .where(
        and(eq(cards.id, command.treasureCardId), eq(cards.cardType, "TREASURE")),
      )
      .limit(1);
    if (!card) throw new DomainError("NOT_FOUND", "Treasure card not found");

    const [row] = await tx
      .insert(playerTreasures)
      .values({
        gamePlayerId: target.id,
        treasureCardId: card.id,
        state: "HELD",
      })
      .returning();
    if (!row) throw new DomainError("INVALID_ACTION", "Failed to grant treasure");

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "GAIN_TREASURE",
      payload: {
        playerId: target.id,
        treasureCardId: card.id,
        title: card.title,
      },
      changes: [
        {
          table: "player_treasures",
          key: { id: row.id },
          before: null,
          after: {
            game_player_id: target.id,
            treasure_card_id: card.id,
            state: "HELD",
          },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}

export async function handleLoseTreasure(
  ctx: CommandContext,
  command: LoseTreasureCommand,
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
    if (game.status !== "ACTIVE") {
      throw new DomainError("INVALID_ACTION", "Game is not active");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const [row] = await tx
      .select()
      .from(playerTreasures)
      .where(eq(playerTreasures.id, command.treasureInstanceId))
      .limit(1);
    if (!row || row.state !== "HELD") {
      throw new DomainError("NOT_FOUND", "Treasure not held");
    }

    const [owner] = await tx
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.id, row.gamePlayerId))
      .limit(1);
    if (!owner || owner.gameId !== game.id) {
      throw new DomainError("NOT_FOUND", "Treasure owner not in game");
    }
    if (actor.id !== owner.id && actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Can only lose your own treasure");
    }

    const [card] = await tx
      .select()
      .from(cards)
      .where(eq(cards.id, row.treasureCardId))
      .limit(1);

    await tx
      .update(playerTreasures)
      .set({ state: "LOST" })
      .where(eq(playerTreasures.id, row.id));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "LOSE_TREASURE",
      payload: {
        playerId: owner.id,
        treasureInstanceId: row.id,
        title: card?.title ?? "Treasure",
      },
      changes: [
        {
          table: "player_treasures",
          key: { id: row.id },
          before: { state: "HELD" },
          after: { state: "LOST" },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}

export async function handleLoseStatus(
  ctx: CommandContext,
  command: LoseStatusCommand,
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
    if (game.status !== "ACTIVE") {
      throw new DomainError("INVALID_ACTION", "Game is not active");
    }

    const [actor] = await tx
      .select()
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)))
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const [row] = await tx
      .select()
      .from(playerStatuses)
      .where(eq(playerStatuses.id, command.statusInstanceId))
      .limit(1);
    if (!row || !row.active) {
      throw new DomainError("NOT_FOUND", "Status not active");
    }

    const [owner] = await tx
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.id, row.gamePlayerId))
      .limit(1);
    if (!owner || owner.gameId !== game.id) {
      throw new DomainError("NOT_FOUND", "Status owner not in game");
    }
    if (actor.id !== owner.id && actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Can only remove your own status");
    }

    const [card] = await tx
      .select()
      .from(cards)
      .where(eq(cards.id, row.statusCardId))
      .limit(1);

    await tx
      .update(playerStatuses)
      .set({ active: false, removedAt: new Date() })
      .where(eq(playerStatuses.id, row.id));

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "LOSE_STATUS",
      payload: {
        playerId: owner.id,
        statusInstanceId: row.id,
        title: card?.title ?? "Status",
      },
      changes: [
        {
          table: "player_statuses",
          key: { id: row.id },
          before: { active: true, removed_at: null },
          after: { active: false },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
