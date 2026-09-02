-- Add soft-delete and "skip this day" support to daily_messages.
-- Run these statements in the Supabase SQL editor (or via `supabase db push`).

ALTER TABLE daily_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE daily_messages ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_daily_messages_deleted_at ON daily_messages (deleted_at) WHERE deleted_at IS NOT NULL;

-- The public fetch endpoint's anon read policy must also exclude soft-deleted
-- rows, so a deleted "approved" message for today can never be fetched.
DROP POLICY IF EXISTS "anon_select_approved_daily_messages" ON daily_messages;
CREATE POLICY "anon_select_approved_daily_messages" ON daily_messages
  FOR SELECT TO anon
  USING (approved = true AND deleted_at IS NULL);
