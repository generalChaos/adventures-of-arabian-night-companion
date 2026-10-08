import { and, eq, inArray } from "drizzle-orm";
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
import type { RecordDrawCommand } from "@/domain/game/types/commands";
import type { StateChange } from "@/domain/game/types/game";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { nextSeatPlayerId } from "@/application/queries/next-seat";
import type { CommandContext, CommandResult } from "./types";

/**
 * Physical-deck mode: player enters the card number they drew.
 * Removes the card from the digital pile when present; otherwise still starts
 * the encounter (content may be missing — title falls back to number).
 */
export async function handleRecordDraw(
  ctx: CommandContext,
  command: RecordDrawCommand,
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

    const [card] = await tx
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.editionId, game.editionId),
          eq(cards.cardType, "ENCOUNTER"),
          eq(cards.cardNumber, command.cardNumber),
        ),
      )
      .limit(1);

    if (!card) {
      throw new DomainError(
        "INVALID_ACTION",
        `No encounter card #${command.cardNumber} in this edition. Enter manually later or digitize the card.`,
      );
    }

    const [pile] = await tx
      .select()
      .from(gamePiles)
      .where(
        and(
          eq(gamePiles.gameId, game.id),
          eq(gamePiles.pileType, "ENCOUNTER_DECK"),
        ),
      )
      .limit(1);

    let removedFromPile: { pileId: string; position: number } | null = null;
    if (pile) {
      const [inPile] = await tx
        .select()
        .from(gamePileCards)
        .where(
          and(
            eq(gamePileCards.pileId, pile.id),
            eq(gamePileCards.cardId, card.id),
          ),
        )
        .limit(1);
      if (inPile) {
        removedFromPile = { pileId: pile.id, position: inPile.position };
        await tx
          .delete(gamePileCards)
          .where(
            and(
              eq(gamePileCards.pileId, pile.id),
              eq(gamePileCards.cardId, card.id),
            ),
          );
      }
    }

    const [state] = await tx
      .select()
      .from(playerState)
      .where(eq(playerState.gamePlayerId, actor.id))
      .limit(1);

    const readerId = await nextSeatPlayerId(tx, game.id, actor.id);

    const [encounter] = await tx
      .insert(gameEncounters)
      .values({
        gameId: game.id,
        playerId: actor.id,
        locationId: state?.currentLocationId ?? null,
        encounterCardId: card.id,
        readerPlayerId: readerId,
        state: "DRAWN",
      })
      .returning();

    if (!encounter) {
      throw new DomainError("INVALID_ACTION", "Failed to start encounter");
    }

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({
        stateVersion: nextVersion,
        phase: "ENCOUNTER",
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    const changes: StateChange[] = [
      {
        table: "game_encounters",
        key: { id: encounter.id },
        before: null,
        after: { state: "DRAWN", encounter_card_id: card.id },
      },
    ];
    if (removedFromPile) {
      changes.unshift({
        table: "game_pile_cards",
        key: { pile_id: removedFromPile.pileId, card_id: card.id },
        before: {
          pile_id: removedFromPile.pileId,
          card_id: card.id,
          position: removedFromPile.position,
        },
        after: null,
      });
    }

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "RECORD_DRAW",
      payload: {
        cardId: card.id,
        cardNumber: card.cardNumber,
        title: card.title,
        encounterId: encounter.id,
        physical: true,
        removedFromPile: Boolean(removedFromPile),
      },
      changes,
      reversible: true,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
