import { describe, expect, it } from "vitest";
import { publicParagraphNumber } from "@/application/queries/load-game-snapshot";
import { rollDie } from "@/domain/game/rules/dice";

describe("hidden encounter information", () => {
  it("hides paragraph until reaction is chosen", () => {
    expect(publicParagraphNumber("DRAWN", 101)).toBeNull();
    expect(publicParagraphNumber("DETERMINED", 101)).toBeNull();
    expect(publicParagraphNumber("REACTION_CHOSEN", 101)).toBe(101);
    expect(publicParagraphNumber("RESOLVING", 102)).toBe(102);
    expect(publicParagraphNumber("COMPLETE", 103)).toBe(103);
  });

  it("rolls a d6 in range", () => {
    for (let i = 0; i < 40; i += 1) {
      const n = rollDie(6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});
