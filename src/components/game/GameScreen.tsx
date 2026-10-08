"use client";

import { useState, useTransition } from "react";
import type { GameSnapshot } from "@/domain/game/types/game";
import { CHARACTER_OPTIONS, characterName } from "@/domain/game/rules/characters";
import { BoardViewport } from "@/components/board/BoardViewport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  movePlayerAction,
  startGameAction,
  undoAction,
  drawCardAction,
  recordDrawAction,
  determineEncounterAction,
  chooseReactionAction,
  gainStatusAction,
  completeEncounterAction,
  endTurnAction,
  pauseGameAction,
  resumeGameAction,
  selectCharacterAction,
  changeWealthAction,
  setVictoryGoalsAction,
  revealGoalsAction,
  adjustPointsAction,
  rollDestinyDieAction,
  assignReaderAction,
  cancelEncounterAction,
} from "@/application/commands/actions";
import { VICTORY_POINT_TOTAL } from "@/domain/game/rules/victory-goals";
import { useGameStore } from "./useGameStore";
import { EncounterPanel } from "./EncounterPanel";
import { AdjustPlayerDialog } from "./AdjustPlayerDialog";
import { PlayerSheet } from "./PlayerSheet";

export function GameScreen({ initial }: { initial: GameSnapshot }) {
  const { snapshot, setSnapshot, connection, presence, refresh } =
    useGameStore(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<{
    locationId: string;
    name: string;
  } | null>(null);
  const [adjustPlayerId, setAdjustPlayerId] = useState<string | null>(null);
  const [sheetPlayerId, setSheetPlayerId] = useState(
    initial.me?.id ?? initial.players[0]?.id ?? "",
  );
  const [storyGoal, setStoryGoal] = useState(
    String(initial.mySecrets?.storyGoal ?? Math.floor(VICTORY_POINT_TOTAL / 2)),
  );
  const [physicalCardNumber, setPhysicalCardNumber] = useState("1");

  const offline = connection === "offline";
  const turnPlayer = snapshot.players.find(
    (p) => p.id === snapshot.game.currentTurnPlayerId,
  );
  const isMyTurn =
    !!snapshot.me &&
    snapshot.game.status === "ACTIVE" &&
    snapshot.game.currentTurnPlayerId === snapshot.me.id;
  const inEncounter = Boolean(snapshot.activeEncounter);
  const actionsDisabled = pending || offline;

  function applyResult(result: Awaited<ReturnType<typeof startGameAction>>) {
    if (!result.ok) {
      setError(
        result.code === "STATE_CONFLICT"
          ? "The game changed before your action completed. We've refreshed the board."
          : result.message,
      );
      if (result.code === "STATE_CONFLICT") void refresh();
      return;
    }
    setSnapshot(result.snapshot);
  }

  function onSelectDestination(locationId: string) {
    if (inEncounter || offline) return;
    const loc = snapshot.locations.find((l) => l.id === locationId);
    if (!loc || !snapshot.me) return;
    setConfirmMove({ locationId, name: loc.name });
  }

  function confirm() {
    if (!confirmMove || !snapshot.me) return;
    const destinationId = confirmMove.locationId;
    setConfirmMove(null);
    setError(null);
    startTransition(async () => {
      applyResult(
        await movePlayerAction({
          gameId: snapshot.game.id,
          playerId: snapshot.me!.id,
          destinationId,
          expectedVersion: snapshot.game.stateVersion,
        }),
      );
    });
  }

  const takenCharacters = new Set(
    snapshot.players.map((p) => p.characterId).filter(Boolean),
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f0e4] text-[#2a2114]">
      {offline || connection === "reconnecting" ? (
        <div
          className="bg-[#5c3b1e] px-4 py-2 text-center text-sm text-[#f8efdc]"
          data-testid="connection-banner"
        >
          {offline
            ? "Connection lost. Actions are disabled until connection returns."
            : "Connection interrupted. Reconnecting…"}
          <Button
            size="sm"
            variant="secondary"
            className="ml-3"
            onClick={() => void refresh()}
          >
            Reconnect
          </Button>
        </div>
      ) : null}

      <header className="flex items-center justify-between border-b border-[#d6c4a3] px-4 py-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
            Tales of the Arabian Nights
          </h1>
          <p className="text-sm text-[#5c4c35]">
            Code {snapshot.game.joinCode} · v{snapshot.game.stateVersion}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{snapshot.game.status}</Badge>
          <Badge variant={connection === "connected" ? "default" : "outline"}>
            {connection}
          </Badge>
          {turnPlayer ? (
            <span className="text-sm">Turn: {turnPlayer.displayName}</span>
          ) : null}
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_300px]">
        <div className="flex min-h-[420px] flex-col gap-4">
          <BoardViewport
            locations={snapshot.locations}
            edges={snapshot.edges}
            players={snapshot.players}
            playerStates={snapshot.playerStates}
            selectedPlayerId={snapshot.me?.id ?? null}
            highlightAdjacent={isMyTurn && !inEncounter && !offline}
            onSelectDestination={
              isMyTurn && !inEncounter && !offline
                ? onSelectDestination
                : undefined
            }
          />
          {snapshot.activeEncounter ? (
            <EncounterPanel
              snapshot={snapshot}
              pending={actionsDisabled}
              onDetermine={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await determineEncounterAction({
                      gameId: snapshot.game.id,
                      encounterId: snapshot.activeEncounter!.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onChooseReaction={(reaction) => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await chooseReactionAction({
                      gameId: snapshot.game.id,
                      encounterId: snapshot.activeEncounter!.id,
                      reaction,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onGainStatus={(statusCardId) => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await gainStatusAction({
                      gameId: snapshot.game.id,
                      playerId: snapshot.activeEncounter!.playerId,
                      statusCardId,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onChangeWealth={(direction) => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await changeWealthAction({
                      gameId: snapshot.game.id,
                      playerId: snapshot.activeEncounter!.playerId,
                      direction,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onAdjustPoints={(storyDelta, destinyDelta) => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await adjustPointsAction({
                      gameId: snapshot.game.id,
                      playerId: snapshot.activeEncounter!.playerId,
                      storyDelta,
                      destinyDelta,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onRollDestiny={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await rollDestinyDieAction({
                      gameId: snapshot.game.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onAssignReader={(readerPlayerId) => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await assignReaderAction({
                      gameId: snapshot.game.id,
                      encounterId: snapshot.activeEncounter!.id,
                      readerPlayerId,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onCancel={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await cancelEncounterAction({
                      gameId: snapshot.game.id,
                      encounterId: snapshot.activeEncounter!.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              onComplete={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await completeEncounterAction({
                      gameId: snapshot.game.id,
                      encounterId: snapshot.activeEncounter!.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 rounded-lg border border-[#d6c4a3] bg-[#fff8ec] p-4">
          <div>
            <h2 className="mb-2 font-medium">Players</h2>
            <ul className="space-y-2 text-sm">
              {snapshot.players.map((p) => {
                const state = snapshot.playerStates.find(
                  (s) => s.gamePlayerId === p.id,
                );
                const loc = snapshot.locations.find(
                  (l) => l.id === state?.currentLocationId,
                );
                const statuses = snapshot.statuses.filter(
                  (s) => s.gamePlayerId === p.id,
                );
                const skills = snapshot.playerSkills.filter(
                  (s) => s.gamePlayerId === p.id,
                );
                const online = presence.some((e) => e.playerId === p.id);
                return (
                  <li key={p.id} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          online ? "bg-emerald-600" : "bg-zinc-400"
                        }`}
                        title={online ? "Connected" : "Offline"}
                      />
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: p.playerColor }}
                      />
                      <button
                        type="button"
                        className={`text-left ${
                          sheetPlayerId === p.id ? "font-medium underline" : ""
                        }`}
                        onClick={() => setSheetPlayerId(p.id)}
                      >
                        {p.displayName}
                        {p.role === "HOST" ? " (Host)" : ""}
                        {characterName(p.characterId)
                          ? ` · ${characterName(p.characterId)}`
                          : ""}
                        {loc ? ` · ${loc.name}` : ""}
                      </button>
                      {snapshot.me?.role === "HOST" &&
                      snapshot.game.status !== "LOBBY" ? (
                        <button
                          type="button"
                          className="ml-auto text-xs underline"
                          onClick={() => setAdjustPlayerId(p.id)}
                        >
                          Adjust
                        </button>
                      ) : null}
                    </span>
                    <span className="pl-7 text-xs text-[#5c4c35]">
                      {state?.wealthName ?? "—"} · Story {state?.storyPoints ?? 0} ·
                      Destiny {state?.destinyPoints ?? 0}
                    </span>
                    {skills.length > 0 ? (
                      <span className="pl-7 text-xs text-[#5c4c35]">
                        Skills:{" "}
                        {skills
                          .map((s) => `${s.skillName} ${s.masteryLevel}`)
                          .join(", ")}
                      </span>
                    ) : null}
                    {statuses.length > 0 ? (
                      <span className="pl-7 text-xs text-[#5c4c35]">
                        {statuses.map((s) => s.title).join(", ")}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {sheetPlayerId && snapshot.game.status !== "LOBBY" ? (
            <PlayerSheet
              snapshot={snapshot}
              playerId={sheetPlayerId}
              canEdit={
                !actionsDisabled &&
                (snapshot.me?.id === sheetPlayerId ||
                  snapshot.me?.role === "HOST")
              }
              pending={actionsDisabled}
              onApplied={(next) => {
                setError(null);
                setSnapshot(next);
              }}
              onError={setError}
            />
          ) : null}

          {snapshot.game.status === "LOBBY" && snapshot.me ? (
            <div className="space-y-2">
              <h2 className="font-medium">Choose character</h2>
              <div className="flex flex-wrap gap-2">
                {CHARACTER_OPTIONS.map((c) => {
                  const taken =
                    takenCharacters.has(c.id) &&
                    snapshot.me?.characterId !== c.id;
                  const selected = snapshot.me?.characterId === c.id;
                  return (
                    <Button
                      key={c.id}
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      disabled={taken || actionsDisabled}
                      data-testid={`character-${c.id}`}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          applyResult(
                            await selectCharacterAction({
                              gameId: snapshot.game.id,
                              characterId: c.id,
                              expectedVersion: snapshot.game.stateVersion,
                            }),
                          );
                        });
                      }}
                    >
                      {c.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {snapshot.me &&
          (snapshot.game.status === "LOBBY" ||
            snapshot.game.status === "ACTIVE") &&
          snapshot.revealedGoals.length === 0 ? (
            <div className="space-y-2" data-testid="victory-goals">
              <h2 className="font-medium">Victory goals (secret)</h2>
              <p className="text-xs text-[#5c4c35]">
                Split {VICTORY_POINT_TOTAL} between Story and Destiny. Only you
                can see your split.
              </p>
              <div className="flex items-end gap-2">
                <label className="space-y-1 text-sm">
                  <span>Story</span>
                  <input
                    type="number"
                    className="block w-20 rounded border px-2 py-1"
                    value={storyGoal}
                    min={0}
                    max={VICTORY_POINT_TOTAL}
                    data-testid="story-goal"
                    onChange={(e) => setStoryGoal(e.target.value)}
                  />
                </label>
                <span className="pb-2 text-sm text-[#5c4c35]">
                  Destiny {VICTORY_POINT_TOTAL - (Number(storyGoal) || 0)}
                </span>
                <Button
                  size="sm"
                  disabled={actionsDisabled}
                  data-testid="save-victory-goals"
                  onClick={() => {
                    const story = Number(storyGoal);
                    setError(null);
                    startTransition(async () => {
                      applyResult(
                        await setVictoryGoalsAction({
                          gameId: snapshot.game.id,
                          storyGoal: story,
                          destinyGoal: VICTORY_POINT_TOTAL - story,
                          expectedVersion: snapshot.game.stateVersion,
                        }),
                      );
                    });
                  }}
                >
                  {snapshot.mySecrets ? "Update goals" : "Save goals"}
                </Button>
              </div>
              {snapshot.mySecrets ? (
                <p className="text-xs text-emerald-800">
                  Saved: Story {snapshot.mySecrets.storyGoal} / Destiny{" "}
                  {snapshot.mySecrets.destinyGoal}
                </p>
              ) : null}
              <p className="text-xs text-[#5c4c35]">
                {
                  snapshot.players.filter((p) =>
                    snapshot.playersWithGoalsSet.includes(p.id),
                  ).length
                }
                /{snapshot.players.length} players have set goals
              </p>
            </div>
          ) : null}

          {snapshot.revealedGoals.length > 0 ? (
            <div className="space-y-1" data-testid="revealed-goals">
              <h2 className="font-medium">Revealed goals</h2>
              <ul className="text-sm text-[#5c4c35]">
                {snapshot.revealedGoals.map((g) => (
                  <li key={g.gamePlayerId}>
                    {g.displayName}: Story {g.storyGoal} / Destiny{" "}
                    {g.destinyGoal}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {snapshot.game.status === "LOBBY" && snapshot.me?.role === "HOST" ? (
            <Button
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await startGameAction({
                      gameId: snapshot.game.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
              disabled={actionsDisabled}
            >
              Start Game
            </Button>
          ) : null}

          {snapshot.me?.role === "HOST" &&
          snapshot.game.status === "ACTIVE" &&
          snapshot.revealedGoals.length === 0 ? (
            <Button
              variant="outline"
              disabled={actionsDisabled}
              data-testid="reveal-goals"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await revealGoalsAction({
                      gameId: snapshot.game.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
            >
              Reveal goals & end game
            </Button>
          ) : null}

          {isMyTurn && !inEncounter ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-[#5c4c35]">
                Your turn. Move, draw an encounter, or end turn.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionsDisabled}
                  data-testid="wealth-down"
                  onClick={() => {
                    if (!snapshot.me) return;
                    setError(null);
                    startTransition(async () => {
                      applyResult(
                        await changeWealthAction({
                          gameId: snapshot.game.id,
                          playerId: snapshot.me!.id,
                          direction: "DOWN",
                          expectedVersion: snapshot.game.stateVersion,
                        }),
                      );
                    });
                  }}
                >
                  Wealth −
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionsDisabled}
                  data-testid="wealth-up"
                  onClick={() => {
                    if (!snapshot.me) return;
                    setError(null);
                    startTransition(async () => {
                      applyResult(
                        await changeWealthAction({
                          gameId: snapshot.game.id,
                          playerId: snapshot.me!.id,
                          direction: "UP",
                          expectedVersion: snapshot.game.stateVersion,
                        }),
                      );
                    });
                  }}
                >
                  Wealth +
                </Button>
              </div>
              <Button
                variant="secondary"
                disabled={actionsDisabled}
                data-testid="draw-encounter"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    applyResult(
                      await drawCardAction({
                        gameId: snapshot.game.id,
                        expectedVersion: snapshot.game.stateVersion,
                      }),
                    );
                  });
                }}
              >
                Draw encounter card
              </Button>
              <div className="flex items-end gap-2">
                <label className="space-y-1 text-xs">
                  <span>Physical card #</span>
                  <input
                    type="number"
                    min={1}
                    className="block w-20 rounded border px-2 py-1 text-sm"
                    value={physicalCardNumber}
                    data-testid="physical-card-number"
                    onChange={(e) => setPhysicalCardNumber(e.target.value)}
                  />
                </label>
                <Button
                  variant="outline"
                  disabled={actionsDisabled}
                  data-testid="record-draw"
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      applyResult(
                        await recordDrawAction({
                          gameId: snapshot.game.id,
                          cardNumber: Number(physicalCardNumber),
                          expectedVersion: snapshot.game.stateVersion,
                        }),
                      );
                    });
                  }}
                >
                  Record draw
                </Button>
              </div>
              <Button
                variant="outline"
                disabled={actionsDisabled}
                data-testid="end-turn"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    applyResult(
                      await endTurnAction({
                        gameId: snapshot.game.id,
                        expectedVersion: snapshot.game.stateVersion,
                      }),
                    );
                  });
                }}
              >
                End turn
              </Button>
            </div>
          ) : null}

          {snapshot.me?.role === "HOST" && snapshot.game.status === "ACTIVE" ? (
            <Button
              variant="outline"
              disabled={actionsDisabled}
              data-testid="pause-game"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await pauseGameAction({
                      gameId: snapshot.game.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
            >
              Pause game
            </Button>
          ) : null}

          {snapshot.me?.role === "HOST" && snapshot.game.status === "PAUSED" ? (
            <Button
              disabled={actionsDisabled}
              data-testid="resume-game"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await resumeGameAction({
                      gameId: snapshot.game.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
            >
              Resume game
            </Button>
          ) : null}

          {snapshot.me?.role === "HOST" &&
          (snapshot.game.status === "ACTIVE" ||
            snapshot.game.status === "PAUSED") ? (
            <Button
              variant="outline"
              disabled={actionsDisabled}
              data-testid="undo-action"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  applyResult(
                    await undoAction({
                      gameId: snapshot.game.id,
                      expectedVersion: snapshot.game.stateVersion,
                    }),
                  );
                });
              }}
            >
              Undo last action
            </Button>
          ) : null}

          <div>
            <h2 className="mb-2 font-medium">History</h2>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-[#5c4c35]">
              {snapshot.recentActions.map((a) => (
                <li key={a.sequence}>
                  #{a.sequence} {a.actionType}
                  {a.payload.title ? ` · ${String(a.payload.title)}` : ""}
                  {a.payload.reaction ? ` · ${String(a.payload.reaction)}` : ""}
                  {a.payload.characterId
                    ? ` · ${characterName(String(a.payload.characterId))}`
                    : ""}
                  {a.payload.offRule ? " · off-rule move" : ""}
                  {a.payload.wealthName
                    ? ` · ${String(a.payload.wealthName)}`
                    : ""}
                </li>
              ))}
            </ul>
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </aside>
      </div>

      {confirmMove ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="mb-4">
              Move {snapshot.me?.displayName} to {confirmMove.name}?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmMove(null)}>
                Cancel
              </Button>
              <Button onClick={confirm} disabled={actionsDisabled}>
                Move
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustPlayerId ? (
        <AdjustPlayerDialog
          snapshot={snapshot}
          playerId={adjustPlayerId}
          pending={actionsDisabled}
          onClose={() => setAdjustPlayerId(null)}
          onApplied={setSnapshot}
          onError={setError}
        />
      ) : null}
    </div>
  );
}
