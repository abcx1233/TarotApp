import type { TarotCard, CardOrientation } from '@/types'

export const TAROT_CARDS: TarotCard[] = [
  // ─── Major Arcana ─────────────────────────────────────────────────────────
  { name: 'The Fool', suit: 'Major Arcana', order: 0 },
  { name: 'The Magician', suit: 'Major Arcana', order: 1 },
  { name: 'The High Priestess', suit: 'Major Arcana', order: 2 },
  { name: 'The Empress', suit: 'Major Arcana', order: 3 },
  { name: 'The Emperor', suit: 'Major Arcana', order: 4 },
  { name: 'The Hierophant', suit: 'Major Arcana', order: 5 },
  { name: 'The Lovers', suit: 'Major Arcana', order: 6 },
  { name: 'The Chariot', suit: 'Major Arcana', order: 7 },
  { name: 'Strength', suit: 'Major Arcana', order: 8 },
  { name: 'The Hermit', suit: 'Major Arcana', order: 9 },
  { name: 'Wheel of Fortune', suit: 'Major Arcana', order: 10 },
  { name: 'Justice', suit: 'Major Arcana', order: 11 },
  { name: 'The Hanged One', suit: 'Major Arcana', order: 12 },
  { name: 'Death', suit: 'Major Arcana', order: 13 },
  { name: 'Temperance', suit: 'Major Arcana', order: 14 },
  { name: 'The Devil', suit: 'Major Arcana', order: 15 },
  { name: 'The Tower', suit: 'Major Arcana', order: 16 },
  { name: 'The Star', suit: 'Major Arcana', order: 17 },
  { name: 'The Moon', suit: 'Major Arcana', order: 18 },
  { name: 'The Sun', suit: 'Major Arcana', order: 19 },
  { name: 'Judgement', suit: 'Major Arcana', order: 20 },
  { name: 'The World', suit: 'Major Arcana', order: 21 },

  // ─── Cups ─────────────────────────────────────────────────────────────────
  { name: 'Ace of Cups', suit: 'Cups', order: 22 },
  { name: '2 of Cups', suit: 'Cups', order: 23 },
  { name: '3 of Cups', suit: 'Cups', order: 24 },
  { name: '4 of Cups', suit: 'Cups', order: 25 },
  { name: '5 of Cups', suit: 'Cups', order: 26 },
  { name: '6 of Cups', suit: 'Cups', order: 27 },
  { name: '7 of Cups', suit: 'Cups', order: 28 },
  { name: '8 of Cups', suit: 'Cups', order: 29 },
  { name: '9 of Cups', suit: 'Cups', order: 30 },
  { name: '10 of Cups', suit: 'Cups', order: 31 },
  { name: 'Page of Cups', suit: 'Cups', order: 32 },
  { name: 'Knight of Cups', suit: 'Cups', order: 33 },
  { name: 'Queen of Cups', suit: 'Cups', order: 34 },
  { name: 'King of Cups', suit: 'Cups', order: 35 },

  // ─── Pentacles ────────────────────────────────────────────────────────────
  { name: 'Ace of Pentacles', suit: 'Pentacles', order: 36 },
  { name: '2 of Pentacles', suit: 'Pentacles', order: 37 },
  { name: '3 of Pentacles', suit: 'Pentacles', order: 38 },
  { name: '4 of Pentacles', suit: 'Pentacles', order: 39 },
  { name: '5 of Pentacles', suit: 'Pentacles', order: 40 },
  { name: '6 of Pentacles', suit: 'Pentacles', order: 41 },
  { name: '7 of Pentacles', suit: 'Pentacles', order: 42 },
  { name: '8 of Pentacles', suit: 'Pentacles', order: 43 },
  { name: '9 of Pentacles', suit: 'Pentacles', order: 44 },
  { name: '10 of Pentacles', suit: 'Pentacles', order: 45 },
  { name: 'Page of Pentacles', suit: 'Pentacles', order: 46 },
  { name: 'Knight of Pentacles', suit: 'Pentacles', order: 47 },
  { name: 'Queen of Pentacles', suit: 'Pentacles', order: 48 },
  { name: 'King of Pentacles', suit: 'Pentacles', order: 49 },

  // ─── Wands ────────────────────────────────────────────────────────────────
  { name: 'Ace of Wands', suit: 'Wands', order: 50 },
  { name: '2 of Wands', suit: 'Wands', order: 51 },
  { name: '3 of Wands', suit: 'Wands', order: 52 },
  { name: '4 of Wands', suit: 'Wands', order: 53 },
  { name: '5 of Wands', suit: 'Wands', order: 54 },
  { name: '6 of Wands', suit: 'Wands', order: 55 },
  { name: '7 of Wands', suit: 'Wands', order: 56 },
  { name: '8 of Wands', suit: 'Wands', order: 57 },
  { name: '9 of Wands', suit: 'Wands', order: 58 },
  { name: '10 of Wands', suit: 'Wands', order: 59 },
  { name: 'Page of Wands', suit: 'Wands', order: 60 },
  { name: 'Knight of Wands', suit: 'Wands', order: 61 },
  { name: 'Queen of Wands', suit: 'Wands', order: 62 },
  { name: 'King of Wands', suit: 'Wands', order: 63 },

  // ─── Swords ───────────────────────────────────────────────────────────────
  { name: 'Ace of Swords', suit: 'Swords', order: 64 },
  { name: '2 of Swords', suit: 'Swords', order: 65 },
  { name: '3 of Swords', suit: 'Swords', order: 66 },
  { name: '4 of Swords', suit: 'Swords', order: 67 },
  { name: '5 of Swords', suit: 'Swords', order: 68 },
  { name: '6 of Swords', suit: 'Swords', order: 69 },
  { name: '7 of Swords', suit: 'Swords', order: 70 },
  { name: '8 of Swords', suit: 'Swords', order: 71 },
  { name: '9 of Swords', suit: 'Swords', order: 72 },
  { name: '10 of Swords', suit: 'Swords', order: 73 },
  { name: 'Page of Swords', suit: 'Swords', order: 74 },
  { name: 'Knight of Swords', suit: 'Swords', order: 75 },
  { name: 'Queen of Swords', suit: 'Swords', order: 76 },
  { name: 'King of Swords', suit: 'Swords', order: 77 },
]

