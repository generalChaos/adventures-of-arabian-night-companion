"use client";

import type { GameSnapshot } from "@/domain/game/types/game";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SULTAN_STATUS_ID = "33333333-3333-4333-8333-333333333304";
const BLESSED_STATUS_ID = "33333333-3333-4333-8333-333333333308";

type Props = {
  snapshot: GameSnapshot;
  pending: boolean;
  onDetermine: () => void;
  onChooseReaction: (reaction: string) => void;
  onGainStatus: (statusCardId: string) => void;
  onChangeWealth: (direction: "UP" | "DOWN") => void;
  onAdjustPoints: (storyDelta: number, destinyDelta: number) => void;
  onRollDestiny: () => void;
  onAssignReader: (readerPlayerId: string) => void;
  onCancel: () => void;
  onComplete: () => void;
};

export function EncounterPanel({
  snapshot,
  pending,
  onDetermine,
  onChooseReaction,
  onGainStatus,
  onChangeWealth,
  onAdjustPoints,
  onRollDestiny,
  onAssignReader,
  onCancel,
  onComplete,
}: Props) {
  const encounter = snapshot.activeEncounter;
  if (!encounter) return null;

  const isActor = snapshot.me?.id === encounter.playerId;
  const isReader = snapshot.me?.id === encounter.readerPlayerId;
  const actor = snapshot.players.find((p) => p.id === encounter.playerId);
  const reader = snapshot.players.find((p) => p.id === encounter.readerPlayerId);
  const canApply =
    isReader || isActor || snapshot.me?.role === "HOST";

  return (
    <section
      data-testid="encounter-panel"
      className="rounded-lg border border-[#c9a978] bg-[#fffdf6] p-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-medium">Encounter</h2>
        <Badge variant="secondary">{encounter.state}</Badge>
      </div>

      <p className="text-sm text-[#5c4c35]">
        {actor?.displayName ?? "Player"}
        {encounter.cardTitle
          ? ` drew #${encounter.cardNumber ?? "?"} ${encounter.cardTitle}`
          : " drew a card"}
        {reader ? ` · Reader: ${reader.displayName}` : null}
      </p>

      {snapshot.me?.role === "HOST" ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs">
            <span>Reader</span>
            <select
              className="block rounded border px-2 py-1 text-sm"
              data-testid="assign-reader"
              value={encounter.readerPlayerId ?? ""}
              disabled={pending}
              onChange={(e) => {
                if (e.target.value) onAssignReader(e.target.value);
              }}
            >
              {snapshot.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            data-testid="cancel-encounter"
            onClick={onCancel}
          >
            Cancel encounter
          </Button>
        </div>
      ) : null}

      {!encounter.contentDigitized ? (
        <div
          className="mt-3 rounded border border-amber-700/40 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="missing-content"
        >
          <p className="font-medium">Not digitized</p>
          <p className="mt-1 text-xs">
            Use the physical Book of Tales for this card. You can still roll,
            choose a reaction, and apply results manually.
          </p>
        </div>
      ) : null}

      {encounter.state === "DRAWN" && isActor ? (
        <Button
          className="mt-3"
          disabled={pending}
          data-testid="determine-encounter"
          onClick={onDetermine}
        >
          Roll & determine
        </Button>
      ) : null}

      {encounter.state === "DETERMINED" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            Roll {encounter.dieRoll} → {encounter.descriptor}
          </p>
          {isActor ? (
            <div className="flex flex-wrap gap-2">
              {snapshot.availableReactions.map((reaction) => (
                <Button
                  key={reaction}
                  size="sm"
                  disabled={pending}
                  data-testid={`reaction-${reaction}`}
                  onClick={() => onChooseReaction(reaction)}
                >
                  {reaction}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#5c4c35]">Waiting for reaction…</p>
          )}
        </div>
      ) : null}

      {encounter.state === "REACTION_CHOSEN" || encounter.state === "RESOLVING" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            Reaction: <strong>{encounter.chosenReaction}</strong>
          </p>
          {encounter.paragraphNumber != null ? (
            <p className="text-lg font-medium" data-testid="paragraph-number">
              Read paragraph {encounter.paragraphNumber}
            </p>
          ) : (
            <p className="text-sm text-red-700">Paragraph hidden (unexpected)</p>
          )}
          {canApply ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#5c4c35]">Apply results</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  data-testid="gain-sultan"
                  onClick={() => onGainStatus(SULTAN_STATUS_ID)}
                >
                  + Sultan
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  data-testid="gain-blessed"
                  onClick={() => onGainStatus(BLESSED_STATUS_ID)}
                >
                  + Blessed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  data-testid="result-wealth-up"
                  onClick={() => onChangeWealth("UP")}
                >
                  Wealth +
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  data-testid="result-wealth-down"
                  onClick={() => onChangeWealth("DOWN")}
                >
                  Wealth −
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  data-testid="result-story-up"
                  onClick={() => onAdjustPoints(1, 0)}
                >
                  Story +1
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  data-testid="result-destiny-up"
                  onClick={() => onAdjustPoints(0, 1)}
                >
                  Destiny +1
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  data-testid="roll-destiny"
                  onClick={onRollDestiny}
                >
                  Destiny die
                </Button>
              </div>
              {snapshot.lastDestinyRoll != null ? (
                <p className="text-sm" data-testid="destiny-roll-result">
                  Destiny die: {snapshot.lastDestinyRoll}
                </p>
              ) : null}
              <Button
                size="sm"
                disabled={pending}
                data-testid="complete-encounter"
                onClick={onComplete}
              >
                Complete encounter
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export { SULTAN_STATUS_ID, BLESSED_STATUS_ID };
