import { and, eq } from "drizzle-orm";
import {
  gameActions,
  gamePlayers,
  games,
  playerSkills,
  skills,
} from "@/infrastructure/database/schema";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";
import type { AdjustSkillCommand } from "@/domain/game/types/commands";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import type { CommandContext, CommandResult } from "./types";

export async function handleAdjustSkill(
  ctx: CommandContext,
  command: AdjustSkillCommand,
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
      .where(
        and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, userId)),
      )
      .limit(1);
    if (!actor) throw new DomainError("FORBIDDEN", "Not a member of this game");

    const isSelf = actor.id === command.playerId;
    if (!isSelf && actor.role !== "HOST") {
      throw new DomainError("FORBIDDEN", "Can only adjust your own skills");
    }

    const [target] = await tx
      .select()
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.id, command.playerId), eq(gamePlayers.gameId, game.id)),
      )
      .limit(1);
    if (!target) throw new DomainError("NOT_FOUND", "Player not found");

    const [skill] = await tx
      .select()
      .from(skills)
      .where(
        and(eq(skills.id, command.skillId), eq(skills.editionId, game.editionId)),
      )
      .limit(1);
    if (!skill) throw new DomainError("NOT_FOUND", "Skill not found");

    const [existing] = await tx
      .select()
      .from(playerSkills)
      .where(
        and(
          eq(playerSkills.gamePlayerId, target.id),
          eq(playerSkills.skillId, skill.id),
        ),
      )
      .limit(1);

    const beforeLevel = existing?.masteryLevel ?? 0;
    const nextLevel = Math.max(0, Math.min(3, beforeLevel + command.delta));
    if (nextLevel === beforeLevel) {
      throw new DomainError("INVALID_ACTION", "Skill level unchanged");
    }

    let playerSkillId = existing?.id;
    if (!existing && nextLevel > 0) {
      const [row] = await tx
        .insert(playerSkills)
        .values({
          gamePlayerId: target.id,
          skillId: skill.id,
          masteryLevel: nextLevel,
          source: "manual",
        })
        .returning();
      playerSkillId = row?.id;
    } else if (existing && nextLevel === 0) {
      await tx.delete(playerSkills).where(eq(playerSkills.id, existing.id));
    } else if (existing) {
      await tx
        .update(playerSkills)
        .set({ masteryLevel: nextLevel })
        .where(eq(playerSkills.id, existing.id));
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
      actionType: "ADJUST_SKILL",
      payload: {
        playerId: target.id,
        skillId: skill.id,
        skillName: skill.name,
        beforeLevel,
        afterLevel: nextLevel,
      },
      changes: [
        {
          table: "player_skills",
          key: { id: playerSkillId ?? skill.id },
          before: existing
            ? {
                game_player_id: target.id,
                skill_id: skill.id,
                mastery_level: beforeLevel,
              }
            : null,
          after:
            nextLevel === 0
              ? null
              : {
                  game_player_id: target.id,
                  skill_id: skill.id,
                  mastery_level: nextLevel,
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
