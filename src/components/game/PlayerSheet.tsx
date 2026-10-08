"use client";

import type { GameSnapshot } from "@/domain/game/types/game";
import { characterName } from "@/domain/game/rules/characters";
import { Button } from "@/components/ui/button";
import {
  adjustSkillAction,
  gainStatusAction,
  gainTreasureAction,
  loseStatusAction,
  loseTreasureAction,
} from "@/application/commands/actions";

type Props = {
  snapshot: GameSnapshot;
  playerId: string;
  canEdit: boolean;
  pending: boolean;
  onApplied: (snapshot: GameSnapshot) => void;
  onError: (message: string) => void;
};

export function PlayerSheet({
  snapshot,
  playerId,
  canEdit,
  pending,
  onApplied,
  onError,
}: Props) {
  const player = snapshot.players.find((p) => p.id === playerId);
  const state = snapshot.playerStates.find((s) => s.gamePlayerId === playerId);
  const loc = snapshot.locations.find((l) => l.id === state?.currentLocationId);
  const statuses = snapshot.statuses.filter((s) => s.gamePlayerId === playerId);
  const treasures = snapshot.treasures.filter((t) => t.gamePlayerId === playerId);
  const skills = snapshot.playerSkills.filter((s) => s.gamePlayerId === playerId);

  if (!player || !state) return null;

  async function run(
    action: () => Promise<
      | { ok: true; snapshot: GameSnapshot }
      | { ok: false; message: string }
    >,
  ) {
    const result = await action();
    if (!result.ok) {
      onError(result.message);
      return;
    }
    onApplied(result.snapshot);
  }

  return (
    <div className="space-y-3" data-testid="player-sheet">
      <div>
        <h2 className="font-medium">
          {player.displayName}
          {player.role === "HOST" ? " (Host)" : ""}
        </h2>
        <p className="text-xs text-[#5c4c35]">
          {characterName(player.characterId) ?? "No character"} ·{" "}
          {loc?.name ?? "No location"} · {state.wealthName ?? "—"}
        </p>
        <p className="text-xs text-[#5c4c35]">
          Story {state.storyPoints} · Destiny {state.destinyPoints}
          {state.landMovement != null
            ? ` · Move L${state.landMovement}/S${state.seaMovement ?? 0}`
            : ""}
        </p>
        {snapshot.me?.id === playerId && snapshot.mySecrets ? (
          <p className="text-xs text-emerald-800">
            Goals: Story {snapshot.mySecrets.storyGoal} / Destiny{" "}
            {snapshot.mySecrets.destinyGoal}
          </p>
        ) : null}
      </div>

      <section className="space-y-1">
        <h3 className="text-sm font-medium">Statuses</h3>
        {statuses.length === 0 ? (
          <p className="text-xs text-[#5c4c35]">None</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {statuses.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span>{s.title}</span>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid={`lose-status-${s.id}`}
                    onClick={() =>
                      void run(() =>
                        loseStatusAction({
                          gameId: snapshot.game.id,
                          statusInstanceId: s.id,
                          expectedVersion: snapshot.game.stateVersion,
                        }),
                      )
                    }
                  >
                    Lose
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {snapshot.statusCatalog.map((card) => (
              <Button
                key={card.id}
                size="sm"
                variant="secondary"
                disabled={pending}
                data-testid={`gain-status-${card.id}`}
                onClick={() =>
                  void run(() =>
                    gainStatusAction({
                      gameId: snapshot.game.id,
                      playerId,
                      statusCardId: card.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  )
                }
              >
                + {card.title}
              </Button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium">Treasures</h3>
        {treasures.length === 0 ? (
          <p className="text-xs text-[#5c4c35]">None</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {treasures.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>{t.title}</span>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid={`lose-treasure-${t.id}`}
                    onClick={() =>
                      void run(() =>
                        loseTreasureAction({
                          gameId: snapshot.game.id,
                          treasureInstanceId: t.id,
                          expectedVersion: snapshot.game.stateVersion,
                        }),
                      )
                    }
                  >
                    Lose
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {snapshot.treasureCatalog.map((card) => (
              <Button
                key={card.id}
                size="sm"
                variant="secondary"
                disabled={pending}
                data-testid={`gain-treasure-${card.id}`}
                onClick={() =>
                  void run(() =>
                    gainTreasureAction({
                      gameId: snapshot.game.id,
                      playerId,
                      treasureCardId: card.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  )
                }
              >
                + {card.title}
              </Button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium">Skills</h3>
        <ul className="space-y-1 text-sm">
          {snapshot.skillsCatalog.map((skill) => {
            const owned = skills.find((s) => s.skillId === skill.id);
            const level = owned?.masteryLevel ?? 0;
            return (
              <li
                key={skill.id}
                className="flex items-center justify-between gap-2"
              >
                <span>
                  {skill.name} · {level}
                </span>
                {canEdit ? (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || level <= 0}
                      onClick={() =>
                        void run(() =>
                          adjustSkillAction({
                            gameId: snapshot.game.id,
                            playerId,
                            skillId: skill.id,
                            delta: -1,
                            expectedVersion: snapshot.game.stateVersion,
                          }),
                        )
                      }
                    >
                      −
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || level >= 3}
                      onClick={() =>
                        void run(() =>
                          adjustSkillAction({
                            gameId: snapshot.game.id,
                            playerId,
                            skillId: skill.id,
                            delta: 1,
                            expectedVersion: snapshot.game.stateVersion,
                          }),
                        )
                      }
                    >
                      +
                    </Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
