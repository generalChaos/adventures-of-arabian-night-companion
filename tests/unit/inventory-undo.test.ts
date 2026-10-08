import { describe, expect, it } from "vitest";
import { invertChanges } from "@/domain/game/rules/undo";

describe("inventory undo changes", () => {
  it("inverts treasure gain to a delete", () => {
    const [inverted] = invertChanges([
      {
        table: "player_treasures",
        key: { id: "t1" },
        before: null,
        after: {
          game_player_id: "p1",
          treasure_card_id: "c1",
          state: "HELD",
        },
      },
    ]);
    expect(inverted?.before).toEqual({
      game_player_id: "p1",
      treasure_card_id: "c1",
      state: "HELD",
    });
    expect(inverted?.after).toBeNull();
  });

  it("inverts status lose to restore active", () => {
    const [inverted] = invertChanges([
      {
        table: "player_statuses",
        key: { id: "s1" },
        before: { active: true, removed_at: null },
        after: { active: false },
      },
    ]);
    expect(inverted?.after).toEqual({ active: true, removed_at: null });
    expect(inverted?.before).toEqual({ active: false });
  });

  it("inverts skill adjust mastery", () => {
    const [inverted] = invertChanges([
      {
        table: "player_skills",
        key: { id: "sk1" },
        before: {
          game_player_id: "p1",
          skill_id: "skill",
          mastery_level: 1,
        },
        after: {
          game_player_id: "p1",
          skill_id: "skill",
          mastery_level: 2,
        },
      },
    ]);
    expect(inverted?.after?.mastery_level).toBe(1);
    expect(inverted?.before?.mastery_level).toBe(2);
  });
});
