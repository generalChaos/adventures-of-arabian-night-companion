import { describe, expect, it } from "vitest";
import {
  assertActionUndoable,
  invertChanges,
  secureShuffle,
} from "@/domain/game/rules/undo";
import { DomainError } from "@/domain/game/types/errors";

describe("undo rules", () => {
  it("inverts changes in reverse order", () => {
    const inverted = invertChanges([
      {
        table: "player_state",
        key: { game_player_id: "p1" },
        before: { current_location_id: "a" },
        after: { current_location_id: "b" },
      },
    ]);
    expect(inverted[0]?.before).toEqual({ current_location_id: "b" });
    expect(inverted[0]?.after).toEqual({ current_location_id: "a" });
  });

  it("rejects rolls and irreversible actions", () => {
    expect(() =>
      assertActionUndoable({
        reversible: true,
        actionType: "ROLL_DICE",
        alreadyReverted: false,
      }),
    ).toThrow(DomainError);

    expect(() =>
      assertActionUndoable({
        reversible: false,
        actionType: "ROLL_DESTINY_DIE",
        alreadyReverted: false,
      }),
    ).toThrow(DomainError);

    expect(() =>
      assertActionUndoable({
        reversible: false,
        actionType: "CREATE_GAME",
        alreadyReverted: false,
      }),
    ).toThrow(DomainError);
  });

  it("shuffles without losing items", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const shuffled = secureShuffle(input);
    expect(shuffled.sort()).toEqual(input);
    expect(shuffled).toHaveLength(input.length);
  });
});
