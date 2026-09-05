import { type DeterministicAuditInput, runDeterministicChecks } from './deterministic'
import { type ModelAuditInput, runModelChecks } from './model'
import {
  AUDIT_CHECK_ORDER,
  type AuditCheck,
  type AuditResult,
  scoreToBand,
} from './types'

export * from './types'
export { mainBodyLength } from './deterministic'

export type AuditInput = DeterministicAuditInput & ModelAuditInput

/**
 * Audit a finished reading.
 *
 * Deterministic checks always run and never throw. The single model call is
 * attempted after them; if it fails, its two checks come back 'skipped' and the
 * result is marked degraded rather than quietly scoring as clean.
 *
 * The caller is still expected to wrap this — a reading that generated fine must
 * save even if auditing it goes wrong.
 */
export async function auditReading(input: AuditInput): Promise<AuditResult> {
  const deterministic = runDeterministicChecks(input)
  const [relevance, voice] = await runModelChecks(input)

  const byId = new Map<string, AuditCheck>()
  for (const check of [...deterministic, relevance, voice]) byId.set(check.id, check)

  const checks = AUDIT_CHECK_ORDER.map((id) => byId.get(id)).filter(
    (c): c is AuditCheck => c !== undefined
  )

  const deducted = checks.reduce((sum, c) => sum + c.penalty, 0)
  const score = Math.max(0, Math.min(100, 100 - deducted))

  return {
    score,
    band: scoreToBand(score),
    degraded: checks.some((c) => c.status === 'skipped'),
    checks,
    generatedAt: new Date().toISOString(),
  }
}
