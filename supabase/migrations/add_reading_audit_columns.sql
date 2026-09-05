-- Post-generation audit results for readings.
--
-- Written by POST /api/readings/generate immediately after the final text
-- (sign-off and disclaimer appended) is assembled, and read by OutputPanel to
-- show Rhiannon what to look at before she reviews.
--
-- All three columns are nullable with no default: readings generated before
-- this feature, and any reading whose audit failed to run, legitimately have no
-- audit. NULL audit_score means "not audited", which the UI renders as absent
-- rather than as a zero score.
--
-- No existing column is touched.

ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS audit_score        integer,
  ADD COLUMN IF NOT EXISTS audit_checks       jsonb,
  ADD COLUMN IF NOT EXISTS audit_generated_at timestamptz;

COMMENT ON COLUMN public.readings.audit_score IS
  'Post-generation audit score, 0-100. 100 minus the penalty of each failed check. NULL = not audited. Bands: green >= 90, amber 70-89, red < 70.';

COMMENT ON COLUMN public.readings.audit_checks IS
  'Full AuditResult as JSON: { score, band, degraded, checks[], generatedAt }. Each check carries id, label, status (pass|fail|n-a|skipped), penalty and an optional reason. See lib/ai/audit/types.ts.';

COMMENT ON COLUMN public.readings.audit_generated_at IS
  'When the audit ran. Distinct from readings.updated_at so a later hand-edit of generated_reading is visibly newer than the audit that assessed it.';

-- Score is a percentage or absent; anything else means a scoring bug reached the
-- database. Named so a violation points straight at the audit code.
ALTER TABLE public.readings
  DROP CONSTRAINT IF EXISTS readings_audit_score_range;

ALTER TABLE public.readings
  ADD CONSTRAINT readings_audit_score_range
  CHECK (audit_score IS NULL OR (audit_score >= 0 AND audit_score <= 100));

-- Partial index: the review queue only ever filters for readings that scored
-- badly, and those are the minority, so indexing the rest wastes writes.
CREATE INDEX IF NOT EXISTS readings_audit_score_flagged_idx
  ON public.readings (audit_score)
  WHERE audit_score IS NOT NULL AND audit_score < 90;
