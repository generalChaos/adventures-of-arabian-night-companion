import type { CardDraft, RequestedCardType } from "@/domain/content/card-schemas";

export type ImageInput = {
  bytes: Uint8Array;
  mimeType: string;
  fileName?: string;
};

export type ExtractionResult = {
  draft: CardDraft;
  rawResponse: unknown;
  model: string;
  confidence?: Record<string, unknown>;
};

export interface CardImageExtractor {
  extract(
    image: ImageInput,
    requestedType: RequestedCardType,
  ): Promise<ExtractionResult>;
}
