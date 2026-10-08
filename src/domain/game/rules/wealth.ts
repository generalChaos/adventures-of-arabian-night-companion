export type WealthLevelRow = {
  id: string;
  ordinal: number;
  name: string;
  landMovement: number;
  seaMovement: number;
};

/** Step one ordinal up or down within the ordered wealth ladder. */
export function stepWealthLevel(
  levels: WealthLevelRow[],
  currentId: string | null,
  direction: "UP" | "DOWN",
): WealthLevelRow {
  const ordered = [...levels].sort((a, b) => a.ordinal - b.ordinal);
  if (ordered.length === 0) {
    throw new Error("No wealth levels configured");
  }
  const currentIndex = currentId
    ? ordered.findIndex((l) => l.id === currentId)
    : ordered.findIndex((l) => l.name === "Poor");
  const index = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex =
    direction === "UP"
      ? Math.min(index + 1, ordered.length - 1)
      : Math.max(index - 1, 0);
  return ordered[nextIndex]!;
}

export function defaultStartWealth(levels: WealthLevelRow[]): WealthLevelRow {
  const poor = levels.find((l) => l.name === "Poor");
  if (poor) return poor;
  const ordered = [...levels].sort((a, b) => a.ordinal - b.ordinal);
  if (!ordered[0]) throw new Error("No wealth levels configured");
  return ordered[0];
}
