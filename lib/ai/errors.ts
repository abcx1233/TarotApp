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

export function formatAiError(error: unknown): string {
  if (error instanceof GroqConfigError) {
    return `Configuration error: ${error.message}`
  }
  if (error instanceof GroqGenerationError) {
    return `Generation failed: ${error.message}`
  }
  if (error instanceof Error) {
    // Sanitise — don't expose internal details to client
    if (error.message.includes('API key')) return 'AI service is not configured.'
    if (error.message.includes('rate limit')) return 'Rate limit reached. Please wait a moment and try again.'
    if (error.message.includes('timeout')) return 'The request timed out. Please try again.'
    return 'An error occurred during generation. Please try again.'
  }
  return 'An unexpected error occurred.'
}
