// Server-side only — called from route handlers
import { chatComplete } from './client'
import {
  buildPrompt,
  buildEmailVersionPrompt,
  buildWhatsAppVersionPrompt,
  type PromptInput,
} from './prompts/builder'
import { GroqGenerationError } from './errors'
import { AI_CONFIG } from './config'

export interface GenerationResult {
  generatedReading: string
  emailVersion: string
  whatsappVersion: string
  generatedPrompt: string
  groqModel: string
}

export async function generateFullReading(
  promptInput: PromptInput
): Promise<GenerationResult> {
  const generatedPrompt = buildPrompt(promptInput)

  // Step 1: Full reading
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

  // Step 2: Email version
  let emailVersion: string
  try {
    emailVersion = await chatComplete(
      'You are an expert at adapting spiritual content for professional email delivery.',
      buildEmailVersionPrompt(generatedReading),
      1200
    )
  } catch (err) {
    throw new GroqGenerationError('Failed to generate the email version', err)
  }

  // Step 3: WhatsApp version
  let whatsappVersion: string
  try {
    whatsappVersion = await chatComplete(
      'You are an expert at adapting spiritual content for WhatsApp messaging.',
      buildWhatsAppVersionPrompt(generatedReading),
      800
    )
  } catch (err) {
    throw new GroqGenerationError('Failed to generate the WhatsApp version', err)
  }

  return {
    generatedReading,
    emailVersion,
    whatsappVersion,
    generatedPrompt,
    groqModel: AI_CONFIG.model,
  }
}
