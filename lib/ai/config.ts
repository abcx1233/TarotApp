export const AI_CONFIG = {
  baseURL: 'https://api.groq.com/openai/v1',
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  maxTokens: 5000,
  temperature: 0.85,
} as const

export const READING_CHARACTER_TARGETS: Record<string, number> = {
  mini: 3000,
  core: 6000,
  premium: 12000,
  celtic_cross: 5000,
}

export const EMAIL_VERSION_MAX_CHARS = 1500
export const WHATSAPP_VERSION_MAX_CHARS = 1200
export const WHATSAPP_CHUNK_MAX_WORDS = 200
