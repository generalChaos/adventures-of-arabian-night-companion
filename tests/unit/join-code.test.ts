import { describe, expect, it } from "vitest";
import { generateJoinCode, normalizeJoinCode } from "@/domain/game/rules/join-code";

describe("join-code", () => {
  it("generates uppercase alphanumeric codes of the requested length", () => {
    const code = generateJoinCode(6);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z2-9]+$/);
  });

  it("normalizes user input", () => {
    expect(normalizeJoinCode(" q7k4pm ")).toBe("Q7K4PM");
  });
});
