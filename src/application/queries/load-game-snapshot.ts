import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "@/infrastructure/database/drizzle";
import {
  boardEdges,
  boardLocationLayout,
  cardContent,
  cards,
  encounterChartEntries,
  gameActions,
  gameEncounters,
  gamePlayers,
  games,
  locations,
  playerSecrets,
  playerSkills,
  playerState,
  playerStatuses,
  playerTreasures,
  reactionMatrixCells,
  skills,
  wealthLevels,
} from "@/infrastructure/database/schema";
import type { GameSnapshot } from "@/domain/game/types/game";
import type { GameId, UserId } from "@/domain/game/types/ids";
import { DomainError } from "@/domain/game/types/errors";

const ACTIVE_ENCOUNTER_STATES = ["DRAWN", "DETERMINED", "REACTION_CHOSEN", "RESOLVING"];

export async function loadGameSnapshot(
  db: Db,
  gameId: GameId,
  userId?: UserId,
): Promise<GameSnapshot> {
  const [gameRow] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!gameRow) throw new DomainError("NOT_FOUND", "Game not found");

  const players = await db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId))
    .orderBy(asc(gamePlayers.seat));

  const states = await db
    .select({
      player_state: playerState,
      wealth: wealthLevels,
    })
    .from(playerState)
    .innerJoin(gamePlayers, eq(playerState.gamePlayerId, gamePlayers.id))
    .leftJoin(wealthLevels, eq(playerState.wealthLevelId, wealthLevels.id))
    .where(eq(gamePlayers.gameId, gameId));

  const playerIds = players.map((p) => p.id);
  const secretRows =
    playerIds.length > 0
      ? await db
          .select()
          .from(playerSecrets)
          .where(inArray(playerSecrets.gamePlayerId, playerIds))
      : [];

  const skillsCatalog = await db
    .select()
    .from(skills)
    .where(eq(skills.editionId, gameRow.editionId))
    .orderBy(asc(skills.name));

  const playerSkillRows =
    playerIds.length > 0
      ? await db
          .select({
            id: playerSkills.id,
            gamePlayerId: playerSkills.gamePlayerId,
            skillId: playerSkills.skillId,
            masteryLevel: playerSkills.masteryLevel,
            skillName: skills.name,
          })
          .from(playerSkills)
          .innerJoin(skills, eq(playerSkills.skillId, skills.id))
          .where(inArray(playerSkills.gamePlayerId, playerIds))
      : [];

  const locationRows = await db
    .select({
      id: locations.id,
      slug: locations.slug,
      name: locations.name,
      spaceType: locations.spaceType,
      isPort: locations.isPort,
      x: boardLocationLayout.xNormalized,
      y: boardLocationLayout.yNormalized,
    })
    .from(locations)
    .innerJoin(boardLocationLayout, eq(locations.id, boardLocationLayout.locationId))
    .where(eq(locations.editionId, gameRow.editionId));

  const edgeRows = await db
    .select()
    .from(boardEdges)
    .where(eq(boardEdges.editionId, gameRow.editionId));

  const me = userId
    ? (players.find((p) => p.userId === userId) ?? null)
    : null;

  const [encounter] = await db
    .select()
    .from(gameEncounters)
    .where(
      and(
        eq(gameEncounters.gameId, gameId),
        inArray(gameEncounters.state, ACTIVE_ENCOUNTER_STATES),
      ),
    )
    .orderBy(desc(gameEncounters.startedAt))
    .limit(1);

  let cardTitle: string | null = null;
  let cardNumber: number | null = null;
  let contentDigitized = false;
  let descriptor: string | null = null;
  let availableReactions: string[] = [];

  if (encounter?.encounterCardId) {
    const [card] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, encounter.encounterCardId))
      .limit(1);
    cardTitle = card?.title ?? null;
    cardNumber = card?.cardNumber ?? null;
    const [content] = await db
      .select({ cardId: cardContent.cardId })
      .from(cardContent)
      .where(eq(cardContent.cardId, encounter.encounterCardId))
      .limit(1);
    contentDigitized = Boolean(content);
  }

  if (encounter?.encounterChartEntryId) {
    const [entry] = await db
      .select()
      .from(encounterChartEntries)
      .where(eq(encounterChartEntries.id, encounter.encounterChartEntryId))
      .limit(1);
    descriptor = entry?.descriptor ?? null;

    if (entry?.matrixId && encounter.state === "DETERMINED") {
      const cells = await db
        .select({ reaction: reactionMatrixCells.reaction })
        .from(reactionMatrixCells)
        .where(
          and(
            eq(reactionMatrixCells.matrixId, entry.matrixId),
            eq(reactionMatrixCells.rowKey, entry.descriptor),
          ),
        );
      availableReactions = cells.map((c) => c.reaction);
    }
  }

  const revealParagraph = ["REACTION_CHOSEN", "RESOLVING", "COMPLETE"].includes(
    encounter?.state ?? "",
  );

  const statusRows = await db
    .select({
      id: playerStatuses.id,
      gamePlayerId: playerStatuses.gamePlayerId,
      statusCardId: playerStatuses.statusCardId,
      active: playerStatuses.active,
      title: cards.title,
    })
    .from(playerStatuses)
    .innerJoin(cards, eq(playerStatuses.statusCardId, cards.id))
    .innerJoin(gamePlayers, eq(playerStatuses.gamePlayerId, gamePlayers.id))
    .where(and(eq(gamePlayers.gameId, gameId), eq(playerStatuses.active, true)));

  const treasureRows = await db
    .select({
      id: playerTreasures.id,
      gamePlayerId: playerTreasures.gamePlayerId,
      treasureCardId: playerTreasures.treasureCardId,
      state: playerTreasures.state,
      title: cards.title,
    })
    .from(playerTreasures)
    .innerJoin(cards, eq(playerTreasures.treasureCardId, cards.id))
    .innerJoin(gamePlayers, eq(playerTreasures.gamePlayerId, gamePlayers.id))
    .where(
      and(eq(gamePlayers.gameId, gameId), eq(playerTreasures.state, "HELD")),
    );

  const statusCatalog = await db
    .select({
      id: cards.id,
      title: cards.title,
      cardNumber: cards.cardNumber,
    })
    .from(cards)
    .where(
      and(
        eq(cards.editionId, gameRow.editionId),
        eq(cards.cardType, "STATUS"),
        eq(cards.status, "PUBLISHED"),
      ),
    )
    .orderBy(asc(cards.cardNumber));

  const treasureCatalog = await db
    .select({
      id: cards.id,
      title: cards.title,
      cardNumber: cards.cardNumber,
    })
    .from(cards)
    .where(
      and(
        eq(cards.editionId, gameRow.editionId),
        eq(cards.cardType, "TREASURE"),
        eq(cards.status, "PUBLISHED"),
      ),
    )
    .orderBy(asc(cards.cardNumber));

  const recent = await db
    .select({
      sequence: gameActions.sequence,
      actionType: gameActions.actionType,
      actorPlayerId: gameActions.actorPlayerId,
      payload: gameActions.payload,
    })
    .from(gameActions)
    .where(and(eq(gameActions.gameId, gameId), ne(gameActions.actionType, "")))
    .orderBy(desc(gameActions.sequence))
    .limit(12);

  return {
    game: {
      id: gameRow.id,
      editionId: gameRow.editionId,
      joinCode: gameRow.joinCode,
      status: gameRow.status as GameSnapshot["game"]["status"],
      currentTurnPlayerId: gameRow.currentTurnPlayerId,
      turnNumber: gameRow.turnNumber,
      phase: gameRow.phase,
      stateVersion: gameRow.stateVersion,
    },
    players: players.map((p) => ({
      id: p.id,
      gameId: p.gameId,
      userId: p.userId,
      role: p.role as GameSnapshot["players"][number]["role"],
      displayName: p.displayName,
      characterId: p.characterId,
      seat: p.seat,
      playerColor: p.playerColor,
    })),
    playerStates: states.map((s) => ({
      gamePlayerId: s.player_state.gamePlayerId,
      currentLocationId: s.player_state.currentLocationId,
      wealthLevelId: s.player_state.wealthLevelId,
      wealthName: s.wealth?.name ?? null,
      landMovement: s.wealth?.landMovement ?? null,
      seaMovement: s.wealth?.seaMovement ?? null,
      storyPoints: s.player_state.storyPoints,
      destinyPoints: s.player_state.destinyPoints,
    })),
    locations: locationRows.map((l) => ({
      id: l.id,
      slug: l.slug,
      name: l.name,
      spaceType: l.spaceType,
      isPort: l.isPort,
      x: Number(l.x),
      y: Number(l.y),
    })),
    edges: edgeRows.map((e) => ({
      id: e.id,
      fromLocationId: e.fromLocationId,
      toLocationId: e.toLocationId,
      connectionType: e.connectionType as "LAND" | "SEA",
    })),
    me: me
      ? {
          id: me.id,
          gameId: me.gameId,
          userId: me.userId,
          role: me.role as GameSnapshot["players"][number]["role"],
          displayName: me.displayName,
          characterId: me.characterId,
          seat: me.seat,
          playerColor: me.playerColor,
        }
      : null,
    mySecrets: (() => {
      if (!me) return null;
      const mine = secretRows.find((s) => s.gamePlayerId === me.id);
      if (!mine) return null;
      return {
        storyGoal: mine.storyGoal,
        destinyGoal: mine.destinyGoal,
        chosenAt: mine.chosenAt.toISOString(),
      };
    })(),
    revealedGoals: secretRows
      .filter((s) => s.revealedAt != null)
      .map((s) => {
        const p = players.find((pl) => pl.id === s.gamePlayerId);
        return {
          gamePlayerId: s.gamePlayerId,
          displayName: p?.displayName ?? "Player",
          storyGoal: s.storyGoal,
          destinyGoal: s.destinyGoal,
        };
      }),
    playersWithGoalsSet: secretRows.map((s) => s.gamePlayerId),
    activeEncounter: encounter
      ? {
          id: encounter.id,
          playerId: encounter.playerId,
          readerPlayerId: encounter.readerPlayerId,
          encounterCardId: encounter.encounterCardId,
          cardTitle,
          cardNumber,
          dieRoll: encounter.dieRoll,
          descriptor,
          chosenReaction: encounter.chosenReaction,
          paragraphNumber: revealParagraph ? encounter.paragraphNumber : null,
          state: encounter.state,
          contentDigitized,
        }
      : null,
    availableReactions,
    statuses: statusRows.map((s) => ({
      id: s.id,
      gamePlayerId: s.gamePlayerId,
      statusCardId: s.statusCardId,
      title: s.title,
      active: s.active,
    })),
    treasures: treasureRows.map((t) => ({
      id: t.id,
      gamePlayerId: t.gamePlayerId,
      treasureCardId: t.treasureCardId,
      title: t.title,
      state: t.state,
    })),
    statusCatalog,
    treasureCatalog,
    skillsCatalog: skillsCatalog.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
    })),
    playerSkills: playerSkillRows.map((s) => ({
      id: s.id,
      gamePlayerId: s.gamePlayerId,
      skillId: s.skillId,
      skillName: s.skillName,
      masteryLevel: s.masteryLevel,
    })),
    recentActions: recent.map((a) => ({
      sequence: a.sequence,
      actionType: a.actionType,
      actorPlayerId: a.actorPlayerId,
      payload: (a.payload ?? {}) as Record<string, unknown>,
    })),
    lastDestinyRoll: (() => {
      const roll = recent.find((a) => a.actionType === "ROLL_DESTINY_DIE");
      const payload = (roll?.payload ?? {}) as Record<string, unknown>;
      return typeof payload.result === "number" ? payload.result : null;
    })(),
  };
}

export async function findGameIdByJoinCode(db: Db, joinCode: string) {
  const [row] = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.joinCode, joinCode)))
    .limit(1);
  return row?.id ?? null;
}

/** Used by leak tests: paragraph must stay null until reaction chosen. */
export function publicParagraphNumber(
  state: string,
  paragraphNumber: number | null,
): number | null {
  if (["REACTION_CHOSEN", "RESOLVING", "COMPLETE"].includes(state)) {
    return paragraphNumber;
  }
  return null;
}
