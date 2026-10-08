import { describe, expect, it } from "vitest";
import { assertExpectedVersion } from "@/domain/game/rules/concurrency";
import { DomainError } from "@/domain/game/types/errors";

describe("assertExpectedVersion", () => {
  it("passes when versions match", () => {
    expect(() => assertExpectedVersion(52, 52)).not.toThrow();
  });

  it("throws STATE_CONFLICT when versions differ", () => {
    try {
      assertExpectedVersion(53, 52);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("STATE_CONFLICT");
      expect((error as DomainError).status).toBe(409);
    }
  });
});
