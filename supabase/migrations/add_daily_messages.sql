-- Add the daily_messages table for the "Daily Card Message" feature.
-- Run these statements in the Supabase SQL editor (or via `supabase db push`).

CREATE TABLE IF NOT EXISTS daily_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_date      DATE NOT NULL UNIQUE,
  card_name         TEXT NOT NULL,
  card_orientation  card_orientation NOT NULL DEFAULT 'upright',
  generated_text    TEXT,
  final_text        TEXT,
  approved          BOOLEAN NOT NULL DEFAULT false,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_messages_date ON daily_messages (message_date DESC);

DROP TRIGGER IF EXISTS trg_daily_messages_updated_at ON daily_messages;
CREATE TRIGGER trg_daily_messages_updated_at
  BEFORE UPDATE ON daily_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE daily_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_daily_messages" ON daily_messages;
CREATE POLICY "auth_all_daily_messages" ON daily_messages
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- The public fetch endpoint (app/api/daily-message/fetch) is unauthenticated —
-- it gates access with its own DAILY_MESSAGE_FETCH_SECRET check instead of a
-- Supabase session. It runs as the anon role, so it needs its own narrow
-- read policy: approved messages only, never drafts.
DROP POLICY IF EXISTS "anon_select_approved_daily_messages" ON daily_messages;
CREATE POLICY "anon_select_approved_daily_messages" ON daily_messages
  FOR SELECT TO anon
  USING (approved = true);
