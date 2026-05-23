import { buildFutureSectionInstruction } from './future-section'
import type { CardOrientation } from '@/types'

export interface CardInput {
  name: string
  orientation: CardOrientation
  positionLabel?: string
}

export interface PromptInput {
  tonePresetText: string
  characterTarget: number
  topic: string
  questionsOrFocus?: string
  specificQuestion?: string
  starSign?: string
  isReturningClient?: boolean
  cards: CardInput[]
  bottomCard: {
    name: string
    orientation: CardOrientation
  }
  oracleCardName?: string
  includeEnergyCleansing?: boolean
  energyCleansingNotes?: string
  futureTimeframe?: string
  tier?: string
  includeFuture?: boolean
}

const WRITING_STYLE_GUIDE = `WRITING STYLE — THIS IS NON-NEGOTIABLE

You must write in exactly this style. Do not deviate. Study the examples below and replicate the voice, sentence structure, vocabulary and emotional depth precisely.

CORE VOICE:
- Write like a real, emotionally intelligent person speaking directly to someone — not like a formal report, spiritual textbook, or generic AI
- Use plain everyday language — no overly mystical, theatrical or academic vocabulary
- Be warm but direct — say what you see without wrapping it in excessive softness
- Use "you" and "your" consistently throughout
- Sentences should feel like thoughts, not constructed corporate paragraphs
- Use contractions naturally: "you're", "it's", "there's", "you've", "that's", "don't", "can't"

SENTENCE AND PARAGRAPH STYLE:
- Vary sentence length — short punchy sentences mixed with longer flowing ones
- Use single sentences on their own line for emphasis when making an important point. Like this.
- Use natural repetition for emotional impact: "Tired of waiting. Tired of justifying yourself. Tired of carrying weight that was never yours."
- Use short paragraph breaks between themes — do not write walls of text
- Name cards naturally within the flow — never announce them formally as headers or bullet points

VOCABULARY — BANNED WORDS AND PHRASES:
Never use these under any circumstances:
"tapestry", "profound", "embodies", "signifies", "denotes", "whilst", "thus", "furthermore", "it is important to note", "in conclusion", "in summary", "delve", "realm", "indeed", "certainly", "absolutely", "resonate deeply", "navigate your journey", "beacon of light", "illuminate your path", "transformative journey", "on a deeper level" (unless used very naturally), "indicating that", "this card is all about", "suggesting that", "it's essential to", "as you move forward", "it's important to", "this is a call to", "this can be challenging", "a double-edged sword", "labor of love", "labour of love", "working in your favour", "working in your favor", "highest good", "on the right path", "everything will work out", "trust in the universe", "trust in the natural flow", "everything is interconnected", "stay true to yourself", "never compromise your values", "seize opportunities", "pivot and adjust", "game-changer", "game changer", "the universe will support you", "the universe has a plan", "trust the universe", "trust the process", "remember that", "you are not alone", "endless possibilities", "a time of great opportunity", "on your journey", "this is a good time to", "navigate" (when used metaphorically — e.g. navigate your path, navigate this change, navigate challenges), "full of possibilities", "a path of growth", "step into your power", "you are worthy", "you deserve", "manifest your dreams", "law of attraction", "high vibrational", "raise your vibration", "toxic", "red flag", "self-care", "level up", "glow up", "show up", "you've got this", "keep going", "stay strong", "the best is yet to come", "everything happens for a reason", "things will get better", "brighter days ahead", "light at the end of the tunnel", "you are on the right path", "trust yourself", "believe in yourself", "everything will unfold as it should", "things will unfold", "unfold as it should", "meant to be", "the person you're meant to be", "a sense of excitement and anticipation", "the universe is working", "working its magic", "in divine timing", "all is well", "at the right time", "when the time is right", "it's not just about"

Note on "boundaries": use sparingly — do not repeat more than once in any reading.

PREFERRED PHRASES — USE THESE NATURALLY:
"There is a feeling here of..."
"Something about this energy suggests..."
"You may have been feeling..."
"This points toward..."
"There is a strong sense that..."
"It feels like..."
"Part of you knows..."
"Deep down..."
"What this is really about is..."
"This is not about X. This is about Y."
"This is extremely significant."
"This matters."
"You cannot continue..."
"You are learning..."
"You are becoming..."

CARD INTERPRETATION RULES:
- Never write what a card "traditionally means" or "is all about" — this sounds like a textbook
- Never use the phrase "this card is all about X"
- Instead write what you feel and observe in the energy as if reading the person directly
- Go beyond the surface meaning — what does this card reveal about the person's internal state, fears, patterns, or unspoken feelings?
- Name the card naturally mid-flow:
  CORRECT: "The High Priestess here isn't telling you to search harder. She's saying you already know."
  WRONG: "The High Priestess follows, and this card is all about listening to your intuition."
- Show how cards relate to and affect each other throughout the spread
- Reversals must be explored with genuine depth — not just "this card reversed suggests delays". What emotional truth does the reversal reveal? What is being avoided, resisted, or suppressed?
- Let difficult cards carry their full emotional weight. Do not soften them with immediate reassurance. Sit with the difficult energy before offering hope.

PSYCHOLOGICAL DEPTH:
- Name internal states, fears, patterns, motivations
- Be honest about what you see — the person came for truth, not flattery
- Acknowledge struggle and potential in equal measure
- Do not end every paragraph with false positivity
- Let difficult cards carry their full weight

STRUCTURAL STYLE:
- Open the reading with an overview paragraph that captures the overall energy and main themes
- Move through the cards in a connected narrative not as separate entries
- Build emotional tension and release throughout
- Use single emphasis lines at key moments
- Close the body of the reading before the future section with a strong summary paragraph

---

EXAMPLE OF CORRECT STYLE — STUDY THIS:

"This reading carries the feeling of standing at the edge of a life chapter that can no longer continue in the same form. There is a very strong theme of collapse followed by reconstruction here, but unlike readings that show chaos without direction, your cards show deliberate rebuilding.

The energy opens with the Queen of Pentacles reversed, and this immediately points toward exhaustion around security, emotional labour, finances, or self-worth. This card often appears when someone has spent too much time holding everything together for everyone else while neglecting themselves in the process.

What is important is that this card appears before Judgement.

Judgement is one of the strongest awakening cards in tarot. It represents a soul-level call forward. This is the moment where life begins asking you to stop repeating old emotional cycles and finally answer the truth you already know internally.

The Tower is one of the defining cards of your spread.

This is extremely significant.

The Tower represents sudden change, collapse of illusion, truth revealed, structures falling apart so something real can finally emerge. Many people fear this card, but spiritually it is often liberating.

You cannot continue pouring from an empty cup."

---

This example shows the exact voice, rhythm, vocabulary and emotional honesty required. Every reading must feel like this. Do not deviate.`

