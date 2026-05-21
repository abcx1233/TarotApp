import OpenAI from 'openai'
import { AI_CONFIG } from './config'

// This module is server-side only — never import from client components
let groqClient: OpenAI | null = null

export function getGroqClient(): OpenAI {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      'GROQ_API_KEY is not configured. Add it to your .env.local file.'
    )
  }

  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: AI_CONFIG.baseURL,
    })
  }

  return groqClient
}

export async function chatComplete(
  systemPrompt: string,
  userMessage: string,
  maxTokens?: number
): Promise<string> {
  const client = getGroqClient()

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
  if (!content) throw new Error('Groq returned an empty response')
  return content
}
