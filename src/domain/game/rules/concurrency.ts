import { DomainError } from "../types/errors";

export function assertExpectedVersion(
  current: number,
  expected: number,
): void {
  if (current !== expected) {
    throw new DomainError(
      "STATE_CONFLICT",
      "Game changed before your action completed",
    );
  }
}
