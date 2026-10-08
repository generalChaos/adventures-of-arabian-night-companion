import { describe, expect, it } from "vitest";
import {
  DEFAULT_REACTIONS,
  validateMatrixCompleteness,
} from "@/domain/content/matrix-validation";

describe("matrix validation", () => {
  it("accepts a complete matrix", () => {
    const cells = DEFAULT_REACTIONS.flatMap((reaction, i) => [
      { rowKey: "merchant", reaction, paragraphNumber: 100 + i },
    ]);
    expect(
      validateMatrixCompleteness(["merchant"], DEFAULT_REACTIONS, cells),
    ).toEqual({ ok: true });
  });

  it("rejects missing cells", () => {
    const result = validateMatrixCompleteness(
      ["merchant"],
      DEFAULT_REACTIONS,
      [{ rowKey: "merchant", reaction: "AID", paragraphNumber: 1 }],
    );
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range paragraphs", () => {
    const cells = DEFAULT_REACTIONS.map((reaction) => ({
      rowKey: "merchant",
      reaction,
      paragraphNumber: 0,
    }));
    const result = validateMatrixCompleteness(
      ["merchant"],
      DEFAULT_REACTIONS,
      cells,
    );
    expect(result.ok).toBe(false);
  });
});
