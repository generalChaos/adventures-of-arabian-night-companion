export const DEFAULT_REACTIONS = ["AID", "ATTACK", "AVOID"] as const;

export type MatrixCellInput = {
  rowKey: string;
  reaction: string;
  paragraphNumber: number;
};

/**
 * Every (rowKey × reaction) pair must exist with a positive paragraph number.
 */
export function validateMatrixCompleteness(
  rowKeys: string[],
  reactions: readonly string[],
  cells: MatrixCellInput[],
  opts?: { minParagraph?: number; maxParagraph?: number },
): { ok: true } | { ok: false; message: string } {
  const min = opts?.minParagraph ?? 1;
  const max = opts?.maxParagraph ?? 9999;
  const map = new Map(
    cells.map((c) => [`${c.rowKey}::${c.reaction}`, c.paragraphNumber]),
  );

  for (const row of rowKeys) {
    for (const reaction of reactions) {
      const key = `${row}::${reaction}`;
      const para = map.get(key);
      if (para == null) {
        return { ok: false, message: `Missing cell: ${row} / ${reaction}` };
      }
      if (!Number.isInteger(para) || para < min || para > max) {
        return {
          ok: false,
          message: `Paragraph ${para} for ${row}/${reaction} out of range ${min}–${max}`,
        };
      }
    }
  }
  return { ok: true };
}
