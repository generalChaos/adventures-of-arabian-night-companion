const COLORS = ["#c45c26", "#2f6f8f", "#3d7a4a", "#8b3a5c", "#6b5b2e", "#4a4a7a"];

export function colorForSeat(seat: number): string {
  return COLORS[seat % COLORS.length] ?? COLORS[0];
}
