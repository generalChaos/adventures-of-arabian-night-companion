import {
  cardDraftSchema,
  PROMPT_VERSION,
  type RequestedCardType,
} from "@/domain/content/card-schemas";
import type {
  CardImageExtractor,
  ExtractionResult,
  ImageInput,
} from "@/infrastructure/ai/card-image-extractor";

/**
 * OpenAI vision extractor using Chat Completions with JSON response format.
 * Falls back is not used here — callers should use StubCardImageExtractor when
 * OPENAI_API_KEY is missing.
 */
export class OpenAICardImageExtractor implements CardImageExtractor {
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly model = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
  ) {}

  async extract(
    image: ImageInput,
    requestedType: RequestedCardType,
  ): Promise<ExtractionResult> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const b64 = Buffer.from(image.bytes).toString("base64");
    const dataUrl = `data:${image.mimeType};base64,${b64}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `You extract structured data from Tales of the Arabian Nights card photos. ` +
              `Return JSON only with keys: cardType, cardNumber (number or null), title, notes (string or null). ` +
              `cardType must be "${requestedType}". Prompt version ${PROMPT_VERSION}.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract this ${requestedType} card.`,
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${text}`);
    }

    const raw = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = raw.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");

    const parsedJson = JSON.parse(content) as unknown;
    const draft = cardDraftSchema.parse({
      ...(parsedJson as object),
      cardType: requestedType,
    });

    return {
      draft,
      rawResponse: raw,
      model: this.model,
      confidence: { promptVersion: PROMPT_VERSION },
    };
  }
}

/** Deterministic stub for local/dev without an API key. */
export class StubCardImageExtractor implements CardImageExtractor {
  async extract(
    _image: ImageInput,
    requestedType: RequestedCardType,
  ): Promise<ExtractionResult> {
    const draft = cardDraftSchema.parse({
      cardType: requestedType,
      cardNumber: 99,
      title: `Stub ${requestedType} Card`,
      notes: "Generated without OpenAI (stub extractor)",
    });
    return {
      draft,
      rawResponse: { stub: true },
      model: "stub",
      confidence: { promptVersion: PROMPT_VERSION, stub: true },
    };
  }
}

export function createCardImageExtractor(): CardImageExtractor {
  if (process.env.OPENAI_API_KEY) return new OpenAICardImageExtractor();
  return new StubCardImageExtractor();
}
