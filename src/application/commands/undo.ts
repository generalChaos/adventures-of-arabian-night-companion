import { and, desc, eq } from "drizzle-orm";
import {
  gameActions,
  gameEncounters,
  gamePileCards,
  gamePlayers,
  games,
  playerSkills,
  playerState,
  playerStatuses,
  playerTreasures,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { assertActionUndoable, invertChanges } from "@/domain/game/rules/undo";
import { DomainError } from "@/domain/game/types/errors";
import type { UndoCommand } from "@/domain/game/types/commands";
import type { StateChange } from "@/domain/game/types/game";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleUndo(
  ctx: CommandContext,
  command: UndoCommand,
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
      throw new DomainError("FORBIDDEN", "Only the host can undo");
    }

    const [latest] = await tx
      .select()
      .from(gameActions)
      .where(eq(gameActions.gameId, game.id))
      .orderBy(desc(gameActions.sequence))
      .limit(1);

    if (!latest) throw new DomainError("INVALID_ACTION", "Nothing to undo");

    const [already] = await tx
      .select()
      .from(gameActions)
      .where(eq(gameActions.revertsActionId, latest.id))
      .limit(1);

    assertActionUndoable({
      reversible: latest.reversible,
      actionType: latest.actionType,
      alreadyReverted: Boolean(already),
    });

    const changes = (latest.changes as StateChange[]) ?? [];
    const inverted = invertChanges(changes);

    for (const change of inverted) {
      if (change.table === "player_state" && change.after) {
        const after = change.after;
        const patch: {
          updatedAt: Date;
          currentLocationId?: string | null;
          wealthLevelId?: string | null;
          storyPoints?: number;
          destinyPoints?: number;
        } = { updatedAt: new Date() };
        if ("current_location_id" in after) {
          patch.currentLocationId =
            after.current_location_id == null
              ? null
              : String(after.current_location_id);
        }
        if ("wealth_level_id" in after) {
          patch.wealthLevelId =
            after.wealth_level_id == null
              ? null
              : String(after.wealth_level_id);
        }
        if ("story_points" in after) {
          patch.storyPoints = Number(after.story_points);
        }
        if ("destiny_points" in after) {
          patch.destinyPoints = Number(after.destiny_points);
        }
        await tx
          .update(playerState)
          .set(patch)
          .where(eq(playerState.gamePlayerId, change.key.game_player_id));
      }

      if (change.table === "game_pile_cards" && change.after == null && change.before) {
        await tx.insert(gamePileCards).values({
          pileId: String(change.before.pile_id),
          cardId: String(change.before.card_id),
          position: Number(change.before.position),
        });
      }
      if (change.table === "game_pile_cards" && change.before == null && change.after) {
        await tx
          .delete(gamePileCards)
          .where(
            and(
              eq(gamePileCards.pileId, String(change.after.pile_id)),
              eq(gamePileCards.cardId, String(change.after.card_id)),
            ),
          );
      }

      if (change.table === "player_skills") {
        if (change.after == null && change.before) {
          await tx.insert(playerSkills).values({
            gamePlayerId: String(change.before.game_player_id),
            skillId: String(change.before.skill_id),
            masteryLevel: Number(change.before.mastery_level),
            source: "manual",
          });
        } else if (change.before == null && change.after) {
          await tx
            .delete(playerSkills)
            .where(
              and(
                eq(playerSkills.gamePlayerId, String(change.after.game_player_id)),
                eq(playerSkills.skillId, String(change.after.skill_id)),
              ),
            );
        } else if (change.after && change.before) {
          await tx
            .update(playerSkills)
            .set({ masteryLevel: Number(change.after.mastery_level) })
            .where(
              and(
                eq(playerSkills.gamePlayerId, String(change.after.game_player_id)),
                eq(playerSkills.skillId, String(change.after.skill_id)),
              ),
            );
        }
      }

      if (change.table === "player_statuses" && change.after == null && change.before) {
        // Undoing a create → delete the row
        await tx.delete(playerStatuses).where(eq(playerStatuses.id, change.key.id));
      }
      if (change.table === "player_statuses" && change.before == null && change.after) {
        // Undoing a delete → restore the row
        await tx.insert(playerStatuses).values({
          id: change.key.id,
          gamePlayerId: String(change.after.game_player_id),
          statusCardId: String(change.after.status_card_id),
          active: true,
        });
      }
      if (
        change.table === "player_statuses" &&
        change.before &&
        change.after &&
        "active" in change.after
      ) {
        await tx
          .update(playerStatuses)
          .set({
            active: Boolean(change.after.active),
            removedAt: change.after.active ? null : new Date(),
          })
          .where(eq(playerStatuses.id, change.key.id));
      }

      if (change.table === "player_treasures" && change.after == null && change.before) {
        await tx.delete(playerTreasures).where(eq(playerTreasures.id, change.key.id));
      }
      if (change.table === "player_treasures" && change.before == null && change.after) {
        await tx.insert(playerTreasures).values({
          id: change.key.id,
          gamePlayerId: String(change.after.game_player_id),
          treasureCardId: String(change.after.treasure_card_id),
          state: String(change.after.state ?? "HELD"),
        });
      }
      if (
        change.table === "player_treasures" &&
        change.before &&
        change.after &&
        "state" in change.after
      ) {
        await tx
          .update(playerTreasures)
          .set({ state: String(change.after.state) })
          .where(eq(playerTreasures.id, change.key.id));
      }

      if (change.table === "game_encounters") {
        if (change.after == null && change.before == null) {
          // no-op
        } else if (change.after == null && change.before) {
          // recreate cancelled — not used
        } else if (change.before == null && change.after) {
          // undoing create → delete encounter
          await tx
            .delete(gameEncounters)
            .where(eq(gameEncounters.id, change.key.id));
        } else if (change.after) {
          const patch: {
            state?: string;
            dieRoll?: number | null;
            encounterChartEntryId?: string | null;
            chosenReaction?: string | null;
            paragraphNumber?: number | null;
            readerPlayerId?: string | null;
            completedAt?: Date | null;
          } = {};
          if ("state" in change.after) {
            patch.state = String(change.after.state);
            patch.completedAt =
              change.after.state === "COMPLETE" ||
              change.after.state === "CANCELLED"
                ? new Date()
                : null;
          }
          if ("die_roll" in change.after) {
            patch.dieRoll =
              change.after.die_roll == null
                ? null
                : Number(change.after.die_roll);
          }
          if ("encounter_chart_entry_id" in change.after) {
            patch.encounterChartEntryId =
              change.after.encounter_chart_entry_id == null
                ? null
                : String(change.after.encounter_chart_entry_id);
          }
          if ("chosen_reaction" in change.after) {
            patch.chosenReaction =
              change.after.chosen_reaction == null
                ? null
                : String(change.after.chosen_reaction);
          }
          if ("paragraph_number" in change.after) {
            patch.paragraphNumber =
              change.after.paragraph_number == null
                ? null
                : Number(change.after.paragraph_number);
          }
          if ("reader_player_id" in change.after) {
            patch.readerPlayerId =
              change.after.reader_player_id == null
                ? null
                : String(change.after.reader_player_id);
          }
          await tx
            .update(gameEncounters)
            .set(patch)
            .where(eq(gameEncounters.id, change.key.id));
        }
      }
    }

    const nextVersion = game.stateVersion + 1;
    await tx
      .update(games)
      .set({ stateVersion: nextVersion, updatedAt: new Date() })
      .where(eq(games.id, game.id));

    await tx.insert(gameActions).values({
      gameId: game.id,
      sequence: nextVersion,
      actorPlayerId: actor.id,
      actionType: "UNDO",
      payload: { revertsActionId: latest.id, actionType: latest.actionType },
      changes: inverted,
      reversible: false,
      revertsActionId: latest.id,
      previousStateVersion: game.stateVersion,
      resultingStateVersion: nextVersion,
    });
  });

  return { snapshot: await loadGameSnapshot(db, command.gameId, userId) };
}
