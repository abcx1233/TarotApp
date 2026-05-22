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
  groqModel: string
}

export async function generateFullReading(
  promptInput: PromptInput
): Promise<GenerationResult> {
  const generatedPrompt = buildPrompt(promptInput)

  let generatedReading: string
  try {
    generatedReading = await chatComplete(
      'You are an expert tarot reader and spiritual guide. Follow the instructions precisely.',
      generatedPrompt,
      AI_CONFIG.maxTokens
    )
  } catch (err) {
    throw new GroqGenerationError('Failed to generate the main reading', err)
  }

  return {
    generatedReading,
    generatedPrompt,
    groqModel: AI_CONFIG.model,
  }
}
