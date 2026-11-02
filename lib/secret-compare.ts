import { timingSafeEqual } from 'crypto'

/**
 * Constant-time comparison of a caller-supplied secret against the expected one.
 * timingSafeEqual throws on length mismatch, so length is checked first — that
 * leaks only the length, not the contents.
 */
export function secretMatches(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
