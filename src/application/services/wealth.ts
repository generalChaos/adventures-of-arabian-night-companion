import { eq } from "drizzle-orm";
import { wealthLevels } from "@/infrastructure/database/schema";
import { defaultStartWealth } from "@/domain/game/rules/wealth";

/** Accepts root db or a transaction handle from drizzle. */
type SelectClient = {
  select: () => {
    from: (table: typeof wealthLevels) => {
      where: (condition: ReturnType<typeof eq>) => Promise<
        {
          id: string;
          ordinal: number;
          name: string;
          landMovement: number;
          seaMovement: number;
        }[]
      >;
    };
  };
};

export async function resolveDefaultWealthLevelId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  editionId: string,
): Promise<string | null> {
  const rows = await (db as SelectClient)
    .select()
    .from(wealthLevels)
    .where(eq(wealthLevels.editionId, editionId));
  if (rows.length === 0) return null;
  return defaultStartWealth(
    rows.map((r) => ({
      id: r.id,
      ordinal: r.ordinal,
      name: r.name,
      landMovement: r.landMovement,
      seaMovement: r.seaMovement,
    })),
  ).id;
}
