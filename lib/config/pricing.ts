export const ADDON_PRICES = {
  oracle_card: 10,
  rush_24h: 10,
  extra_question: 6,
  energy_cleansing: 8,
  follow_up: 5,
} as const

export type AddonKey = keyof typeof ADDON_PRICES

export const READING_PRICES: Record<string, Record<string, number | null>> = {
  mini:         { written: 10,  voice_note: 15,   video: 20   },
  core:         { written: 25,  voice_note: 35,   video: 45   },
  premium:      { written: 45,  voice_note: 55,   video: 65   },
  celtic_cross: { written: 10,  voice_note: null, video: null },
}