export const SUITS = ['Major Arcana', 'Cups', 'Pentacles', 'Wands', 'Swords'] as const

export function filterCardsBySuit(suit: string): TarotCard[] {
  if (!suit || suit === 'all') return TAROT_CARDS
  return TAROT_CARDS.filter((c) => c.suit === suit)
}

export function searchCards(query: string, suit?: string): TarotCard[] {
  const pool = suit && suit !== 'all' ? filterCardsBySuit(suit) : TAROT_CARDS
  if (!query.trim()) return pool
  const q = query.toLowerCase()
  return pool.filter((c) => c.name.toLowerCase().includes(q))
}

export function getCardBySuit(name: string): TarotCard | undefined {
  return TAROT_CARDS.find((c) => c.name.toLowerCase() === name.toLowerCase())
}

export function drawRandomCard(excludeLastNDays: string[] = []): {
  card: TarotCard
  orientation: CardOrientation
} {
  const excluded = new Set(excludeLastNDays.map((n) => n.toLowerCase()))
  const pool = TAROT_CARDS.filter((c) => !excluded.has(c.name.toLowerCase()))
  const candidates = pool.length > 0 ? pool : TAROT_CARDS
  const card = candidates[Math.floor(Math.random() * candidates.length)]
  const orientation: CardOrientation = Math.random() < 0.5 ? 'upright' : 'reversed'
  return { card, orientation }
}

const NO_REPEAT_LOOKBACK_DAYS = 7

function toEpochDay(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 86400000)
}

function epochDayToDateString(epochDay: number): string {
  return new Date(epochDay * 86400000).toISOString().slice(0, 10)
}

export type DateCardDraw =
  | { date: string; cardName: string; orientation: CardOrientation; alreadyAssigned: false }
  | { date: string; cardName: string | null; alreadyAssigned: true }

/**
 * Draws a card + orientation for every date in [startDate, startDate + days).
 * Dates present in `existingByDate` are left untouched — a string value
 * records that date's real card (so later dates still avoid repeating it), a
 * `null` value marks a skipped day (no card, never touched, and doesn't
 * affect the no-repeat window since nothing was actually drawn there).
 * Everything else is freshly drawn, avoiding any card assigned (real or in
 * this same batch) in the 7 days immediately before it.
 */
export function drawCardsForDateRange(
  startDate: string,
  days: number,
  recentHistory: { message_date: string; card_name: string }[] = [],
  existingByDate: Record<string, string | null> = {}
): DateCardDraw[] {
  const assigned = recentHistory.map((h) => ({
    epochDay: toEpochDay(h.message_date),
    cardName: h.card_name,
  }))
  const results: DateCardDraw[] = []
  const startEpoch = toEpochDay(startDate)

  for (let i = 0; i < days; i++) {
    const epoch = startEpoch + i
    const dateStr = epochDayToDateString(epoch)

    if (dateStr in existingByDate) {
      const existingCardName = existingByDate[dateStr]
      if (existingCardName) {
        assigned.push({ epochDay: epoch, cardName: existingCardName })
      }
      results.push({ date: dateStr, cardName: existingCardName, alreadyAssigned: true })
      continue
    }

    const excludeNames = assigned
      .filter((a) => epoch - a.epochDay > 0 && epoch - a.epochDay <= NO_REPEAT_LOOKBACK_DAYS)
      .map((a) => a.cardName)
    const { card, orientation } = drawRandomCard(excludeNames)
    assigned.push({ epochDay: epoch, cardName: card.name })
    results.push({ date: dateStr, cardName: card.name, orientation, alreadyAssigned: false })
  }

  return results
}
