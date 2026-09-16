/**
 * Dash removal for AI-written text: the one implementation used by the reading
 * generate route, Save Draft, both daily-message paths, and the audit's
 * stray-dash check, so the character set can't drift between them.
 *
 * The style guide bans dashes as punctuation. The model still writes them, so
 * every dash is replaced with the punctuation a person would have used, and
 * the result must read as ordinary prose: no stray commas, collapsed paragraph
 * breaks or double spaces left behind by the replacement itself.
 */

/**
 * Every character treated as a dash, by code point. Built from numbers rather
 * than written out so that look-alikes can't be confused in review:
 *
 *   U+2012 figure dash          U+2013 en dash          U+2014 em dash
 *   U+2015 horizontal bar       U+2212 minus sign       U+2E3A two-em dash
 *   U+2E3B three-em dash        U+FE58 small em dash    U+FE63 small hyphen-minus
 *   U+FF0D fullwidth hyphen-minus
 *
 * Real hyphens are deliberately absent: U+2010 HYPHEN, U+2011 NON-BREAKING
 * HYPHEN and a single ASCII hyphen-minus ("self-worth", "March-May") are left
 * alone. Two or more ASCII hyphens in a row ("--") do count as a dash.
 */
const DASH_CODE_POINTS = [0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0x2e3a, 0x2e3b, 0xfe58, 0xfe63, 0xff0d]

const DASH_CLASS = `[${String.fromCharCode(...DASH_CODE_POINTS)}]`

/** Regex source matching a single dash. Build a fresh RegExp from it per use. */
export const DASH_PATTERN = `(?:${DASH_CLASS}|-{2,})`

/** Adjacent dashes, with or without spaces between them, are removed as one. */
const DASH_RUN = `${DASH_PATTERN}(?:[ \\t]*${DASH_PATTERN})*`

/** Horizontal whitespace only, so a replacement never swallows a line break. */
const SPACE = '[ \\t\\u00A0]*'

const DIVIDER_SENTINEL = String.fromCharCode(0)

// A line that is nothing but dashes, e.g. a "---" divider.
const DIVIDER_LINE_RE = new RegExp(`(^|\\n)${SPACE}${DASH_RUN}${SPACE}(?=\\n|$)`, 'g')
const DIVIDER_GAP_RE = new RegExp(`\\n*(?:${DIVIDER_SENTINEL}\\n*)+`, 'g')
// Between two digits: a range ("3–6 months").
const RANGE_RE = new RegExp(`(\\d)${SPACE}${DASH_RUN}${SPACE}(?=\\d)`, 'g')
// Opening a line or the text.
const LINE_START_RE = new RegExp(`(^|\\n)${SPACE}${DASH_RUN}${SPACE}(\\S?)`, 'g')
// Closing a line or the text.
const LINE_END_RE = new RegExp(`${SPACE}${DASH_RUN}${SPACE}(?=\\n|$)`, 'g')
// Directly before closing punctuation, a closing bracket or a closing quote. A
// straight quote only counts as closing when nothing but a space, punctuation or
// the end follows it; before a word it is opening a quote (said—"no").
const BEFORE_CLOSER_RE = new RegExp(
  `${SPACE}${DASH_RUN}${SPACE}(?=[,.;:!?)\\]}\\u201D\\u2019\\u2026]|"(?=[\\s,.;:!?)\\]]|$))`,
  'g'
)
// Directly after clause or sentence punctuation.
const AFTER_PUNCTUATION_RE = new RegExp(`([,.;:!?\\u2026])${SPACE}${DASH_RUN}${SPACE}`, 'g')
// Directly after an opening bracket or curly opening quote. The straight quote
// is left out: it closes as often as it opens, and a closing one is handled
// correctly by the mid-sentence rule.
const AFTER_OPENER_RE = new RegExp(`([(\\[{\\u201C\\u2018])${SPACE}${DASH_RUN}${SPACE}`, 'g')
// Anywhere else: mid-sentence, with or without spaces around it.
const MID_SENTENCE_RE = new RegExp(`${SPACE}${DASH_RUN}${SPACE}`, 'g')

/**
 * Replace every dash in `text` with clean punctuation. Idempotent: the output
 * contains no dashes, so a second pass changes nothing.
 *
 *   "at play—a hesitancy"       → "at play, a hesitancy"
 *   "at play — a hesitancy"     → "at play, a hesitancy"
 *   "Para.\n\n— and then"       → "Para.\n\nAnd then"
 *   "the next 3–6 months"       → "the next 3 to 6 months"
 *   "wait—."                    → "wait."
 *   "It ended.—Then"            → "It ended. Then"
 *   "A\n\n---\n\nB"             → "A\n\nB"
 */
export function stripDashes(text: string): string {
  return (
    text
      // Divider lines go entirely. Mark them first, then close the gap they
      // leave to a single paragraph break (or nothing at either end).
      .replace(DIVIDER_LINE_RE, `$1${DIVIDER_SENTINEL}`)
      .replace(DIVIDER_GAP_RE, (gap, offset: number, whole: string) =>
        offset === 0 || offset + gap.length === whole.length ? '' : '\n\n'
      )
      .replace(RANGE_RE, '$1 to ')
      .replace(LINE_START_RE, (_match, lineBreak: string, next: string) => lineBreak + next.toUpperCase())
      .replace(LINE_END_RE, '')
      .replace(BEFORE_CLOSER_RE, '')
      .replace(AFTER_PUNCTUATION_RE, '$1 ')
      .replace(AFTER_OPENER_RE, '$1')
      .replace(MID_SENTENCE_RE, ', ')
  )
}

/**
 * The add-on heading the prompt requires as "Oracle Card — [name]". Stripping
 * its dash leaves "Oracle Card, [name]"; restore it as "Oracle Card: [name]",
 * which the audit accepts and which avoids the dash rule. Horizontal whitespace
 * only, so a heading is never joined to the line below it.
 */
const ORACLE_HEADING_RE = /^Oracle Card(?:[ \t]*,[ \t]*|[ \t]+)(?=\S)/gm

/** stripDashes() for a tarot reading: also restores the Oracle Card heading. */
export function stripReadingDashes(text: string): string {
  return stripDashes(text).replace(ORACLE_HEADING_RE, 'Oracle Card: ')
}
