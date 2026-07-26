import { customAlphabet } from "nanoid";

// No 0/O or 1/I — codes get read aloud and typed under pressure.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRoomCode = customAlphabet(ALPHABET, 6);

export function formatCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

/**
 * Custom/vanity links (e.g. "family-sunday" instead of "K7P2QX").
 * The slug IS the PeerJS peer id, so it has to be URL-safe and short
 * enough to not look absurd in a shared link.
 */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MIN = 4;
const SLUG_MAX = 32;

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

export function isValidSlug(slug: string) {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug);
}

/** A room code is either a random 6-char code or a custom slug. */
export function isRoomCode(value: string) {
  return /^[A-Z0-9]{6}$/.test(value) || isValidSlug(value.toLowerCase());
}
