/**
 * Normalizes email for storage and lookup: trim + lowercase.
 * Use when comparing or looking up by email to avoid case/whitespace duplicates.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
