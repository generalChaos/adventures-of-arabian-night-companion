import { describe, expect, it } from "vitest";
import { StubCardImageExtractor } from "@/infrastructure/ai/openai/extractor";

describe("StubCardImageExtractor", () => {
  it("returns a typed draft without calling OpenAI", async () => {
    const extractor = new StubCardImageExtractor();
    const result = await extractor.extract(
      { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" },
      "STATUS",
    );
    expect(result.model).toBe("stub");
    expect(result.draft.cardType).toBe("STATUS");
    expect(result.draft.title).toContain("STATUS");
    expect(result.rawResponse).toEqual({ stub: true });
  });
});
