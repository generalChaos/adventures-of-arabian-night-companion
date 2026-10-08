import { and, asc, eq, inArray } from "drizzle-orm";
import {
  cards,
  gameActions,
  gameEncounters,
  gamePileCards,
  gamePiles,
  gamePlayers,
  games,
  playerState,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type { DrawCardCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { nextSeatPlayerId } from "@/application/queries/next-seat";
import type { CommandContext, CommandResult } from "./types";

export async function handleDrawCard(
  ctx: CommandContext,
  command: DrawCardCommand,
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
    if (game.currentTurnPlayerId && game.currentTurnPlayerId !== actor.id) {
      throw new DomainError("INVALID_ACTION", "Not your turn");
    }

    const [open] = await tx
      .select()
      .from(gameEncounters)
      .where(
        and(
          eq(gameEncounters.gameId, game.id),
          inArray(gameEncounters.state, [
            "DRAWN",
            "DETERMINED",
            "REACTION_CHOSEN",
            "RESOLVING",
          ]),
        ),
      )
      .limit(1);
    if (open) {
      throw new DomainError("INVALID_ACTION", "An encounter is already in progress");
    }

    const [pile] = await tx
      .select()
      .from(gamePiles)
      .where(
        and(eq(gamePiles.gameId, game.id), eq(gamePiles.pileType, command.pileType)),
      )
      .limit(1);

    if (!pile) throw new DomainError("INVALID_ACTION", "Deck not found");

    const [top] = await tx
      .select()
      .from(gamePileCards)
      .where(eq(gamePileCards.pileId, pile.id))
      .orderBy(asc(gamePileCards.position))
      .limit(1);

    if (!top) throw new DomainError("INVALID_ACTION", "Deck is empty");

    const [card] = await tx
      .select()
      .from(cards)
      .where(eq(cards.id, top.cardId))
      .limit(1);

    const [state] = await tx
      .select()
      .from(playerState)
      .where(eq(playerState.gamePlayerId, actor.id))
      .limit(1);

    const readerId = await nextSeatPlayerId(tx, game.id, actor.id);

    await tx
      .delete(gamePileCards)
      .where(
        and(eq(gamePileCards.pileId, pile.id), eq(gamePileCards.cardId, top.cardId)),
      );

    const [encounter] = await tx
      .insert(gameEncounters)
      .values({
        gameId: game.id,
        playerId: actor.id,
        locationId: state?.currentLocationId ?? null,
        encounterCardId: top.cardId,
        readerPlayerId: readerId,
        state: "DRAWN",
      })
      .returning();

    if (!encounter) throw new DomainError("INVALID_ACTION", "Failed to start encounter");

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({
        stateVersion: nextVersion,
        phase: "ENCOUNTER",
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "DRAW_CARD",
      payload: {
        pileType: command.pileType,
        cardId: top.cardId,
        cardNumber: card?.cardNumber ?? null,
        title: card?.title ?? null,
        encounterId: encounter.id,
      },
      changes: [
        {
          table: "game_pile_cards",
          key: { pile_id: pile.id, card_id: top.cardId },
          before: { pile_id: pile.id, card_id: top.cardId, position: top.position },
          after: null,
        },
        {
          table: "game_encounters",
          key: { id: encounter.id },
          before: null,
          after: { state: "DRAWN", encounter_card_id: top.cardId },
        },
      ],
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
