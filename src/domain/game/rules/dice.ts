/** Cryptographically secure inclusive integer roll. */
export function rollDie(sides: number): number {
  if (sides < 2) throw new Error("Die must have at least 2 sides");
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0]! % sides) + 1;
}
