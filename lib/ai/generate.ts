// Server-side only — called from route handlers
import { chatComplete } from './client'
import {
  buildPrompt,
  type PromptInput,
} from './prompts/builder'
import { GroqGenerationError } from './errors'
import { AI_CONFIG } from './config'

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