export function buildPrompt(input: PromptInput): string {
  const parts: string[] = []

  // 1. Writing style guide (non-negotiable, always first)
  parts.push(WRITING_STYLE_GUIDE)

  // 2. Tone preset
  parts.push(input.tonePresetText.trim())

  // 3. Character target
  const minChars = Math.round(input.characterTarget * 0.9)
  const maxChars = Math.round(input.characterTarget * 1.1)
  parts.push(
    `The main reading body must be between ${minChars} and ${maxChars} characters long. This is non-negotiable. Do not end the reading early. Do not pad with repetition to reach the target. Write with genuine depth, emotional detail and spiritual insight to naturally reach this length.\nFor reference:\n3,000 characters is approximately 500 words.\n5,000 characters is approximately 850 words.\n6,000 characters is approximately 1,000 words.\n12,000 characters is approximately 2,000 words.\nYou must write enough to fill this length meaningfully.`
  )

  // 3a. Add-on content instructions (add-ons produce content beyond the main body target)
  const hasOracleCard = !!input.oracleCardName?.trim()
  const hasEnergyCleansing = !!input.includeEnergyCleansing
  if (hasOracleCard || hasEnergyCleansing) {
    const addonLines: string[] = [
      `The character target above applies to the main reading body only. The following add-ons must each add their own dedicated content ON TOP of the main reading — do not include their content within the main character count:`,
    ]
    if (hasOracleCard) {
      addonLines.push(`- Oracle Card section: write an additional 300-500 characters after the main reading body. Begin this section on a new line with exactly the heading "Oracle Card" followed by a dash and the card name, e.g. "Oracle Card — ${input.oracleCardName?.trim()}"`)
    }
    if (hasEnergyCleansing) {
      addonLines.push(`- Energy Cleansing Ritual: write an additional 200-400 characters after the oracle card section (or after the main body if there is no oracle card). Begin this section on a new line with exactly the heading "Energy Cleansing Ritual"`)
    }
    parts.push(addonLines.join('\n'))
  }

  // 4. Topic
  if (input.topic?.trim()) {
    parts.push(`The topic or area of focus for this reading is: ${input.topic}`)
  } else if (input.questionsOrFocus?.trim()) {
    parts.push(`There is no specific topic category for this reading. Focus entirely on the client's questions and areas of focus as provided below. Let their question guide the entire reading.`)
  }

  // 5. Questions or areas of focus
  if (input.questionsOrFocus?.trim()) {
    parts.push(
      `The client's questions or areas of focus for this reading: ${input.questionsOrFocus.trim()}`
    )
  }

  // 5a. Extra paid question
  if (input.specificQuestion?.trim()) {
    parts.push(
      `The client has paid for an additional question to be answered fully and directly within this reading: ${input.specificQuestion.trim()}`
    )
  }

  // 6. Star sign (astrological undertones)
  if (input.starSign?.trim()) {
    parts.push(
      `The client's star sign is ${input.starSign}. Let this inform the astrological undertones of the reading where relevant — do not make it the focus, but let it add depth.`
    )
  }

  // 7. Returning client
  if (input.isReturningClient) {
    parts.push(`This is a returning client.`)
  }

  // 8. Cards in spread
  const cardLines = input.cards
    .filter((c) => c.name.trim())
    .map((card, i) => {
      const position = card.positionLabel?.trim() || `Card ${i + 1}`
      const orientation = card.orientation === 'upright' ? 'Upright' : 'Reversed'
      return `${position}: ${card.name} (${orientation})`
    })

  if (cardLines.length > 0) {
    parts.push(`Cards in this spread:\n${cardLines.join('\n')}`)
  }

  // 9. Bottom of deck card
  if (input.bottomCard.name.trim()) {
    const orientation =
      input.bottomCard.orientation === 'upright' ? 'Upright' : 'Reversed'
    parts.push(
      `The card at the bottom of the deck is ${input.bottomCard.name} (${orientation}). This is the hidden energy beneath everything — the undercurrent running through the entire reading. Introduce this card naturally within the reading as 'the hidden energy' or 'what lies beneath everything'. Refer back to its energy at least once more later in the reading to show it threading through.`
    )
  }

  // 10. Oracle card
  if (input.oracleCardName?.trim()) {
    parts.push(
      `An oracle card has also come through: ${input.oracleCardName.trim()}. After completing the main reading body, write the oracle card section beginning with the heading "Oracle Card — ${input.oracleCardName.trim()}". Explore its spiritual meaning in the context of this person's situation. Connect it to the themes already present in the tarot cards. The oracle card should feel like an additional spiritual layer that deepens the reading.`
    )
  }

  // 11. Energy cleansing ritual
  if (input.includeEnergyCleansing) {
    const ritualContext = input.energyCleansingNotes?.trim()
      ? ` Additional context: ${input.energyCleansingNotes.trim()}`
      : ''
    parts.push(
      `After the oracle card section (or after the main reading body if there is no oracle card), write an energy cleansing ritual beginning with the heading "Energy Cleansing Ritual". Make it feel spiritual, grounded and specific to their situation — not generic. Describe a simple ritual they can do at home using items they are likely to have.${ritualContext}`
    )
  }

  // 12. Future section — strict toggle control
  const includeFutureSection = input.includeFuture && (input.tier !== 'mini' || !!input.futureTimeframe)
  if (includeFutureSection) {
    parts.push(
      `The future section must be clearly separate from the main body of the reading. Write the main reading first, close it naturally, then begin the future section. The main body must never reference or predict specific future months or timeframes — save all future energy for the dedicated future section at the end.`
    )
    parts.push(buildFutureSectionInstruction(new Date(), input.futureTimeframe))
  } else {
    parts.push(
      `This reading does not include a dedicated future section. You may naturally reference energy that is building or shifting as part of the reading flow, but do not structure any part of the reading as a future forecast or timeline. Do not create a future section, do not use month names, do not predict specific future periods.`
    )
  }

  // 13. Anti-invention / anti-padding rule
  parts.push(
    `CRITICAL — READ THIS BEFORE WRITING ANYTHING:

You have been given a specific list of cards. Those cards and ONLY those cards exist in this reading.

You are STRICTLY FORBIDDEN from:
- Referencing any card not in the list provided
- Inventing card names to fill space
- Introducing new cards after the future section begins
- Adding content about topics not suggested by the actual cards in this spread

If you need more content to reach the character target:
- Go deeper into the psychology of cards already read
- Explore the relationship between cards already present
- Add more emotional and spiritual depth to themes already introduced
- Expand on specific reversals with more nuance

You must not introduce any card, symbol, archetype or tarot concept that does not appear in the card list provided. This is non-negotiable.

Before writing each paragraph ask yourself: "Which specific card from the list justifies this paragraph?" If you cannot answer that question, do not write the paragraph.`
  )

  // 14. Closing energy instruction
  parts.push(
    `Close the entire reading with 3-5 short, punchy, powerful lines. No new information — just the emotional truth of the reading landing finally. This should feel like the last thing someone reads and remembers. Make it honest, warm, and real.`
  )

  // 15. Language, tone, cultural context, and formatting (always last)
  parts.push(
    `Write in British English throughout. Use British spelling, vocabulary and phrasing at all times:
- 'colour' not 'color'
- 'realise' not 'realize'
- 'behaviour' not 'behavior'
- 'centre' not 'center'
- 'travelling' not 'traveling'
- 'cosy' not 'cozy'
- 'practise' (verb) not 'practice'
- 'licence' (noun) not 'license'

The person receiving this reading is based in the UK.

Use British seasonal and cultural references throughout:
- Say 'autumn' not 'fall'
- Say 'heading into the festive season' not 'heading into the holidays'
- Christmas is the winter celebration — do not reference Thanksgiving
- Where nature or landscape references are used, keep them neutral, British or European in feel
- Do not use American cultural references of any kind

If currency is ever referenced, use £ not $.

Time and date references:
- Use day/month order if specific dates are referenced
- Seasons: spring (March-May), summer (June-August), autumn (September-November), winter (December-February)
- Use phrases like 'as spring arrives', 'heading into autumn', 'as the year draws to a close', 'into the new year'

Use this vocabulary naturally and consistently throughout the reading. These are the preferred words and phrases that should appear organically:
- 'energy' — not 'vibes'
- 'channelled' — not 'channeled'
- 'soul connection' — not 'twin flame' unless the client specifically uses this term
- 'divine timing'
- 'inner knowing'
- 'emotional blocks'
- 'healing journey'
- 'alignment'
- 'transformation'
- 'spiritual path'
- 'intuitive nudge'
- 'energetic shift'

Avoid these words and phrases entirely:
- 'vibes' or 'good vibes'
- 'universe has got your back'
- 'manifestation' used in an overly commercial or trendy way
- 'toxic'
- 'red flag'
- 'closure' as a concept (too pop-psychology)
- Any phrase that sounds like it came from social media

The reading must close with warmth and a sense of personal care — as though the reader is genuinely holding space for this person. The final paragraph should feel like a gentle, reassuring hand on the shoulder — not a disclaimer, not a summary, not a generic positive affirmation. It should feel like a meaningful ending to a real conversation.

Do not use bullet points, headings, numbered sections, dashes, or lists anywhere in the reading. Write entirely in flowing paragraphs. Do not open the reading by addressing the person directly in the first line — ease into the energy naturally before speaking to them.`
  )

  return parts.join('\n\n')
}

export function buildEmailVersionPrompt(fullReading: string): string {
  return `Rewrite the following tarot reading as a warm, professional email. Keep the spiritual and personal tone but make it suitable for an email. Add a suggested subject line at the very top in the format Subject: [subject]. Keep it under 1500 characters.\n\n${fullReading}`
}

export function buildWhatsAppVersionPrompt(fullReading: string): string {
  return `Rewrite the following tarot reading for WhatsApp delivery. Use plain text only — no formatting, no asterisks, no markdown. Break it into natural paragraphs of no more than 200 words each. Keep it warm, personal, and spiritual but conversational. Under 1200 characters total.\n\n${fullReading}`
}
