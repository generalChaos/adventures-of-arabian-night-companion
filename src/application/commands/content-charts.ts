"use server";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/infrastructure/database/drizzle";
import {
  encounterChartEntries,
  reactionMatrices,
  reactionMatrixCells,
} from "@/infrastructure/database/schema";
import { DomainError } from "@/domain/game/types/errors";
import {
  DEFAULT_REACTIONS,
  validateMatrixCompleteness,
} from "@/domain/content/matrix-validation";
import { requireAppAdmin } from "@/application/services/admin";
import { ensureAuthenticatedUser } from "@/application/services/auth";

const DEFAULT_EDITION_ID = "11111111-1111-4111-8111-111111111111";

function toError(error: unknown): { ok: false; message: string } {
  if (error instanceof DomainError) return { ok: false, message: error.message };
  if (error instanceof z.ZodError) {
    return { ok: false, message: error.issues[0]?.message ?? "Invalid data" };
  }
  console.error(error);
  return { ok: false, message: "Unexpected error" };
}

export type MatrixSummary = {
  id: string;
  matrixNumber: number;
  cellCount: number;
};

export type ChartEntryRow = {
  id: string;
  encounterKey: string;
  rollMin: number;
  rollMax: number;
  descriptor: string;
  matrixId: string | null;
};

export async function listChartsAction(): Promise<
  | {
      ok: true;
      matrices: MatrixSummary[];
      chartEntries: ChartEntryRow[];
    }
  | { ok: false; message: string }
> {
  try {
    await ensureAuthenticatedUser();
    await requireAppAdmin();
    const db = getDb();

    const matrices = await db
      .select()
      .from(reactionMatrices)
      .where(eq(reactionMatrices.editionId, DEFAULT_EDITION_ID))
      .orderBy(asc(reactionMatrices.matrixNumber));

    const summaries: MatrixSummary[] = [];
    for (const m of matrices) {
      const cells = await db
        .select()
        .from(reactionMatrixCells)
        .where(eq(reactionMatrixCells.matrixId, m.id));
      summaries.push({
        id: m.id,
        matrixNumber: m.matrixNumber,
        cellCount: cells.length,
      });
    }

    const chartEntries = await db
      .select()
      .from(encounterChartEntries)
      .where(eq(encounterChartEntries.editionId, DEFAULT_EDITION_ID))
      .orderBy(asc(encounterChartEntries.rollMin));

    return {
      ok: true,
      matrices: summaries,
      chartEntries: chartEntries.map((e) => ({
        id: e.id,
        encounterKey: e.encounterKey,
        rollMin: e.rollMin,
        rollMax: e.rollMax,
        descriptor: e.descriptor,
        matrixId: e.matrixId,
      })),
    };
  } catch (error) {
    return toError(error);
  }
}

export async function listMatrixCellsAction(matrixId: string) {
  try {
    await ensureAuthenticatedUser();
    await requireAppAdmin();
    const db = getDb();
    const cells = await db
      .select()
      .from(reactionMatrixCells)
      .where(eq(reactionMatrixCells.matrixId, matrixId))
      .orderBy(asc(reactionMatrixCells.rowKey), asc(reactionMatrixCells.reaction));
    return {
      ok: true as const,
      cells: cells.map((c) => ({
        rowKey: c.rowKey,
        reaction: c.reaction,
        paragraphNumber: c.paragraphNumber,
      })),
    };
  } catch (error) {
    return toError(error);
  }
}

const upsertMatrixSchema = z.object({
  matrixNumber: z.number().int().positive(),
  rowKeys: z.array(z.string().min(1)).min(1),
  cells: z.array(
    z.object({
      rowKey: z.string().min(1),
      reaction: z.string().min(1),
      paragraphNumber: z.number().int(),
    }),
  ),
});

export async function upsertMatrixAction(
  input: z.infer<typeof upsertMatrixSchema>,
) {
  try {
    await ensureAuthenticatedUser();
    await requireAppAdmin();
    const data = upsertMatrixSchema.parse(input);

    const validation = validateMatrixCompleteness(
      data.rowKeys,
      DEFAULT_REACTIONS,
      data.cells,
    );
    if (!validation.ok) {
      throw new DomainError("INVALID_ACTION", validation.message);
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(reactionMatrices)
      .where(
        and(
          eq(reactionMatrices.editionId, DEFAULT_EDITION_ID),
          eq(reactionMatrices.matrixNumber, data.matrixNumber),
        ),
      )
      .limit(1);

    let matrixId = existing?.id;
    if (!matrixId) {
      const [created] = await db
        .insert(reactionMatrices)
        .values({
          editionId: DEFAULT_EDITION_ID,
          matrixNumber: data.matrixNumber,
        })
        .returning();
      matrixId = created?.id;
    }
    if (!matrixId) throw new DomainError("INVALID_ACTION", "Failed to save matrix");

    await db
      .delete(reactionMatrixCells)
      .where(eq(reactionMatrixCells.matrixId, matrixId));

    await db.insert(reactionMatrixCells).values(
      data.cells.map((c) => ({
        matrixId,
        rowKey: c.rowKey,
        reaction: c.reaction,
        paragraphNumber: c.paragraphNumber,
      })),
    );

    return { ok: true as const, matrixId };
  } catch (error) {
    return toError(error);
  }
}

const chartEntrySchema = z.object({
  encounterKey: z.string().min(1).max(64),
  rollMin: z.number().int().min(1).max(6),
  rollMax: z.number().int().min(1).max(6),
  descriptor: z.string().min(1).max(64),
  matrixId: z.string().uuid().nullable(),
});

export async function addChartEntryAction(
  input: z.infer<typeof chartEntrySchema>,
) {
  try {
    await ensureAuthenticatedUser();
    await requireAppAdmin();
    const data = chartEntrySchema.parse(input);
    if (data.rollMin > data.rollMax) {
      throw new DomainError("INVALID_ACTION", "rollMin must be ≤ rollMax");
    }

    const db = getDb();
    const [row] = await db
      .insert(encounterChartEntries)
      .values({
        editionId: DEFAULT_EDITION_ID,
        encounterKey: data.encounterKey,
        rollMin: data.rollMin,
        rollMax: data.rollMax,
        descriptor: data.descriptor,
        matrixId: data.matrixId,
      })
      .returning();

    return { ok: true as const, id: row!.id };
  } catch (error) {
    return toError(error);
  }
}
