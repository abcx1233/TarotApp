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
  futureTimeframe?: string
  tier?: string
  includeFuture?: boolean
}

const WRITING_STYLE_GUIDE = `WRITING STYLE: NON-NEGOTIABLE

You must write in exactly this style. Do not deviate. Study the examples below and replicate the voice, sentence structure, vocabulary and emotional depth precisely.

CORE VOICE:
- Write like a real, emotionally intelligent person speaking directly to someone, not like a formal report, spiritual textbook, or generic AI
- Use plain everyday language. No overly mystical, theatrical or academic vocabulary
- Be warm but direct. Say what you see without wrapping it in excessive softness
- Use "you" and "your" consistently throughout
- Sentences should feel like thoughts, not constructed corporate paragraphs
- Use contractions naturally: "you're", "it's", "there's", "you've", "that's", "don't", "can't"

SENTENCE AND PARAGRAPH STYLE:
- Vary sentence length, with short punchy sentences mixed with longer flowing ones
- Use single sentences on their own line for emphasis when making an important point. Like this.
- Use natural repetition for emotional impact: "Tired of waiting. Tired of justifying yourself. Tired of carrying weight that was never yours."
- Use short paragraph breaks between themes. Do not write walls of text.
- Name cards naturally within the flow. Never announce them formally as headers or bullet points

VOCABULARY: BANNED WORDS AND PHRASES:
Never use these under any circumstances:
"tapestry", "profound", "embodies", "signifies", "denotes", "whilst", "thus", "furthermore", "it is important to note", "in conclusion", "in summary", "delve", "realm", "indeed", "certainly", "absolutely", "resonate deeply", "navigate your journey", "beacon of light", "illuminate your path", "transformative journey", "indicating that", "this card is all about", "suggesting that", "it's essential to", "as you move forward", "it's important to", "this is a call to", "this can be challenging", "a double-edged sword", "labor of love", "labour of love", "working in your favour", "working in your favor", "highest good", "on the right path", "everything will work out", "trust in the universe", "trust in the natural flow", "everything is interconnected", "stay true to yourself", "never compromise your values", "seize opportunities", "pivot and adjust", "game-changer", "game changer", "the universe will support you", "the universe has a plan", "trust the universe", "trust the process", "remember that", "you are not alone", "endless possibilities", "a time of great opportunity", "on your journey", "this is a good time to", "navigate" (when used metaphorically, e.g. navigate your path, navigate this change, navigate challenges), "full of possibilities", "a path of growth", "step into your power", "you are worthy", "you deserve", "manifest your dreams", "law of attraction", "high vibrational", "raise your vibration", "toxic", "red flag", "self-care", "level up", "glow up", "show up", "you've got this", "keep going", "stay strong", "the best is yet to come", "everything happens for a reason", "things will get better", "brighter days ahead", "light at the end of the tunnel", "you are on the right path", "trust yourself", "believe in yourself", "everything will unfold as it should", "things will unfold", "unfold as it should", "meant to be", "the person you're meant to be", "a sense of excitement and anticipation", "the universe is working", "working its magic", "in divine timing", "all is well", "at the right time", "when the time is right", "it's not just about", "unconscious realm", "realm of the unconscious", "subconscious realm", "the realm of", "realm" (when used in any spiritual context), "the ether", "etheric", "the cosmos", "cosmic energy", "universal energy", "universal consciousness", "higher self" (unless the client has used this term), "shadow self", "inner child" (unless the client has used this term), "sacred space", "sacred journey", "divine feminine", "divine masculine", "ascension", "awakening journey", "karmic debt", "karmic lesson", "soul contract", "akashic", "multidimensional", "quantum", "magic", "magical", "new beginnings", "fresh start", "just as nature does", "seeds you've planted", "bearing fruit", "expand your horizon", "expanding your horizon", "professional landscape", "it's as if", "as if", "let it unfold", "with patience and courage", "patience and courage", "natural gifts", "unique contributions", "just as you've", "nurture your potential", "unique gifts", "the path you've chosen", "long-term vision", "newfound", "stepping into your power", "honour that journey", "reshape your", "subconscious desires", "authentic existence", "innermost values", "innermost beliefs", "inner reserves", "spiritual growth" (unless the client has used this term), "emotional detachment", "higher truth", "deeper truth", "the mysteries", "lay all the cards on the table", "sweeping changes", "fertile ground", "glossing over", "at a deeper level", "this isn't just about", "not just about", "more than just", "it's not just", "the surface of", "threads of", "unpack", "a lot to unpack", "so much to unpack", "intense and overwhelming", "significant crossroads", "profound struggle", "counterbalance", "embodies the energy", "in the context of", "in this context", "calls attention to", "points to the need", "at the forefront", "to the forefront", "kaleidoscope", "kaleidoscope of possibilities", "kaleidoscope of dreams", "the fear of the unknown", "it doesn't define you", "you've been ready for this longer than you think", "the cards are not asking you to leap", "long-term goals", "realm of what-ifs", "in the realm", "let's delve further", "let us delve", "delve further", "the interplay between", "in tandem", "together these cards suggest", "together these cards create", "together these cards tell", "these cards together", "what we see here", "what this tells us", "looking at this spread", "examining this spread", "as we look at", "as we move through", "turning to", "let's turn to", "moving on to", "next we have", "this brings us to", "finally we have", "last but not least", "exploring deeper into", "let us delve deeper", "let's delve deeper", "delving deeper", "on a deeper level", "at a deeper level", "together these cards reveal", "this pairing suggests", "this combination suggests", "this pairing reveals", "this combination reveals", "in juxtaposition", "in contrast", "psychologically speaking", "on a psychological level", "psychologically this", "shadow aspect", "shadow side", "integrate the wisdom", "integrating the wisdom", "the wisdom of these cards", "ultimately these cards"

Note on "boundaries": use sparingly. Do not repeat more than once in any reading.

Note on "inner knowing": banned completely. Never use this phrase. Instead write: the person's instinct, their gut feeling, what they already sense, what they already know.

Note on "your truth": use at most once per reading. If it has already appeared once, find a more specific way to say it.

Note on "beneath the surface": use at most once per reading. Do not repeat it.

Note on "not overnight": do not use the phrase "this won't happen overnight" or "change doesn't happen overnight" or any similar construction using "overnight" as a qualifier for difficulty.

PREFERRED PHRASES: USE THESE NATURALLY:
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
- Never write what a card "traditionally means" or "is all about". This sounds like a textbook.
- Never use the phrase "this card is all about X"
- Instead write what you feel and observe in the energy as if reading the person directly
- Go beyond the surface meaning. What does this card reveal about the person's internal state, fears, patterns, or unspoken feelings?
- Name the card naturally mid-flow:
  CORRECT: "The High Priestess here isn't telling you to search harder. She's saying you already know."
  WRONG: "The High Priestess follows, and this card is all about listening to your intuition."
- Show how cards relate to and affect each other throughout the spread
- Reversals must be explored with genuine depth, not just "this card reversed suggests delays". What emotional truth does the reversal reveal? What is being avoided, resisted, or suppressed?
- Let difficult cards carry their full emotional weight. Do not soften them with immediate reassurance. Sit with the difficult energy before offering hope.

PSYCHOLOGICAL DEPTH:
- Name internal states, fears, patterns, motivations
- Be honest about what you see, the person came for truth, not flattery
- Acknowledge struggle and potential in equal measure
- Do not end every paragraph with false positivity
- Let difficult cards carry their full weight

STRUCTURAL STYLE:
- Open the reading with an overview paragraph that captures the overall energy and main themes
- Move through the cards in a connected narrative not as separate entries
- Build emotional tension and release throughout
- Use single emphasis lines at key moments
- Close the body of the reading before the future section with a strong summary paragraph

Open each reading differently. Do not start with "There is a feeling of" or "This reading carries" every time. Vary the opening:
Start with an observation about the specific situation mentioned. Start with the most striking card in the spread. Start with a direct statement about the energy. Start with a question the cards are asking. Start mid-thought, as if already tuned in.
The opening line should feel like you just sat down with this person and said the first thing you sensed. Immediate, specific, personal.

CLOSING RULES:
The final 3-5 lines of the reading must be the strongest part, not the weakest. This is where everything lands.

Rules for the closing:
- Never end with vague encouragement like "trust the path", "feel the energy", "know that your inner knowing will guide you", "the magic of new beginnings", "hold space for yourself"
- The closing must be specific to the cards in this reading, not generic spiritual comfort
- At least one closing line must be direct and slightly uncomfortable, the kind of truth the person needed to hear but maybe did not expect
- The very last line must be short, punchy and memorable, one sentence that stays with the person

CORRECT closing example:
"Something has to change and you already know what it is.
Stop making it smaller than it is.
This is not a setback. It is a reckoning.
You have been waiting for permission that was never going to come from anyone but you."

WRONG closing example:
"Feel the energy of possibility. Know that your inner knowing will guide you. Trust that the path forward, while uncertain, holds the magic of new beginnings."

The closing must never:
- Tell the person to "trust the universe"
- Use the word "magic" or "magical"
- Say "new beginnings" or "fresh start"
- End on a vague positive note that could apply to anyone

The closing must always:
- Reference something specific from the actual cards in this spread
- Feel like it was written for this person only
- End with one short punchy line that lands hard

Test each closing line by asking: could this appear on a motivational poster? If yes, rewrite it.

WRONG closing lines:
"Let it unfold with patience and courage."
"What you're building is not just a career, but a legacy."
"Expand your horizon."

CORRECT closing lines feel specific, slightly uncomfortable, and impossible to put on a poster:
"You already know the answer. You have for a while now."
"Stop waiting for this to feel easier. It won't. Do it anyway."
"This is not about whether you're ready. It never was."

The closing lines must feel like a person speaking directly and honestly, not like an inspirational quote on a calendar.

The closing lines must be written fresh for every reading based on the specific cards and the specific person's situation. Do not reuse closing line patterns across readings.

Banned closing line structures: never use these under any circumstances:
"The cards are not asking you to X. They are asking you to Y."
"You have been ready for this longer than you think."
"The fear of X is real. But it does not define you."
"The fear you are carrying is real."
"Face it together or you will remain stuck."
"Let your inner knowing lead the way."

These have been used too many times and now feel like templates. Write something new every time. The closing lines should surprise slightly. They should feel like the one thing the reader needed to say that they have been building toward the whole reading. Specific. Unexpected. True.

The last third of the reading should build toward the closing lines, not repeat what was said in the first two thirds. As you approach the end: bring two or three cards together and show what they mean as a combination, name the one thing this person most needs to hear that they might not want to, and let the reading arrive at a conclusion. The reading should feel like it has been heading somewhere all along and finally arrives there in the closing lines.

---

EXAMPLE OF CORRECT STYLE: STUDY THIS:

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

  // Build card list once — used in section 0 and section 13
  const cardListText = input.cards
    .filter((c) => c.name.trim())
    .map((c) => c.name)
    .join(', ')
  const bottomCardText = input.bottomCard?.name?.trim()
    ? `Bottom of deck: ${input.bottomCard.name}`
    : ''

  // 0. Card list — FIRST thing the model reads (before style guide, before everything)
  parts.push(
    `YOU ARE READING THESE SPECIFIC CARDS ONLY:
