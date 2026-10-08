import type { StateChange } from "../types/game";
import { DomainError } from "../types/errors";

export function invertChanges(changes: StateChange[]): StateChange[] {
  return [...changes].reverse().map((change) => ({
    table: change.table,
    key: change.key,
    before: change.after,
    after: change.before,
  }));
}

export function assertActionUndoable(opts: {
  reversible: boolean;
  actionType: string;
  alreadyReverted: boolean;
}): void {
  if (opts.alreadyReverted) {
    throw new DomainError("INVALID_ACTION", "Action was already undone");
  }
  if (!opts.reversible) {
    throw new DomainError("INVALID_ACTION", "Action is not reversible");
  }
  if (
    opts.actionType === "ROLL_DICE" ||
    opts.actionType === "ROLL_DESTINY_DIE"
  ) {
    throw new DomainError("INVALID_ACTION", "Dice rolls cannot be undone");
  }
}

/** Fisher–Yates shuffle using crypto-secure randomness. */
export function secureShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const j = bytes[0]! % (i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
