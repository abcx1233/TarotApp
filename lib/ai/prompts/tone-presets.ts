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
    promptText: `Write in a warm, intuitive, emotionally present voice. Soft but direct. Let the cards flow together as a connected experience rather than separate interpretations. Name what this person might be feeling internally even if they haven't expressed it outwardly. Include subtle predictive energy without sounding absolute. Balance shadow and light honestly. The reading should feel personal and spiritually grounded — like someone is actively tuned in, not filing a report.`,
  },
  {
    name: 'Deep Dive & Psychological',
    description: 'Detailed, layered, immersive. Psychological depth. Default for Premium and Celtic Cross readings.',
    defaultForTiers: ['premium', 'celtic_cross'],
    promptText: `Write with psychological depth and layered emotional insight. This is a detailed, immersive reading — go further into the subconscious patterns, fears, desires, internal conflict, and emotional contradictions in this spread. Interpret reversals seriously: name the blockage, avoidance, or resistance with precision. Highlight repeating themes and mirrored energies across the cards. Balance shadow aspects and hopeful outcomes with honesty and realism. Build emotional tension and release throughout so the reading has a strong arc. Cohesive and immersive — one connected narrative, not card-by-card definitions.`,
  },
]

export function getDefaultTonePresetForTier(tier: ReadingTier): TonePresetDefinition {
  const match = TONE_PRESETS.find((p) => p.defaultForTiers.includes(tier))
  return match ?? TONE_PRESETS[0]
}
