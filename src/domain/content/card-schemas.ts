import { z } from "zod";

export const encounterCardDraftSchema = z.object({
  cardType: z.literal("ENCOUNTER"),
  cardNumber: z.number().int().positive().nullable(),
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
});

export const statusCardDraftSchema = z.object({
  cardType: z.literal("STATUS"),
  cardNumber: z.number().int().positive().nullable(),
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
});

export const treasureCardDraftSchema = z.object({
  cardType: z.literal("TREASURE"),
  cardNumber: z.number().int().positive().nullable(),
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
});

export const questCardDraftSchema = z.object({
  cardType: z.literal("QUEST"),
  cardNumber: z.number().int().positive().nullable(),
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
});

export const cardDraftSchema = z.discriminatedUnion("cardType", [
  encounterCardDraftSchema,
  statusCardDraftSchema,
  treasureCardDraftSchema,
  questCardDraftSchema,
]);

export type CardDraft = z.infer<typeof cardDraftSchema>;
export type RequestedCardType = CardDraft["cardType"];

export const PROMPT_VERSION = "v1";
