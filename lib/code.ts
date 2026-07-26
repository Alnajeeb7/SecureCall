import { customAlphabet } from "nanoid";

// No 0/O or 1/I — codes get read aloud and typed under pressure.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRoomCode = customAlphabet(ALPHABET, 6);

export function formatCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
