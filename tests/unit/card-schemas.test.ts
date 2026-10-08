import { describe, expect, it } from "vitest";
import { cardDraftSchema } from "@/domain/content/card-schemas";
import { StubCardImageExtractor } from "@/infrastructure/ai/openai/extractor";

describe("card draft schemas", () => {
  it("accepts encounter drafts", () => {
    const draft = cardDraftSchema.parse({
      cardType: "ENCOUNTER",
      cardNumber: 37,
      title: "Strange Merchant",
      notes: null,
    });
    expect(draft.title).toBe("Strange Merchant");
  });

  it("stub extractor returns a valid draft", async () => {
    const extractor = new StubCardImageExtractor();
    const result = await extractor.extract(
      { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" },
      "STATUS",
    );
    expect(result.draft.cardType).toBe("STATUS");
    expect(result.model).toBe("stub");
  });
});
