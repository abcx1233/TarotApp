import type { ReadingTier } from '@/types'

export interface TonePresetDefinition {
  name: string
  description: string
  promptText: string
  defaultForTiers: ReadingTier[]
}

export const TONE_PRESETS: TonePresetDefinition[] = [
  {
    name: 'Intuitive & Personal',
    description: 'Soft, flowing, spiritual. Soul-to-soul conversation. Default for Mini and Core readings.',
    defaultForTiers: ['mini', 'core'],
    promptText: `Write a deeply intuitive, emotionally intelligent tarot/psychic reading in my tone — soft, flowing, spiritual, honest and personal. The reading should feel like a conversation from soul to soul, not robotic or overly formal. Blend tarot interpretation, clairvoyant insight, energy reading and channeled emotions naturally together.

My writing style is warm, comforting and emotionally immersive. Highly intuitive and reflective. Poetic without trying too hard. Honest about both light and shadow. Focused on energy shifts, emotions, timing and soul connections. Written as though I am directly tuning into someone's energy in real time. Gentle but direct when needed. Deeply validating without sounding cliché.

The reading should flow naturally from one point to the next instead of sounding like separate card meanings. Include emotional depth and specific energetic observations. Feel personal, spiritual and slightly mystical. Use phrases about energy, intuition, soul ties, emotional blocks, divine timing, inner knowing, healing, alignment and transformation. Mention what someone may be feeling internally even if they are not expressing it outwardly. Include subtle predictive energy and possible future outcomes without sounding absolute. Feel reassuring and insightful rather than generic.

Avoid overly theatrical fortune teller language. Avoid bullet points or rigid structure. Avoid repeating tarot definitions mechanically. Avoid generic advice that could apply to anyone. Avoid sounding AI-generated or overly polished.

Write in a way that sounds like it genuinely came from me — emotionally aware, spiritually connected and naturally flowing. The reading should feel immersive, as though the person receiving it feels completely seen and understood.`,
  },
  {
    name: 'Deep Dive & Psychological',
    description: 'Detailed, layered, immersive. Psychological depth. Default for Premium and Celtic Cross readings.',
    defaultForTiers: ['premium', 'celtic_cross'],
    promptText: `Write a deeply detailed tarot reading in a natural flowing style that feels intuitive, emotionally layered, immersive, and personal. Avoid short interpretations or rigid card-by-card definitions. Blend the meanings of the cards together into a connected narrative that flows naturally from beginning to end.

Focus heavily on emotional depth, subconscious patterns, relationships, personal transformation, timing, fears, desires, internal conflict, healing, and spiritual lessons. Make the reading feel reflective and psychologically insightful rather than overly generic or overly positive. Include both shadow aspects and hopeful outcomes with balance and realism.

Write in long-form paragraphs with smooth transitions between themes. Avoid bullet points, headings, numbered sections, or dashes. Keep the tone warm, intuitive, honest, and conversational, like a professional reader channeling insight directly to the person receiving it.

Interpret reversals seriously and explore emotional blockages, avoidance, miscommunication, delays, karmic cycles, or resistance to change when relevant. Highlight repeating themes, mirrored energies, and emotional contradictions within the spread.

Where appropriate, discuss love and relationships, emotional wounds, personal growth, communication, career and finances, family dynamics, spiritual awakening, future possibilities, hidden truths, energy shifts and endings and new beginnings.

Make the reading feel cohesive instead of isolated card meanings. Build tension and release throughout the interpretation so it reads almost like a story unfolding emotionally and spiritually.

End with a strong concluding paragraph that ties the entire reading together with clarity, insight, and emotional resonance.`,
  },
]

export function getDefaultTonePresetForTier(tier: ReadingTier): TonePresetDefinition {
  const match = TONE_PRESETS.find((p) => p.defaultForTiers.includes(tier))
  return match ?? TONE_PRESETS[0]
}
