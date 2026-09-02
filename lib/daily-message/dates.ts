// The single source of truth for "today" throughout the daily-message
// feature. Deliberately pinned to Europe/London rather than either UTC or
// the runtime's own local time — the API routes run on Vercel (always UTC,
// regardless of the admin's timezone), while the calendar UI runs in the
// admin's browser. Using an explicit IANA zone is what keeps those two
// agreeing on what date "today" is; relying on each side's own "local" time
// would just reproduce the UTC-vs-browser mismatch this replaces (e.g.
// during the 00:00-01:00 BST window, when UTC and UK local disagree on the
// date). Nothing else in this feature should derive "today" independently —
// every date comparison should import this.
// `now` defaults to the current instant; accepting it explicitly is what
// makes the UTC/BST boundary case testable without waiting for the clock to
// actually be there.
export function todayDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const lookup: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of parts) lookup[part.type] = part.value

  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * Decides whether a just-completed generation should be written, given the
 * date's state re-read immediately beforehand. Used by both generate and
 * generate-batch right before their upsert, to avoid resurrecting a date
 * that was deleted or skipped while the (slow) OpenAI call was in flight.
 * `null`/`undefined` means no row exists yet for that date — the normal
 * case for a fresh generation — which is not a reason to skip the write.
 */
export function shouldSkipWrite(currentState: { deleted_at: string | null; skipped: boolean } | null | undefined): boolean {
  if (!currentState) return false
  return Boolean(currentState.deleted_at) || currentState.skipped === true
}
