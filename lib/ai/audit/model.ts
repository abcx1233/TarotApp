import { chatComplete } from '@/lib/ai/client'
import { BANNED_PHRASES } from './banned-phrases'
import { type AuditCheck, fail, pass, skipped } from './types'

export interface ModelAuditInput {
  finalText: string
  topic: string
  questionOrFocus?: string | null
  /** From the Extra Question add-on. */
  specificQuestion?: string | null
}

/**
 * One alternation over every unconditional banned phrase, longest first so that
 * "not just about" wins over "not just". Anchored on a leading word boundary
 * only — a trailing one would miss "unpacking" for a ban on "unpack".
 */
const BANNED_PHRASE_RE = new RegExp(
  `\\b(?:${BANNED_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'gi'
)

function findBannedPhrases(text: string): string[] {
  // exec/while rather than matchAll + Set: the project's TS target predates
  // ES2015 iterators, so neither is iterable here.
  const seen: Record<string, true> = {}
  const hits: string[] = []
  BANNED_PHRASE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = BANNED_PHRASE_RE.exec(text)) !== null) {
    const phrase = match[0].toLowerCase()
    if (!seen[phrase]) {
      seen[phrase] = true
      hits.push(phrase)
    }
  }
  return hits
}

const SYSTEM_PROMPT = `You are auditing a finished tarot reading before a human reviews it. You are not rewriting or improving it — you only report what is true about it.

Answer two questions.

1. RELEVANCE. Does the reading actually address the client's stated topic, and where given, their specific question and focus? A reading that discusses the cards competently but never engages the thing they asked about FAILS. A reading that answers the question through the cards, without necessarily restating it, PASSES. Generic spiritual commentary that would fit any client FAILS.

2. VOICE. Two distinct problems, either of which FAILS:
   (a) Third-person slippage. The reading must speak directly to the client as "you" throughout. Referring to them as "the reader", "the client", "she", "he", or "they" is a failure. Quoting another person in the client's life is fine.
   (b) Conditionally banned wording, used in the sense that is banned: "navigate" used metaphorically (navigate your path, navigate this change); "realm" in any spiritual sense; "higher self", "inner child" or "spiritual growth" unless the client themselves used the term. Ordinary literal uses are fine.

Reply with strict JSON and nothing else, in exactly this shape:
{"relevance":{"pass":true,"reason":""},"voice":{"pass":true,"reason":""}}

Set "reason" only when that item fails. Keep each reason under 20 words, plain language, naming the specific problem.`

interface ModelVerdict {
  pass: boolean
  reason?: string
}

function parseVerdicts(raw: string): { relevance: ModelVerdict; voice: ModelVerdict } | null {
  // Models occasionally wrap JSON in a fence despite instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    const read = (v: unknown): ModelVerdict | null => {
      if (!v || typeof v !== 'object') return null
      const o = v as Record<string, unknown>
      if (typeof o.pass !== 'boolean') return null
      return { pass: o.pass, reason: typeof o.reason === 'string' ? o.reason.trim() : undefined }
    }
    const relevance = read(parsed.relevance)
    const voice = read(parsed.voice)
    if (!relevance || !voice) return null
    return { relevance, voice }
  } catch {
    return null
  }
}

/**
 * Checks 6 and 7 — the two that genuinely need judgment.
 *
 * The verbatim half of the voice check is done in code rather than asked of the
 * model: "does this exact phrase appear" is a substring test, and a model is
 * both slower and less reliable at it. The model is left with the parts that
 * actually require reading comprehension — third-person slippage, and the five
 * phrases the style guide bans only in a particular sense. A banned phrase found
 * in code fails the voice check even when the model call itself falls over.
 */
export async function runModelChecks(input: ModelAuditInput): Promise<[AuditCheck, AuditCheck]> {
  const bannedHits = findBannedPhrases(input.finalText)

  const context = [
    `TOPIC: ${input.topic || '(none given)'}`,
    input.questionOrFocus?.trim() ? `FOCUS: ${input.questionOrFocus.trim()}` : null,
    input.specificQuestion?.trim()
      ? `SPECIFIC QUESTION (paid Extra Question add-on — this must be answered): ${input.specificQuestion.trim()}`
      : null,
    '',
    'READING:',
    input.finalText,
  ]
    .filter((l) => l !== null)
    .join('\n')

  let verdicts: { relevance: ModelVerdict; voice: ModelVerdict } | null = null
  let failureReason = ''

  try {
    const raw = await chatComplete(SYSTEM_PROMPT, context, 400)
    verdicts = parseVerdicts(raw)
    if (!verdicts) failureReason = 'Audit model returned an unreadable response.'
  } catch (err) {
    failureReason = `Audit model call failed: ${err instanceof Error ? err.message : 'unknown error'}`
  }

  const relevance: AuditCheck = verdicts
    ? verdicts.relevance.pass
      ? pass('topic_question_relevance')
      : fail(
          'topic_question_relevance',
          verdicts.relevance.reason || 'Does not address the stated topic or question.'
        )
    : skipped('topic_question_relevance', failureReason)

  // Banned phrases are decisive regardless of whether the model answered.
  let voice: AuditCheck
  const bannedReason =
    bannedHits.length > 0
      ? `Banned phrase${bannedHits.length === 1 ? '' : 's'}: ${bannedHits.slice(0, 3).map((p) => `"${p}"`).join(', ')}${bannedHits.length > 3 ? ` and ${bannedHits.length - 3} more` : ''}.`
      : null

  if (verdicts) {
    if (!verdicts.voice.pass || bannedReason) {
      const modelReason = verdicts.voice.pass ? null : verdicts.voice.reason || 'Voice drifts out of direct address.'
      voice = fail('voice_drift', [modelReason, bannedReason].filter(Boolean).join(' '))
    } else {
      voice = pass('voice_drift')
    }
  } else if (bannedReason) {
    voice = fail('voice_drift', bannedReason)
  } else {
    voice = skipped('voice_drift', failureReason)
  }

  return [relevance, voice]
}
