export class GroqConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroqConfigError'
  }
}

export class GroqGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'GroqGenerationError'
  }
}

function extractCauseMessage(cause: unknown): string | null {
  if (!cause) return null
  if (cause instanceof Error) {
    const msg = cause.message || ''
    // Groq/OpenAI SDK APIError has a nested error body
    const body = (cause as unknown as Record<string, unknown>).error
    if (body && typeof body === 'object') {
      const bodyMsg = (body as Record<string, unknown>).message
      if (typeof bodyMsg === 'string') return bodyMsg
    }
    return msg || null
  }
  if (typeof cause === 'string') return cause
  return null
}

export function formatAiError(error: unknown): string {
  if (error instanceof GroqConfigError) {
    return `Configuration error: ${error.message}`
  }
  if (error instanceof GroqGenerationError) {
    const causeMsg = extractCauseMessage(error.cause)
    if (causeMsg) {
      if (causeMsg.toLowerCase().includes('rate limit') || causeMsg.includes('429'))
        return 'Rate limit reached — please wait a moment and try again.'
      if (causeMsg.toLowerCase().includes('api key') || causeMsg.includes('401'))
        return 'AI service is not configured correctly.'
      if (causeMsg.toLowerCase().includes('timeout') || causeMsg.includes('408'))
        return 'The request timed out — please try again.'
      if (causeMsg.toLowerCase().includes('context') || causeMsg.includes('413') || causeMsg.includes('too large'))
        return 'The prompt is too large for the model. Try reducing the reading length or removing some add-ons.'
      if (causeMsg.toLowerCase().includes('empty response') || causeMsg.toLowerCase().includes('empty'))
        return 'The AI returned an empty response — please try again.'
      // Surface the real Groq error message for other cases
      return `Generation failed: ${causeMsg}`
    }
    return `Generation failed: ${error.message}`
  }
  if (error instanceof Error) {
    if (error.message.includes('API key')) return 'AI service is not configured.'
    if (error.message.includes('rate limit')) return 'Rate limit reached. Please wait a moment and try again.'
    if (error.message.includes('timeout')) return 'The request timed out. Please try again.'
    return `An error occurred during generation: ${error.message}`
  }
  return 'An unexpected error occurred.'
}
