import { describe, expect, it } from "vitest";
import { defaultStartWealth, stepWealthLevel } from "@/domain/game/rules/wealth";

const levels = [
  { id: "d", ordinal: 0, name: "Destitute", landMovement: 1, seaMovement: 0 },
  { id: "p", ordinal: 1, name: "Poor", landMovement: 2, seaMovement: 0 },
  { id: "a", ordinal: 2, name: "Average", landMovement: 3, seaMovement: 1 },
];

describe("wealth ladder", () => {
  it("defaults start wealth to Poor", () => {
    expect(defaultStartWealth(levels).id).toBe("p");
  });

  it("steps up and down one ordinal", () => {
    expect(stepWealthLevel(levels, "p", "UP").id).toBe("a");
    expect(stepWealthLevel(levels, "p", "DOWN").id).toBe("d");
  });

  it("clamps at ends", () => {
    expect(stepWealthLevel(levels, "a", "UP").id).toBe("a");
    expect(stepWealthLevel(levels, "d", "DOWN").id).toBe("d");
  });
});
