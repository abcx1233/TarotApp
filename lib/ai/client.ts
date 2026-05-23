import OpenAI from 'openai'
import { AI_CONFIG } from './config'

// This module is server-side only — never import from client components
let openaiClient: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Add it to your .env.local file.'
    )
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  return openaiClient
}

export async function chatComplete(
  systemPrompt: string,
  userMessage: string,
  maxTokens?: number
): Promise<string> {
  const client = getOpenAIClient()

  const completion = await client.chat.completions.create({
    model: AI_CONFIG.model,
    max_tokens: maxTokens ?? AI_CONFIG.maxTokens,
    temperature: AI_CONFIG.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response')
  return content
}
