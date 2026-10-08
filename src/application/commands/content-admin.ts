"use server";

import { createHash } from "node:crypto";
import { and, desc, eq, gte, ilike, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/infrastructure/database/drizzle";
import { cards, cardContent, contentImports } from "@/infrastructure/database/schema";
import { createServerSupabaseClient } from "@/infrastructure/database/supabase/server";
import { createCardImageExtractor } from "@/infrastructure/ai/openai/extractor";
import {
  cardDraftSchema,
  PROMPT_VERSION,
  type CardDraft,
  type RequestedCardType,
} from "@/domain/content/card-schemas";
import { DomainError } from "@/domain/game/types/errors";
import { requireAppAdmin } from "@/application/services/admin";
import { ensureAuthenticatedUser } from "@/application/services/auth";
import {
  loadLibraryProgress,
  type LibraryProgressRow,
} from "@/application/queries/library-progress";

const DEFAULT_EDITION_ID = "11111111-1111-4111-8111-111111111111";
const AI_IMPORT_HOURLY_LIMIT = Number(process.env.AI_IMPORT_HOURLY_LIMIT ?? 20);

export type ImportRow = {
  id: string;
  status: string;
  requestedType: string;
  imagePath: string;
  imageHash: string | null;
  parsedData: unknown;
  model: string | null;
  createdAt: Date;
  publishedCardId: string | null;
};

export type DuplicateCandidate = {
  cardId: string;
  title: string;
  cardType: string;
  cardNumber: number | null;
  reasons: Array<"NUMBER" | "TITLE" | "IMAGE_HASH">;
};

function toError(error: unknown): { ok: false; message: string } {
  if (error instanceof DomainError) return { ok: false, message: error.message };
  if (error instanceof z.ZodError) {
    return { ok: false, message: error.issues[0]?.message ?? "Invalid data" };
  }
  console.error(error);
  return { ok: false, message: "Unexpected error" };
}

export async function libraryProgressAction(): Promise<
  | { ok: true; rows: LibraryProgressRow[]; notes: string | null }
  | { ok: false; message: string }
> {
  try {
    await ensureAuthenticatedUser();
    await requireAppAdmin();
    const progress = await loadLibraryProgress();
    return { ok: true, ...progress };
  } catch (error) {
    return toError(error);
  }
}

export async function listImportsAction(): Promise<
  { ok: true; imports: ImportRow[] } | { ok: false; message: string }
> {
  try {
    await ensureAuthenticatedUser();
    await requireAppAdmin();
    const db = getDb();
    const rows = await db
      .select()
      .from(contentImports)
      .orderBy(desc(contentImports.createdAt))
      .limit(50);
    return {
      ok: true,
      imports: rows.map((r) => ({
        id: r.id,
        status: r.status,
        requestedType: r.requestedType,
        imagePath: r.imagePath,
        imageHash: r.imageHash,
        parsedData: r.parsedData,
        model: r.model,
        createdAt: r.createdAt,
        publishedCardId: r.publishedCardId,
      })),
    };
  } catch (error) {
    return toError(error);
  }
}

async function findDuplicateCandidates(
  editionId: string,
  draft: CardDraft,
  imageHash: string | null,
): Promise<DuplicateCandidate[]> {
  const db = getDb();
  const byId = new Map<string, DuplicateCandidate>();

  function add(
    card: {
      id: string;
      title: string;
      cardType: string;
      cardNumber: number | null;
    },
    reason: DuplicateCandidate["reasons"][number],
  ) {
    const existing = byId.get(card.id);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    byId.set(card.id, {
      cardId: card.id,
      title: card.title,
      cardType: card.cardType,
      cardNumber: card.cardNumber,
      reasons: [reason],
    });
  }

  if (draft.cardNumber != null) {
    const rows = await db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.editionId, editionId),
          eq(cards.cardType, draft.cardType),
          eq(cards.cardNumber, draft.cardNumber),
          eq(cards.status, "PUBLISHED"),
        ),
      );
    for (const row of rows) add(row, "NUMBER");
  }

  if (draft.title.trim()) {
    const rows = await db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.editionId, editionId),
          eq(cards.cardType, draft.cardType),
          ilike(cards.title, draft.title.trim()),
          eq(cards.status, "PUBLISHED"),
        ),
      );
    for (const row of rows) add(row, "TITLE");
  }

  if (imageHash) {
    const hashedImports = await db
      .select({
        publishedCardId: contentImports.publishedCardId,
      })
      .from(contentImports)
      .where(
        and(
          eq(contentImports.editionId, editionId),
          eq(contentImports.imageHash, imageHash),
          ne(contentImports.status, "REJECTED"),
        ),
      );
    const cardIds = hashedImports
      .map((r) => r.publishedCardId)
      .filter((id): id is string => Boolean(id));
    for (const cardId of cardIds) {
      const [card] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, cardId))
        .limit(1);
      if (card) add(card, "IMAGE_HASH");
    }
  }

  return [...byId.values()];
}

