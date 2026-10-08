export const CHARACTER_OPTIONS = [
  { id: "aladdin", name: "Aladdin" },
  { id: "ali_baba", name: "Ali Baba" },
  { id: "sinbad", name: "Sinbad" },
  { id: "scheherazade", name: "Scheherazade" },
  { id: "prince_of_persia", name: "Prince of Persia" },
  { id: "princess_of_persia", name: "Princess of Persia" },
] as const;

export type CharacterId = (typeof CHARACTER_OPTIONS)[number]["id"];

export function characterName(id: string | null | undefined): string | null {
  if (!id) return null;
  return CHARACTER_OPTIONS.find((c) => c.id === id)?.name ?? id;
}

export function isValidCharacterId(id: string): boolean {
  return CHARACTER_OPTIONS.some((c) => c.id === id);
}
