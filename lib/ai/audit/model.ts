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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * One alternation over every unconditional banned phrase, longest first so that
 * "not just about" wins over "not just". Anchored on a leading word boundary
 * only — a trailing one would miss "unpacking" for a ban on "unpack".
 */
const BANNED_PHRASE_RE = new RegExp(
  `\\b(?:${BANNED_PHRASES.map(escapeRegExp).join('|')})`,
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

/**
 * Delimiters treated as quote marks when pulling cited evidence out of the
 * model's own reason text: straight and curly double quotes only.
 *
 * Single quotes of every kind are deliberately excluded. The plain apostrophe
 * (') and the curly right single quote (’) are both the apostrophe in ordinary
 * English — "doesn’t", "the client’s" — so pairing on either spans from one
 * contraction to the next and captures garbage like "t speak to the client".
 * The curly left single quote (‘) goes too: with its closing partner excluded
 * it would only ever pair with another opener. A reason that cites evidence in
 * single quotes is therefore treated as unquoted and passed through unchanged,
 * which is the safe direction — the claim is kept, never discarded.
 */
const QUOTED_PHRASE_RE = /["\u201C\u201D]([^"\u201C\u201D]{1,80})["\u201C\u201D]/g

function cleanQuotedPhrase(phrase: string): string {
  return phrase.trim().replace(/^[.,;:!?]+/, '').replace(/[.,;:!?]+$/, '').trim()
}

/**
 * Fold every apostrophe style onto the plain one, so "you're" in the model's
 * reason and "you’re" in the reading compare equal. Applied to both sides.
 */
function normalizeApostrophes(text: string): string {
  return text.replace(/[\u2018\u2019\u02BC]/g, "'")
}

/**
 * Words shorter than this must match exactly. Suffix tolerance on short words
 * is where false matches come from: "she" + "d" is "shed", "he" + "r" is "her".
 */
const MIN_STEM_LENGTH = 4

/**
 * Pattern for one word of a quoted phrase, tolerating plain suffix variation so
 * a reason citing "navigate" still verifies against "navigating" in the text.
 *
 * Not real stemming, just the regular English endings: -s, -es, -ed, -er, -ers,
 * -ing, with a trailing silent "e" allowed to drop (navigate → navigating,
 * navigated, navigates). Only applied to all-letter words of MIN_STEM_LENGTH or
 * more; anything else (short words, contractions) must match exactly. The
 * caller's word boundaries still apply after the suffix, so "navigate" does not
 * verify against "navigational".
 */
function wordPattern(word: string): string {
  if (word.length < MIN_STEM_LENGTH || !/^[a-z]+$/i.test(word)) return escapeRegExp(word)
  if (/e$/i.test(word)) return `${escapeRegExp(word.slice(0, -1))}(?:e(?:s|d|r|rs)?|e?ing)`
  return `${escapeRegExp(word)}(?:s|es|ed|er|ers|ing)?`
}

// Letters and digits in any script. Built with the RegExp constructor rather
// than a literal because the project's TS target predates the `u` flag.
const WORD_CHAR = '[\\p{L}\\p{N}]'

/**
 * Whether a quoted phrase genuinely appears in `text`: case-insensitive, with
 * apostrophe styles folded together, matched on whole words (so "she" is not
 * found inside "wished" or "shed"), any run of whitespace between words, and
 * plain suffix variation per wordPattern().
 */
export function phraseAppearsIn(phrase: string, text: string): boolean {
  const words = normalizeApostrophes(phrase).split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  const pattern = `(?<!${WORD_CHAR})${words.map(wordPattern).join('\\s+')}(?!${WORD_CHAR})`
  return new RegExp(pattern, 'iu').test(normalizeApostrophes(text))
}

/** Every distinct quoted phrase in `text`, in order, de-duplicated case-insensitively. */
export function extractQuotedPhrases(text: string): string[] {
  const seen: Record<string, true> = {}
  const phrases: string[] = []
  QUOTED_PHRASE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = QUOTED_PHRASE_RE.exec(text)) !== null) {
    const phrase = cleanQuotedPhrase(match[1])
    const key = normalizeApostrophes(phrase).toLowerCase()
    if (phrase.length >= 2 && !seen[key]) {
      seen[key] = true
      phrases.push(phrase)
    }
  }
  return phrases
}

