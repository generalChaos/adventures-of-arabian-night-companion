const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generates a short human-readable join code (no I/O/1/0). */
export function generateJoinCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}
