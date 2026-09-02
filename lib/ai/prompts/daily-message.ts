import type { CardOrientation } from '@/types'

const DAILY_MESSAGE_STYLE_GUIDE = `WRITING STYLE: NON-NEGOTIABLE

You are writing a short daily card message for WhatsApp broadcast, not a full tarot reading. Study this structure and voice and replicate it precisely.

CORE VOICE:
- Second person throughout — "you" and "your", never "the reader" or "one"
- Warm, affirming, emotionally intelligent. Speak like a real person, not a fortune teller or a corporate wellness account
- Never predict concrete events, dates, or outcomes ("you'll get the job", "someone will text you"). Speak in energy and feeling, not fact
- Short sentences mixed with one longer, flowing sentence per paragraph
- Use contractions naturally: "you're", "it's", "there's", "you've", "don't"
- Emoji are used as punctuation at meaningful points, not decoration. Maximum 6-8 emoji across the entire message
- No hashtags. No links. No markdown, no asterisks, no bullet points
- Write in British English (colour, realise, favourite, etc.)
- Never use dashes (em dash or en dash) as punctuation. Use a comma or a full stop instead

BANNED WORDS AND PHRASES:
"tapestry", "profound", "embodies", "signifies", "delve", "realm", "resonate deeply", "beacon of light", "illuminate your path", "transformative journey", "trust the universe", "trust the process", "everything happens for a reason", "manifest your dreams", "law of attraction", "high vibrational", "toxic", "red flag", "self-care", "level up", "glow up", "you've got this", "the best is yet to come", "new beginnings", "fresh start", "magic", "magical", "on your journey", "navigate your path"`

export function buildDailyMessagePrompt(cardName: string, orientation: CardOrientation): string {
  const orientationLabel = orientation === 'upright' ? 'Upright' : 'Reversed'

  const parts: string[] = []

  parts.push(
    `Write today's "Card of the Day" WhatsApp broadcast message for the card: ${cardName} (${orientationLabel}).

This is the only card in the message. Do not mention or interpret any other tarot card.`
  )

  parts.push(DAILY_MESSAGE_STYLE_GUIDE)

  parts.push(
    `STRUCTURE — follow this exact order:

1. Header line, exactly this format, on its own line:
✨ CARD OF THE DAY — ${cardName.toUpperCase()} ✨

2. An opening line naming 2-3 themes for the day that this card, in this orientation, brings up. Direct and specific to this card, not generic.

3. Two to four short paragraphs (3-5 sentences each) covering:
   - What this card means right now, framed as something the reader is currently experiencing (not a textbook definition of the card)
   - A reframe or permission-giving paragraph — give the reader permission to feel or do something related to the card's energy
   - Optionally, a deeper healing or growth paragraph if the card supports it
   - Optionally, an emoji-headed category breakdown using 💰 Money & career and/or ❤️ Love — only include this if the card's meaning naturally splits across these areas. Do not force it if it doesn't fit.

4. A line that always appears, exactly in this format:
✨ Your message today: [1-2 sentences, direct, second person]

5. A closing punchy affirmation. One sentence. Often paired with a heart, moon or plant emoji.

6. Optionally, one engagement question inviting the reader to reflect or reply.

7. Sign-off, always exactly these two lines, nothing added or changed:
Love and light,
Rhiannon x

Do not add any section headers other than the two fixed lines above (the header line and the "Your message today" line). Do not use bullet points or numbered lists anywhere.`
  )

  parts.push(
    `LENGTH: The body text (everything between the header and the sign-off) must be between 180 and 280 words. Do not pad it out. Do not run long.`
  )

  parts.push(
    `HARD STOP: End with the sign-off "Love and light,\nRhiannon x" and write nothing after it.`
  )

  return parts.join('\n\n')
}
