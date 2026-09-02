// Server-side only — called from route handlers
import { chatComplete } from './client'
import {
  buildPrompt,
  type PromptInput,
} from './prompts/builder'
import { buildDailyMessagePrompt } from './prompts/daily-message'
import { GroqGenerationError } from './errors'
import { AI_CONFIG } from './config'
import type { CardOrientation } from '@/types'

export interface GenerationResult {
  generatedReading: string
  generatedPrompt: string
  aiModel: string
}

export async function generateFullReading(
  promptInput: PromptInput,
  maxTokens?: number
): Promise<GenerationResult> {
  const generatedPrompt = buildPrompt(promptInput)
  const tokensToUse = maxTokens ?? AI_CONFIG.maxTokens

  console.log('[generate] Prompt length (chars):', generatedPrompt.length)
  console.log('[generate] Prompt length (approx tokens):', Math.round(generatedPrompt.length / 4))
  console.log('[generate] Max tokens:', tokensToUse)

  let generatedReading: string
  try {
    generatedReading = await chatComplete(
      'You are an expert tarot reader and spiritual guide. Follow the instructions precisely.',
      generatedPrompt,
      tokensToUse
    )
  } catch (err) {
    console.error('[generate] Groq API error:', err)
    console.error('[generate] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err instanceof Error ? err : {})))
    throw new GroqGenerationError('Failed to generate the main reading', err)
  }

  return {
    generatedReading,
    generatedPrompt,
    aiModel: AI_CONFIG.model,
  }
}

const DAILY_MESSAGE_MAX_TOKENS = 700

export async function generateDailyCardMessage(
  cardName: string,
  orientation: CardOrientation
): Promise<GenerationResult> {
  const generatedPrompt = buildDailyMessagePrompt(cardName, orientation)

  console.log('[generate] Daily message prompt length (chars):', generatedPrompt.length)

  let generatedReading: string
  try {
    generatedReading = await chatComplete(
      'You are an expert tarot reader writing a short, warm daily broadcast message. Follow the instructions precisely.',
      generatedPrompt,
      DAILY_MESSAGE_MAX_TOKENS
    )
  } catch (err) {
    console.error('[generate] Daily message generation error:', err)
    throw new GroqGenerationError('Failed to generate the daily card message', err)
  }

  return {
    generatedReading,
    generatedPrompt,
    aiModel: AI_CONFIG.model,
  }
}
