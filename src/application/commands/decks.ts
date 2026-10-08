import { and, asc, eq } from "drizzle-orm";
import { cards, gamePileCards, gamePiles } from "@/infrastructure/database/schema";
import { secureShuffle } from "@/domain/game/rules/undo";
import { DomainError } from "@/domain/game/types/errors";
import type { Db } from "@/infrastructure/database/drizzle";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const SHARED_PILES = [
  "ENCOUNTER_DECK",
  "ENCOUNTER_DISCARD",
  "TREASURE_DECK",
  "TREASURE_DISCARD",
  "QUEST_DECK",
  "STATUS_SUPPLY",
  "REMOVED",
] as const;

async function fillDeck(
  tx: Tx,
  pileId: string,
  editionId: string,
  cardType: string,
) {
  const deckCards = await tx
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.editionId, editionId), eq(cards.cardType, cardType)))
    .orderBy(asc(cards.cardNumber));

  const shuffled = secureShuffle(deckCards.map((c) => c.id));
  if (shuffled.length === 0) return;
  await tx.insert(gamePileCards).values(
    shuffled.map((cardId, index) => ({
      pileId,
      cardId,
      position: index,
    })),
  );
}

/** Create all shared piles and seed encounter/treasure/quest/status decks. */
export async function ensureGamePiles(
  tx: Tx,
  gameId: string,
  editionId: string,
) {
  const existing = await tx
    .select()
    .from(gamePiles)
    .where(and(eq(gamePiles.gameId, gameId), eq(gamePiles.pileType, "ENCOUNTER_DECK")))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const created = new Map<string, string>();
  for (const pileType of SHARED_PILES) {
    const [pile] = await tx
      .insert(gamePiles)
      .values({ gameId, pileType })
      .returning();
    if (!pile) throw new DomainError("INVALID_ACTION", `Failed to create ${pileType}`);
    created.set(pileType, pile.id);
  }

  const encounterId = created.get("ENCOUNTER_DECK")!;
  await fillDeck(tx, encounterId, editionId, "ENCOUNTER");
  await fillDeck(tx, created.get("TREASURE_DECK")!, editionId, "TREASURE");
  await fillDeck(tx, created.get("QUEST_DECK")!, editionId, "QUEST");
  await fillDeck(tx, created.get("STATUS_SUPPLY")!, editionId, "STATUS");

  return encounterId;
}

/** @deprecated use ensureGamePiles */
export async function ensureEncounterDeck(
  tx: Tx,
  gameId: string,
  editionId: string,
) {
  return ensureGamePiles(tx, gameId, editionId);
}
