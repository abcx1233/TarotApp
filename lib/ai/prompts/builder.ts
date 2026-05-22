import { FUTURE_SECTION_INSTRUCTION } from './future-section'
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
  specificQuestion?: string
  mainFocus?: string
  cards: CardInput[]
  bottomCard: {
    name: string
    orientation: CardOrientation
  }
  oracleCardName?: string
  includeEnergyCleansing?: boolean
  energyCleansingNotes?: string
  birthday?: string
  starSign?: string
  relationshipStatus?: string
  otherPersonName?: string
  isReturningClient?: boolean
}

export function buildPrompt(input: PromptInput): string {
  const parts: string[] = []

  // 1. Tone preset
  parts.push(input.tonePresetText.trim())

  // 2. Character target
  parts.push(`Write approximately ${input.characterTarget} characters in total.`)

  // 3. Topic
  parts.push(`The topic or area of focus for this reading is: ${input.topic}`)

  // 4. Specific question
  if (input.specificQuestion?.trim()) {
    parts.push(
      `The client has asked a specific question. Make sure this is answered fully and directly within the reading: ${input.specificQuestion.trim()}`
    )
  }

  // Personalisation context block
  const personDetails: string[] = []
  if (input.birthday) personDetails.push(`Birthday: ${input.birthday}`)
  if (input.starSign) personDetails.push(`Star sign: ${input.starSign}`)
  if (input.relationshipStatus)
    personDetails.push(`Relationship status: ${input.relationshipStatus}`)
  if (input.otherPersonName)
    personDetails.push(`Other person's name: ${input.otherPersonName}`)
  if (input.isReturningClient) personDetails.push(`This is a returning client.`)

  if (personDetails.length > 0) {
    parts.push(`Client details:\n${personDetails.join('\n')}`)
  }

  // Additional context
  if (input.mainFocus?.trim()) {
    parts.push(`Additional context from the client: ${input.mainFocus.trim()}`)
  }

  // 5. Cards in spread
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

  // 6. Bottom of deck card
  if (input.bottomCard.name.trim()) {
    const orientation =
      input.bottomCard.orientation === 'upright' ? 'Upright' : 'Reversed'
    parts.push(
      `Card at the bottom of the deck: ${input.bottomCard.name} (${orientation}). Include the energy of this card as an undercurrent throughout the reading.`
    )
  }

  // 7. Oracle card
  if (input.oracleCardName?.trim()) {
    parts.push(
      `An oracle card has also come through for this person: ${input.oracleCardName.trim()}. Weave its message naturally and intuitively into the reading.`
    )
  }

  // 8. Energy cleansing ritual
  if (input.includeEnergyCleansing) {
    const ritualContext = input.energyCleansingNotes?.trim()
      ? ` Additional context: ${input.energyCleansingNotes.trim()}`
      : ''
    parts.push(
      `At the end of the reading, include a personalised energy cleansing ritual suggestion for this person. Make it feel spiritual, grounded and specific to their situation — not generic. Describe a simple ritual they can do at home using items they are likely to have.${ritualContext}`
    )
  }

  // 9. Future section (always)
  parts.push(FUTURE_SECTION_INSTRUCTION)

  // 10. Language, tone, cultural context, and formatting (always)
  parts.push(
    `Write in British English throughout. Use British spelling, vocabulary and phrasing at all times:
- 'colour' not 'color'
- 'realise' not 'realize'
- 'whilst' not 'while'
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
