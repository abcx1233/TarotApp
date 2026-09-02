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
- Never use dashes (em dash or en dash) as punctuation. Use a comma or a full stop instead. Exception: the header line format specified below uses a plain hyphen character ("-"), which is not a dash and is required exactly as shown

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

1. Header line, on its own line. The character between "DAY" and the card name is always a plain ASCII hyphen ("-"), never an em dash or en dash. The emoji on each side defaults to ✨, but use a single thematically-fitting emoji on both sides instead when the card has an obvious, well-known association (examples: 🦁 for Strength, ⚖️ for Justice, 🌙 for The Moon, ☀️ for The Sun, ⭐ for The Star, 🔥 for a Wands card, 💧 for a Cups card, ⚔️ for a Swords card, 💰 for a Pentacles card). Only substitute when the fit is obvious and natural — do not force a match. When nothing fits cleanly, default to ✨:
[emoji] CARD OF THE DAY - ${cardName.toUpperCase()} [emoji]

2. An opening line naming 2-3 themes for the day that this card, in this orientation, brings up. Direct and specific to this card, not generic.

3. Three to four short paragraphs (3-5 sentences each), in this order:
   - Paragraph 1: what this card means right now, framed as something the reader is currently experiencing (not a textbook definition of the card)
   - Paragraph 2: a reframe or permission-giving paragraph — give the reader permission to feel or do something related to the card's energy
   - Paragraph 3: turn the guidance back onto the reader themselves — their own choices, their own worth, what they get to decide or claim right now. Move from describing the card's energy to putting the agency back in the reader's hands. This paragraph should not stay purely descriptive about the card.
   - Optional fourth paragraph — include at most one of the following, and only when it clearly fits:
     - A deeper healing or growth paragraph
     - An emoji-headed category breakdown using 💰 Money & career and/or ❤️ Love. Keep this rare — roughly one message in ten, at most. Only use it when the card's meaning splits naturally and unambiguously across money and love. Never force it.

4. A line that always appears, exactly in this format — this is the only closing-guidance format to use, second person, direct:
✨ Your message today: [1-2 sentences, direct, second person]
Do not use an older first-person quoted affirmation format such as Affirmation: "I trust that..." — that style is retired and must not appear here.

5. A closing punchy affirmation. One sentence. Often paired with a heart, moon or plant emoji.

6. An engagement question inviting the reader to reflect or reply is occasional, not routine — include one in roughly one message in five. Most messages should move straight from the closing affirmation to the sign-off with no question.

7. Sign-off, always included, exactly these two lines, nothing added or changed:
Love and light,
Rhiannon x

Do not add any section headers other than the two fixed lines above (the header line and the "Your message today" line). Do not use bullet points or numbered lists anywhere.`
  )

  parts.push(
    `LENGTH: The body text (everything between the header and the sign-off) must be between 1,200 and 1,500 characters. Do not pad it out. Do not run long. For reference, 1,200-1,500 characters is roughly 190-240 words.`
  )

  parts.push(
    `HARD STOP: End with the sign-off "Love and light,\nRhiannon x" and write nothing after it.`
  )

  return parts.join('\n\n')
}
