import { TAROT_CARDS } from '@/data/tarot-cards'

/**
 * Deciding whether a reading "mentions" a card is the fiddliest part of the
 * audit, and a naive `text.includes(name)` is actively wrong here:
 *
 *  - Several Major Arcana are ordinary English words. "You'll find strength in
 *    this" is not a mention of Strength; "the death of that idea" is not Death.
 *  - The catalogue names minors with numerals ("6 of Cups") but models very
 *    often write them out ("Six of Cups"), so a literal match misses real
 *    mentions and reports false omissions.
 *  - "The Tower" and "tower" must not be treated alike, but "The Star" at the
 *    start of a sentence and mid-sentence must be.
 *
 * The approach: for cards whose name is unmistakable, match case-insensitively
 * on text normalised for numeral/word rank. For the ambiguous ones, require the
 * canonical capitalisation, which is how a real card reference is written and
 * how ordinary prose usage is not.
 */

/**
 * Cards whose names double as ordinary English words or phrases. These are only
 * counted as mentions when they appear with canonical capitalisation.
 *
 * "Wheel of Fortune", "The High Priestess", "The Hierophant", "The Magician"
 * and "The Hanged One" are deliberately absent: none of them occurs in normal
 * prose, so requiring capitalisation would only cause missed mentions.
 */
const AMBIGUOUS_CARD_NAMES = new Set([
  'Strength',
  'Justice',
  'Death',
  'Temperance',
  'Judgement',
  'The Fool',
  'The Empress',
  'The Emperor',
  'The Lovers',
  'The Chariot',
  'The Hermit',
  'The Devil',
  'The Tower',
  'The Star',
  'The Moon',
  'The Sun',
  'The World',
])

const RANK_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Lowercase, collapse whitespace, and rewrite spelled-out ranks as digits so
 * "Six of Cups" and "6 of Cups" compare equal. Only applied at a word boundary
 * followed by " of ", so it cannot mangle prose like "ten years".
 */
export function normaliseForCardMatch(text: string): string {
  let out = text.toLowerCase().replace(/\s+/g, ' ')
  for (const [word, digit] of Object.entries(RANK_WORDS)) {
    out = out.replace(new RegExp(`\\b${word}(?= of )`, 'g'), digit)
  }
  return out
}

/** Canonical key for comparing two card names for equality. */
export function cardKey(name: string): string {
  return normaliseForCardMatch(name.trim())
}

/**
 * Does `text` reference this specific card?
 *
 * Unambiguous cards match case-insensitively against rank-normalised text.
 * Ambiguous ones must appear with canonical capitalisation in the raw text.
 * Both are anchored on a leading word boundary so "Ace of Cups" is not found
 * inside some longer token.
 */
export function mentionsCard(text: string, cardName: string): boolean {
  const canonical = cardName.trim()
  if (!canonical) return false

  if (AMBIGUOUS_CARD_NAMES.has(canonical)) {
    return new RegExp(`\\b${escapeRegex(canonical)}\\b`).test(text)
  }

  const haystack = normaliseForCardMatch(text)
  const needle = normaliseForCardMatch(canonical)
  return new RegExp(`\\b${escapeRegex(needle)}\\b`).test(haystack)
}

/**
 * Every catalogue card the text refers to. Scanning the known 78 rather than
 * trying to parse card-shaped strings out of prose is what keeps this from
 * inventing cards that were never named.
 */
export function findMentionedCards(text: string): string[] {
  return TAROT_CARDS.filter((card) => mentionsCard(text, card.name)).map((c) => c.name)
}