export async function checkDuplicatesAction(importId: string): Promise<
  | { ok: true; duplicates: DuplicateCandidate[] }
  | { ok: false; message: string }
> {
  try {
    await ensureAuthenticatedUser();
    await requireAppAdmin();
    const db = getDb();
    const [row] = await db
      .select()
      .from(contentImports)
      .where(eq(contentImports.id, importId))
      .limit(1);
    if (!row) throw new DomainError("NOT_FOUND", "Import not found");
    if (!row.parsedData) {
      throw new DomainError("INVALID_ACTION", "No draft to check");
    }
    const draft = cardDraftSchema.parse(row.parsedData);
    const duplicates = await findDuplicateCandidates(
      row.editionId,
      draft,
      row.imageHash,
    );
    return { ok: true, duplicates };
  } catch (error) {
    return toError(error);
  }
}

export async function uploadAndExtractAction(formData: FormData): Promise<
  { ok: true; importId: string } | { ok: false; message: string }
> {
  try {
    await ensureAuthenticatedUser();
    const { userId } = await requireAppAdmin();
    const file = formData.get("file");
    const requestedType = String(formData.get("requestedType") ?? "ENCOUNTER") as RequestedCardType;

    if (!(file instanceof File)) {
      throw new DomainError("INVALID_ACTION", "Image file required");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new DomainError("INVALID_ACTION", "Only JPEG, PNG, or WebP allowed");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new DomainError("INVALID_ACTION", "Max upload size is 10MB");
    }

    const db = getDb();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(contentImports)
      .where(
        and(
          eq(contentImports.createdBy, userId),
          gte(contentImports.createdAt, hourAgo),
        ),
      );
    if (Number(recent?.value ?? 0) >= AI_IMPORT_HOURLY_LIMIT) {
      throw new DomainError(
        "INVALID_ACTION",
        `AI import rate limit reached (${AI_IMPORT_HOURLY_LIMIT}/hour). Try again later.`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const imageHash = createHash("sha256").update(bytes).digest("hex");
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const supabase = await createServerSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from("card-images")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) {
      throw new DomainError("INVALID_ACTION", uploadError.message);
    }

    const [row] = await db
      .insert(contentImports)
      .values({
        editionId: DEFAULT_EDITION_ID,
        imagePath: path,
        imageHash,
        requestedType,
        status: "PROCESSING",
        createdBy: userId,
        promptVersion: PROMPT_VERSION,
      })
      .returning();

    if (!row) throw new DomainError("INVALID_ACTION", "Failed to create import");

    try {
      const extractor = createCardImageExtractor();
      const result = await extractor.extract(
        { bytes, mimeType: file.type, fileName: file.name },
        requestedType,
      );

      await db
        .update(contentImports)
        .set({
          status: "NEEDS_REVIEW",
          parsedData: result.draft,
          rawResponse: result.rawResponse as object,
          model: result.model,
          confidenceMetadata: result.confidence ?? {},
        })
        .where(eq(contentImports.id, row.id));
    } catch (extractError) {
      console.error(extractError);
      await db
        .update(contentImports)
        .set({
          status: "FAILED",
          rawResponse: {
            error: extractError instanceof Error ? extractError.message : "extract failed",
          },
        })
        .where(eq(contentImports.id, row.id));
      throw new DomainError(
        "INVALID_ACTION",
        "We couldn't reliably extract this card. Try again or enter manually.",
      );
    }

    return { ok: true, importId: row.id };
  } catch (error) {
    return toError(error);
  }
}

const reviewSchema = z.object({
  importId: z.string().uuid(),
  draft: cardDraftSchema,
});

export async function saveDraftAction(input: z.infer<typeof reviewSchema>) {
  try {
    await ensureAuthenticatedUser();
    const { userId } = await requireAppAdmin();
    const data = reviewSchema.parse(input);
    const db = getDb();
    await db
      .update(contentImports)
      .set({
        parsedData: data.draft,
        status: "NEEDS_REVIEW",
        reviewedBy: userId,
      })
      .where(eq(contentImports.id, data.importId));
    return { ok: true as const };
  } catch (error) {
    return toError(error);
  }
}

export async function rejectImportAction(importId: string) {
  try {
    await ensureAuthenticatedUser();
    const { userId } = await requireAppAdmin();
    const db = getDb();
    await db
      .update(contentImports)
      .set({
        status: "REJECTED",
        reviewedBy: userId,
        reviewedAt: new Date(),
      })
      .where(eq(contentImports.id, importId));
    return { ok: true as const };
  } catch (error) {
    return toError(error);
  }
}

const publishSchema = z.object({
  importId: z.string().uuid(),
  /** ask = return duplicates; keep = publish anyway; replace = overwrite card */
  onDuplicate: z.enum(["ask", "keep", "replace"]).default("ask"),
  replaceCardId: z.string().uuid().optional(),
});

export async function publishImportAction(
  input: string | z.infer<typeof publishSchema>,
): Promise<
  | { ok: true; cardId: string; replaced: boolean }
  | { ok: false; message: string; duplicates?: DuplicateCandidate[] }
> {
  try {
    await ensureAuthenticatedUser();
    const { userId } = await requireAppAdmin();
    const data =
      typeof input === "string"
        ? publishSchema.parse({ importId: input, onDuplicate: "ask" })
        : publishSchema.parse(input);
    const db = getDb();

    const [row] = await db
      .select()
      .from(contentImports)
      .where(eq(contentImports.id, data.importId))
      .limit(1);
    if (!row) throw new DomainError("NOT_FOUND", "Import not found");
    if (!row.parsedData) {
      throw new DomainError("INVALID_ACTION", "No draft to publish");
    }

    const draft = cardDraftSchema.parse(row.parsedData);
    const duplicates = await findDuplicateCandidates(
      row.editionId,
      draft,
      row.imageHash,
    );

    if (duplicates.length > 0 && data.onDuplicate === "ask") {
      return {
        ok: false,
        message: "Possible duplicates found. Choose Replace or Keep both.",
        duplicates,
      };
    }

    if (data.onDuplicate === "replace") {
      const targetId = data.replaceCardId ?? duplicates[0]?.cardId;
      if (!targetId) {
        throw new DomainError("INVALID_ACTION", "No card selected to replace");
      }
      const [existing] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, targetId))
        .limit(1);
      if (!existing || existing.editionId !== row.editionId) {
        throw new DomainError("NOT_FOUND", "Card to replace not found");
      }

      await db
        .update(cards)
        .set({
          cardType: draft.cardType,
          cardNumber: draft.cardNumber,
          title: draft.title,
          status: "PUBLISHED",
          updatedAt: new Date(),
        })
        .where(eq(cards.id, targetId));

      await db
        .insert(cardContent)
        .values({
          cardId: targetId,
          schemaVersion: 1,
          contentJson: draft,
        })
        .onConflictDoUpdate({
          target: cardContent.cardId,
          set: {
            schemaVersion: 1,
            contentJson: draft,
          },
        });

      await db
        .update(contentImports)
        .set({
          status: "APPROVED",
          reviewedBy: userId,
          reviewedAt: new Date(),
          publishedCardId: targetId,
        })
        .where(eq(contentImports.id, data.importId));

      return { ok: true, cardId: targetId, replaced: true };
    }

    const [card] = await db
      .insert(cards)
      .values({
        editionId: row.editionId,
        cardType: draft.cardType,
        cardNumber: draft.cardNumber,
        title: draft.title,
        status: "PUBLISHED",
      })
      .returning();

    if (!card) throw new DomainError("INVALID_ACTION", "Failed to publish card");

    await db.insert(cardContent).values({
      cardId: card.id,
      schemaVersion: 1,
      contentJson: draft,
    });

    await db
      .update(contentImports)
      .set({
        status: "APPROVED",
        reviewedBy: userId,
        reviewedAt: new Date(),
        publishedCardId: card.id,
      })
      .where(eq(contentImports.id, data.importId));

    return { ok: true, cardId: card.id, replaced: false };
  } catch (error) {
    return toError(error);
  }
}
