import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/database/drizzle";
import {
  cards,
  editionManifest,
  skills,
  wealthLevels,
} from "@/infrastructure/database/schema";

const DEFAULT_EDITION_ID = "11111111-1111-4111-8111-111111111111";

export type LibraryProgressRow = {
  key: string;
  label: string;
  current: number;
  target: number;
};

async function countCards(
  editionId: string,
  cardType: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(cards)
    .where(
      and(
        eq(cards.editionId, editionId),
        eq(cards.cardType, cardType),
        eq(cards.status, "PUBLISHED"),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function loadLibraryProgress(
  editionId = DEFAULT_EDITION_ID,
): Promise<{ rows: LibraryProgressRow[]; notes: string | null }> {
  const db = getDb();
  const [manifest] = await db
    .select()
    .from(editionManifest)
    .where(eq(editionManifest.editionId, editionId))
    .limit(1);

  const [enc, tre, que, sta] = await Promise.all([
    countCards(editionId, "ENCOUNTER"),
    countCards(editionId, "TREASURE"),
    countCards(editionId, "QUEST"),
    countCards(editionId, "STATUS"),
  ]);
  const [sk] = await db
    .select({ value: count() })
    .from(skills)
    .where(eq(skills.editionId, editionId));
  const [wl] = await db
    .select({ value: count() })
    .from(wealthLevels)
    .where(eq(wealthLevels.editionId, editionId));

  return {
    notes: manifest?.notes ?? null,
    rows: [
      {
        key: "encounter",
        label: "Encounter cards",
        current: enc,
        target: manifest?.encounterCards ?? 0,
      },
      {
        key: "treasure",
        label: "Treasure cards",
        current: tre,
        target: manifest?.treasureCards ?? 0,
      },
      {
        key: "quest",
        label: "Quest cards",
        current: que,
        target: manifest?.questCards ?? 0,
      },
      {
        key: "status",
        label: "Status cards",
        current: sta,
        target: manifest?.statusCards ?? 0,
      },
      {
        key: "skills",
        label: "Skills",
        current: Number(sk?.value ?? 0),
        target: manifest?.skills ?? 0,
      },
      {
        key: "wealth",
        label: "Wealth levels",
        current: Number(wl?.value ?? 0),
        target: manifest?.wealthLevels ?? 0,
      },
    ],
  };
}
