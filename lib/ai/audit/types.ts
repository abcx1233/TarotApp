/**
 * Post-generation audit of a finished reading.
 *
 * This runs AFTER the final text (sign-off and disclaimer appended) exists and
 * reads that output. It never influences how the reading is produced — the
 * generation, continuation and truncation logic is untouched by design.
 */

export type AuditCheckStatus =
  | 'pass'
  | 'fail'
  /** Not applicable — e.g. an add-on check when that add-on was not ordered. */
  | 'n-a'
  /**
   * Could not be evaluated. Only the model-based checks can land here, when the
   * audit's OpenAI call fails. Distinct from 'pass' on purpose: a check that
   * never ran must never read as a clean one.
   */
  | 'skipped'

export type AuditCheckId =
  | 'card_hallucination'
  | 'card_omission'
  | 'addon_oracle'
  | 'addon_energy_cleansing'
  | 'length'
  | 'signoff_disclaimer'
  | 'stray_dashes'
  | 'topic_question_relevance'
  | 'voice_drift'

/**
 * Points deducted from 100 when a check fails. A deduction model is used rather
 * than a weighted average of passes so that 'n-a' checks cost nothing and do not
 * silently re-weight the others: a clean reading scores exactly 100 whether or
 * not it had add-ons, and a hallucinated card always costs the same 45.
 *
 * Tuned so that the two client-facing failures (a card that was never drawn, a
 * paid add-on that isn't there) each land in the red band on their own, and no
 * combination of softer failures can mask one. Every single failure, including
 * the mildest, drops out of green — green means zero failures, so the badge is
 * worth looking at.
 */
export const AUDIT_PENALTIES: Record<AuditCheckId, number> = {
  card_hallucination: 45,
  addon_oracle: 40,
  addon_energy_cleansing: 40,
  topic_question_relevance: 20,
  card_omission: 15,
  length: 15,
  signoff_disclaimer: 12,
  stray_dashes: 12,
  voice_drift: 12,
}

export const AUDIT_LABELS: Record<AuditCheckId, string> = {
  card_hallucination: 'Card fidelity',
  card_omission: 'All drawn cards used',
  addon_oracle: 'Oracle card section',
  addon_energy_cleansing: 'Energy cleansing ritual',
  length: 'Length vs target',
  signoff_disclaimer: 'Sign-off & disclaimer',
  stray_dashes: 'No stray dashes',
  topic_question_relevance: 'Answers the question',
  voice_drift: 'Voice & tone',
}

/** Display order in the checklist: deterministic first, then model-based. */
export const AUDIT_CHECK_ORDER: readonly AuditCheckId[] = [
  'card_hallucination',
  'card_omission',
  'addon_oracle',
  'addon_energy_cleansing',
  'length',
  'signoff_disclaimer',
  'stray_dashes',
  'topic_question_relevance',
  'voice_drift',
]

export interface AuditCheck {
  id: AuditCheckId
  label: string
  status: AuditCheckStatus
  /** Points actually deducted — the penalty when failed, otherwise 0. */
  penalty: number
  /** Short plain-language explanation. Set on 'fail', and on 'skipped'. */
  reason?: string
}

export type AuditBand = 'green' | 'amber' | 'red'

export interface AuditResult {
  score: number
  band: AuditBand
  /**
   * True when at least one check could not be evaluated, so the score is an
   * upper bound rather than a verdict. Surfaced distinctly in the UI — an
   * incomplete audit must not present as a clean one.
   */
  degraded: boolean
  checks: AuditCheck[]
  generatedAt: string
}

export function scoreToBand(score: number): AuditBand {
  if (score >= 90) return 'green'
  if (score >= 70) return 'amber'
  return 'red'
}

export function pass(id: AuditCheckId): AuditCheck {
  return { id, label: AUDIT_LABELS[id], status: 'pass', penalty: 0 }
}

export function fail(id: AuditCheckId, reason: string): AuditCheck {
  return { id, label: AUDIT_LABELS[id], status: 'fail', penalty: AUDIT_PENALTIES[id], reason }
}

export function notApplicable(id: AuditCheckId): AuditCheck {
  return { id, label: AUDIT_LABELS[id], status: 'n-a', penalty: 0 }
}

export function skipped(id: AuditCheckId, reason: string): AuditCheck {
  return { id, label: AUDIT_LABELS[id], status: 'skipped', penalty: 0, reason }
}
