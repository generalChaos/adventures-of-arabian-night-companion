"use client";

import { useState } from "react";
import type { GameSnapshot } from "@/domain/game/types/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCorrectionAction } from "@/application/commands/actions";

type Props = {
  snapshot: GameSnapshot;
  playerId: string;
  pending: boolean;
  onClose: () => void;
  onApplied: (snapshot: GameSnapshot) => void;
  onError: (message: string) => void;
};

export function AdjustPlayerDialog({
  snapshot,
  playerId,
  pending,
  onClose,
  onApplied,
  onError,
}: Props) {
  const player = snapshot.players.find((p) => p.id === playerId);
  const state = snapshot.playerStates.find((s) => s.gamePlayerId === playerId);
  const [locationId, setLocationId] = useState(state?.currentLocationId ?? "");
  const [storyPoints, setStoryPoints] = useState(String(state?.storyPoints ?? 0));
  const [destinyPoints, setDestinyPoints] = useState(
    String(state?.destinyPoints ?? 0),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!player || !state) return null;

  async function save() {
    setBusy(true);
    const result = await adminCorrectionAction({
      gameId: snapshot.game.id,
      playerId,
      locationId: locationId || undefined,
      storyPoints: Number(storyPoints),
      destinyPoints: Number(destinyPoints),
      note: note || undefined,
      expectedVersion: snapshot.game.stateVersion,
    });
    setBusy(false);
    if (!result.ok) {
      onError(result.message);
      return;
    }
    onApplied(result.snapshot);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h2 className="mb-3 text-lg font-medium">Adjust {player.displayName}</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="loc">Location</Label>
            <select
              id="loc"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {snapshot.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="story">Story</Label>
              <Input
                id="story"
                type="number"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="destiny">Destiny</Label>
              <Input
                id="destiny"
                type="number"
                value={destinyPoints}
                onChange={(e) => setDestinyPoints(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional reason"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy || pending}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || pending}>
            Save correction
          </Button>
        </div>
      </div>
    </div>
  );
}
