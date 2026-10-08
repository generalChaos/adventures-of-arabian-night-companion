import { describe, expect, it } from "vitest";
import {
  assertValidGoalSplit,
  VICTORY_POINT_TOTAL,
} from "@/domain/game/rules/victory-goals";

describe("victory goals", () => {
  it("accepts a valid split of the total", () => {
    expect(() => assertValidGoalSplit(12, 8)).not.toThrow();
    expect(VICTORY_POINT_TOTAL).toBe(20);
  });

  it("rejects splits that do not sum to the total", () => {
    expect(() => assertValidGoalSplit(10, 5)).toThrow(/add up/);
  });
});