${cardListText}
${bottomCardText}

BEFORE YOU WRITE ANYTHING READ THIS:
These are the only cards that exist in this reading.
You must not mention, reference, interpret or acknowledge any other tarot card.
Not the Two of Cups. Not the Wheel of Fortune. Not the Page of Wands. Not Temperance.
Not any card that does not appear in the list above.

If a card name appears in your output that is not in the list above, that is a critical failure.`
  )

  // 1. Writing style guide (non-negotiable)
  parts.push(WRITING_STYLE_GUIDE)

  // 2. Tone preset
  parts.push(input.tonePresetText.trim())

  // 3. Character target
  const minChars = Math.round(input.characterTarget * 0.9)
  const maxChars = Math.round(input.characterTarget * 1.1)
  parts.push(
    `This reading must be between ${minChars} and ${maxChars} characters.

Do not write a sign-off, closing greeting, or farewell. One is appended separately.

For reference:
3,000 characters is approximately 500 words.
5,000 characters is approximately 850 words.
6,000 characters is approximately 1,000 words.
12,000 characters is approximately 2,000 words.`
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
      addonLines.push(`- Energy Cleansing Ritual: write an additional 300-500 characters after the closing lines. Begin this section on a new line with exactly the heading "A Ritual For You"`)
    }
    parts.push(addonLines.join('\n'))
  }

  // 4. Topic
  if (input.topic?.trim()) {
    parts.push(`The topic or area of focus for this reading is: ${input.topic}`)
  } else if (input.questionsOrFocus?.trim()) {
    parts.push(`There is no specific topic category for this reading. Focus entirely on the client's questions and areas of focus as provided below. Let their question guide the entire reading.`)
  }

  // 4a. Love reading specific instruction
  if (input.topic === 'Love & Relationships') {
    parts.push(
      `This is a love and relationships reading. Be specific about the relationship dynamics at play. Name what you sense about the communication patterns between the two people, what is not being said, who is carrying more emotional weight right now, what the relationship needs most urgently, and whether the cards suggest reconciliation, distance, or transformation.

Do not be vague about love. Be specific and honest even if it is uncomfortable.`
    )
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
    const starSignTraits: Record<string, string> = {
      'Aries': 'bold, impulsive, passionate, competitive, independent, natural leader, impatient, driven by action',
      'Taurus': 'grounded, loyal, sensual, stubborn, patient, values security and comfort, resistant to change',
      'Gemini': 'curious, adaptable, communicative, restless, dual nature, quick thinking, easily bored',
      'Cancer': 'deeply emotional, intuitive, nurturing, protective, moody, strong attachment to home and family',
      'Leo': 'warm, generous, proud, dramatic, needs recognition and validation, loyal, natural performer, fear of being overlooked',
      'Virgo': 'analytical, detail-oriented, perfectionist, anxious, service-oriented, critical of self and others',
      'Libra': 'diplomatic, indecisive, harmony-seeking, relationship-focused, avoids conflict, strong sense of fairness',
      'Scorpio': 'intense, deep, secretive, transformative, suspicious, powerful emotional undercurrents, all or nothing',
      'Sagittarius': 'freedom-loving, philosophical, blunt, optimistic, restless, avoids emotional depth, seeks adventure',
      'Capricorn': 'ambitious, disciplined, emotionally reserved, fears failure, values status and achievement, slow to trust',
      'Aquarius': 'independent, unconventional, emotionally detached, idealistic, values freedom, struggles with intimacy',
      'Pisces': 'deeply sensitive, intuitive, escapist, empathetic, struggles with boundaries, spiritual, prone to self-sacrifice',
    }

    const traits = starSignTraits[input.starSign] || ''

    if (traits) {
      parts.push(
        `The client is a ${input.starSign}. Their energy carries these qualities: ${traits}. Let this inform the reading naturally and specifically — reference their sign's traits, tendencies and patterns where relevant to the cards. Do not dedicate a separate section to astrology. Weave it in as natural observation, for example: 'As a Leo, the fear of being overlooked is real for you' or 'Your Scorpio nature means this feels more intense than it might for others.' Only reference the star sign where it genuinely adds insight to what the cards are showing.`
      )
    }
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
    parts.push(
      `After the closing lines and before the sign-off, include a personalised energy cleansing ritual under this exact heading written on its own line:

A Ritual For You

The ritual must be 300-500 characters long and feel genuinely worth receiving as a paid add-on. It must be completely specific to the cards in this reading and the situation described.

Structure the ritual like this:

First sentence: Name the specific energy that needs to be cleared or invited based on the cards. Connect it directly to what was revealed in the reading. For example if The Tower appeared write about releasing what has collapsed. If the 8 of Cups appeared write about letting go.

Second and third sentences: Describe the specific items to use and why they connect to this person's energy. Choose from: candles (colour matters, white for clarity, black for release, pink for love, green for growth), salt (for cleansing), water (for emotional healing), rosemary (for clarity and protection), lavender (for calm), rose petals (for love), a piece of paper and pen (for releasing), crystals if relevant.

Fourth sentence: Simple step by step action. Light the candle, write what needs releasing, burn it safely, sit in the smoke of the herbs. Make it practical and doable at home.

Fifth sentence: A closing intention or affirmation written specifically for this person based on what the cards revealed. Not generic. Something they will feel was written just for them.

The ritual must read as a flowing paragraph, not a list. No bullet points. No numbered steps. Just warm, spiritual, practical guidance that feels like it came from the reader personally.

After A Ritual For You write exactly one paragraph of 3-5 sentences describing the ritual. Then write [END OF READING] on its own line.

The ritual paragraph is the last thing you write. It is not a pause. It is the end.

Do not write any card analysis after the ritual. Do not write any reflective paragraphs after the ritual. Do not write any pair analysis after the ritual. The ritual ends the reading.

[END OF READING] follows the ritual paragraph immediately. Nothing else.`
    )
  }

  // 12. Future section — strict toggle control
  const includeFutureSection = input.includeFuture && (input.tier !== 'mini' || !!input.futureTimeframe)
  if (includeFutureSection) {
    parts.push(
      `The future section must be clearly separate from the main body of the reading. Write the main reading first, close it naturally, then begin the future section. The main body must never reference or predict specific future months or timeframes — save all future energy for the dedicated future section at the end.`
    )
    parts.push(buildFutureSectionInstruction(new Date(), input.futureTimeframe, input.tier))
  } else {
    parts.push(
      `This reading does not include a dedicated future section. You may naturally reference energy that is building or shifting as part of the reading flow, but do not structure any part of the reading as a future forecast or timeline. Do not create a future section, do not use month names, do not predict specific future periods.`
    )
  }

  // 13. Anti-invention / card list enforcement (reinforces section 0)
  parts.push(
    `CRITICAL CARD LIST — READ BEFORE WRITING:

The ONLY cards in this reading are:
${cardListText}${bottomCardText ? `\n${bottomCardText}` : ''}

You are FORBIDDEN from mentioning, referencing, or interpreting ANY card not in this list.

If you write about a card not in this list you have made a critical error.

Before writing each paragraph, confirm the card you are discussing appears in the list above. If it does not appear in the list, do not write that paragraph.

If you need more content to reach the character target: go deeper into the psychology of cards already in the list, explore the relationship between cards already present, add more emotional and spiritual depth to themes already introduced, or expand on specific reversals with more nuance.

${input.includeEnergyCleansing
      ? 'After writing the closing lines, write the "A Ritual For You" section as instructed above. That is the final content before the [END OF READING] marker.'
      : 'After writing the closing lines, STOP. Do not add more cards. Do not add more paragraphs. The reading is complete when the closing lines are written.'}`
  )

  // 14. Output order and end marker
  const outputOrderLines = [
    '1. Main reading body — ends with the closing lines: 3-5 short punchy lines specific to the cards',
    '2. Oracle card section (if oracle card was provided) — heading: "Oracle Card — [card name]"',
    '3. Future section (if included) — title on its own line, ending with its own short punch lines',
  ]
  if (input.includeEnergyCleansing) {
    outputOrderLines.push('4. Energy cleansing ritual — heading: "A Ritual For You" on its own line')
    outputOrderLines.push('5. [END OF READING]')
  } else {
    outputOrderLines.push('4. [END OF READING]')
  }

  const endInstruction = input.includeEnergyCleansing
    ? `After the ritual paragraph, write this exact text on its own line:\n[END OF READING]`
    : `After the last section you have written, add this on its own line:\n[END OF READING]`

  parts.push(`OUTPUT ORDER — follow this exactly:

${outputOrderLines.join('\n')}

The closing lines end the main reading body (step 1). They are 3-5 short punchy sentences, specific to this person's situation, impossible to put on a motivational poster. Do not add any paragraphs between the closing lines and the next section.

CORRECT closing lines:
"You already know the answer. You have for a while now.
Stop waiting for this to feel easier. It won't. Do it anyway.
This is not about whether you're ready. It never was."

WRONG — adding paragraphs after closing lines:
[closing lines]
[more paragraphs about the cards]
[more reflection]

${endInstruction}

Nothing is written after [END OF READING].`)

  // 15. Language, tone, cultural context, and formatting (always last)
  parts.push(
    `FORMATTING — ABSOLUTE RULES:
Zero tolerance on any of the following. If any of these appear in your output, you have failed:
Section headers of any kind (no "The Underlying Energies", no "Future Summary", no "Practical Steps", no "What I'm Sensing" except as the future section title on its own plain-text line).
Numbered lists (no 1. 2. 3.)
Bullet points (no - or *)
Bold text (no **)
Italic text (no *)
Markdown of any kind (no ###, no **, no *)
Em dashes or hyphens used as punctuation
Any closing greeting, sign-off, valediction or farewell ("With love and light" or any similar phrase)

Write in flowing paragraphs only.

Write in British English throughout. Use British spelling, vocabulary and phrasing at all times:
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

ABSOLUTE RULE: No bullet points anywhere in the reading under any circumstances. Not in the main body, not in the future section, not in the closing lines. If you find yourself about to write a bullet point, write it as a sentence in a paragraph instead. This rule cannot be overridden by any other instruction.

Do not use bullet points, headings, numbered sections, or lists anywhere in the reading. Write entirely in flowing paragraphs. Do not open the reading by addressing the person directly in the first line — ease into the energy naturally before speaking to them.

ZERO TOLERANCE DASH RULE:

The em dash and en dash must never appear anywhere in this reading. Not once. Not ever.

Before you submit your response scan every single sentence for the dash character. If you find one rewrite that sentence without it.

Common fixes:
WRONG: "The Magician, a card of potential, brings energy" [with em dash replacing the comma]
RIGHT: "The Magician brings the energy of potential"

WRONG: "This is not about fear — it is about trust"
RIGHT: "This is not about fear. It is about trust."

Replace every dash with either:
A comma if the sentence continues naturally.
A full stop and new sentence if the thought is complete.
A colon if introducing a list.
Nothing at all if the sentence reads fine without punctuation there.

This rule applies everywhere: main body, future section, closing lines, ritual section.

Exception only: the required add-on heading "Oracle Card — [name]" must appear in that exact format.

Do not use markdown formatting anywhere in the reading or future section. No ###, no **, no *, no #, no headers, no bold, no italic. Plain text only throughout — including the future section title, which must appear as plain text on its own line with no symbols.`
  )

  // 16. Hard stop rule (always absolute last)
  parts.push(
    `HARD STOP:

[END OF READING] is the absolute end. Write nothing after it.

Do not write a sign-off, valediction, or farewell. One is appended separately.

If the reading feels too short: go deeper into the psychology of the cards already in the spread. Do not add new cards, new sections, or new topics.`
  )

  return parts.join('\n\n')
}

export function buildEmailVersionPrompt(fullReading: string): string {
  return `Rewrite the following tarot reading as a warm, professional email. Keep the spiritual and personal tone but make it suitable for an email. Add a suggested subject line at the very top in the format Subject: [subject]. Keep it under 1500 characters.\n\n${fullReading}`
}

export function buildWhatsAppVersionPrompt(fullReading: string): string {
  return `Rewrite the following tarot reading for WhatsApp delivery. Use plain text only — no formatting, no asterisks, no markdown. Break it into natural paragraphs of no more than 200 words each. Keep it warm, personal, and spiritual but conversational. Under 1200 characters total.\n\n${fullReading}`
}