/**
 * Ground the model's voice-drift reason against the text it is supposedly
 * describing, before that reason ever reaches Rhiannon.
 *
 * The model sometimes cites a specific phrase as evidence — "navigate",
 * "spiritual growth" — for a failure when that phrase is not actually in the
 * reading. This matters most for the five conditionally-banned phrases (see
 * SYSTEM_PROMPT item 2b): those are judged by the model rather than grepped
 * in code, precisely because "banned only when used metaphorically" isn't a
 * substring test, which also means the model can assert one exists when it
 * doesn't. A hallucinated quote shown as a check's reason is worse than no
 * check at all — it sends Rhiannon looking for text that was never written.
 *
 * A reason that cites no quoted phrase is passed through unchanged: there is
 * nothing concrete to verify, and third-person slippage in particular is
 * often better described than quoted. A reason that cites quotes has each one
 * checked against the final text with phraseAppearsIn(); any that don't verify
 * are dropped. If every cited phrase turns out to be fabricated, the claim
 * itself is unsupported and this returns null — the caller must not fail the
 * check on an ungrounded reason, and must record that it discarded one (see
 * resolveVoiceCheck).
 */
export function groundModelReason(reason: string, finalText: string): string | null {
  const quoted = extractQuotedPhrases(reason)
  if (quoted.length === 0) return reason

  const verified = quoted.filter((phrase) => phraseAppearsIn(phrase, finalText))

  if (verified.length === 0) return null
  if (verified.length === quoted.length) return reason

  // Partial hit: rebuild around only what verified rather than leave the
  // model's original sentence pointing at a phrase that isn't there.
  return `Voice drift: ${verified.map((p) => `"${p}"`).join(', ')} found in the reading.`
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

export interface ModelVerdict {
  pass: boolean
  reason?: string
}

/**
 * The voice check, given the model's verdict and any banned phrases found in
 * code. Kept out of runModelChecks so it can be tested without a model call.
 *
 * The model's own claim is grounded before it can fail the check. A claim whose
 * quotes don't verify comes back null and is dropped, rather than shown to
 * Rhiannon as an ungrounded reason. Code-detected banned phrases are unaffected:
 * those are already grounded by construction.
 *
 * Dropping or rewriting a claim is never silent. The model's original wording is
 * kept on the check as `unverifiedReason`, which is saved in readings.audit_checks
 * with the rest of the result, and a warning is logged. A discarded claim still
 * lifts the score by the voice penalty, so it has to be findable afterwards.
 */
export function resolveVoiceCheck(
  verdict: ModelVerdict,
  bannedReason: string | null,
  finalText: string
): AuditCheck {
  const claimed = verdict.pass ? null : verdict.reason || 'Voice drifts out of direct address.'
  const grounded = claimed === null ? null : groundModelReason(claimed, finalText)

  const check =
    grounded || bannedReason
      ? fail('voice_drift', [grounded, bannedReason].filter(Boolean).join(' '))
      : pass('voice_drift')

  if (claimed !== null && grounded !== claimed) {
    check.unverifiedReason = claimed
    console.warn(
      `[audit] voice_drift: ${grounded === null ? 'discarded' : 'rewrote'} a model claim ` +
        `quoting text not found in the reading. Original reason: ${JSON.stringify(claimed)}`
    )
  }

  return check
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
    voice = resolveVoiceCheck(verdicts.voice, bannedReason, input.finalText)
  } else if (bannedReason) {
    voice = fail('voice_drift', bannedReason)
  } else {
    voice = skipped('voice_drift', failureReason)
  }

  return [relevance, voice]
}
