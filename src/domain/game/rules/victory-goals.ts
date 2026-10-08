/** Pending rulebook verify — classic TotAN uses a fixed victory total. */
export const VICTORY_POINT_TOTAL = 20;

export function assertValidGoalSplit(
  storyGoal: number,
  destinyGoal: number,
  total = VICTORY_POINT_TOTAL,
): void {
  if (!Number.isInteger(storyGoal) || !Number.isInteger(destinyGoal)) {
    throw new Error("Goals must be whole numbers");
  }
  if (storyGoal < 0 || destinyGoal < 0) {
    throw new Error("Goals cannot be negative");
  }
  if (storyGoal + destinyGoal !== total) {
    throw new Error(`Story and Destiny must add up to ${total}`);
  }
}
