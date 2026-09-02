-- ─── Reader Console — Supabase Schema ─────────────────────────────────────────
-- Run this in your Supabase SQL editor to set up the full database.
-- Tables, enums, RLS, triggers, and seed data are all included.

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE order_status AS ENUM (
  'pending',
  'in_progress',
  'awaiting_review',
  'sent',
  'archived'
);

CREATE TYPE reading_tier AS ENUM (
  'mini',
  'core',
  'premium',
  'celtic_cross'
);

CREATE TYPE delivery_format AS ENUM (
  'written',
  'voice_note',
  'video'
);

CREATE TYPE delivery_channel AS ENUM (
  'email',
  'whatsapp',
  'account'
);

CREATE TYPE addon_type AS ENUM (
  'extra_question',
  'rush_24h',
  'oracle_card',
  'energy_cleansing',
  'follow_up'
);

CREATE TYPE card_orientation AS ENUM (
  'upright',
  'reversed'
);

-- ─── Tables ───────────────────────────────────────────────────────────────────

-- clients
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  birthday        DATE,
  star_sign       TEXT,
  instagram_handle TEXT,
  general_notes   TEXT,
  relationship_context TEXT,
  is_returning    BOOLEAN NOT NULL DEFAULT false,
  total_spent     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_test         BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_email ON clients (email);
CREATE INDEX idx_clients_full_name ON clients (full_name);

-- orders
CREATE TABLE orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID REFERENCES clients (id) ON DELETE SET NULL,
  source               TEXT DEFAULT 'manual',
  source_order_id      TEXT,
  reading_tier         reading_tier NOT NULL DEFAULT 'core',
  topic                TEXT NOT NULL DEFAULT 'General',
  delivery_format      delivery_format NOT NULL DEFAULT 'written',
  delivery_channel     delivery_channel NOT NULL DEFAULT 'email',
  status               order_status NOT NULL DEFAULT 'pending',
  price_total          NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_rush              BOOLEAN NOT NULL DEFAULT false,
  due_at               TIMESTAMPTZ,
  internal_notes       TEXT,
  sent_at              TIMESTAMPTZ,
  gmail_send_status    TEXT,
  website_sync_status  TEXT,
  is_test              BOOLEAN NOT NULL DEFAULT false,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_client_id ON orders (client_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_due_at ON orders (due_at);
CREATE INDEX idx_orders_is_rush ON orders (is_rush);

-- order_addons
CREATE TABLE order_addons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  addon_type  addon_type NOT NULL,
  addon_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  addon_notes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_addons_order_id ON order_addons (order_id);

-- tone_presets
CREATE TABLE tone_presets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  description        TEXT,
  prompt_text        TEXT NOT NULL,
  is_default         BOOLEAN NOT NULL DEFAULT false,
  default_for_tier   TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- readings
CREATE TABLE readings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   UUID REFERENCES orders (id) ON DELETE SET NULL,
  client_id                  UUID REFERENCES clients (id) ON DELETE SET NULL,
  reading_length             INTEGER,
  character_target           INTEGER,
  tone_preset_id             UUID REFERENCES tone_presets (id) ON DELETE SET NULL,
  question_or_focus          TEXT,
  specific_question          TEXT,
  bottom_of_deck_card        TEXT,
  bottom_of_deck_orientation card_orientation DEFAULT 'upright',
  oracle_card_name           TEXT,
  include_oracle_card        BOOLEAN NOT NULL DEFAULT false,
  include_energy_cleansing   BOOLEAN NOT NULL DEFAULT false,
  energy_cleansing_notes     TEXT,
  reader_notes               TEXT,
  generated_prompt           TEXT,
  generated_reading          TEXT,
  email_version              TEXT,
  whatsapp_version           TEXT,
  pdf_url                    TEXT,
  media_file_path            TEXT,
  media_signed_url           TEXT,
  media_url_expires_at       TIMESTAMPTZ,
  groq_model                 TEXT,
  prompt_version             INTEGER NOT NULL DEFAULT 1,
  regenerated_count          INTEGER NOT NULL DEFAULT 0,
  final_approved             BOOLEAN NOT NULL DEFAULT false,
  is_test                    BOOLEAN NOT NULL DEFAULT false,
  deleted_at                 TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_readings_order_id ON readings (order_id);
CREATE INDEX idx_readings_client_id ON readings (client_id);
CREATE INDEX idx_readings_created_at ON readings (created_at DESC);

-- reading_cards
CREATE TABLE reading_cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id     UUID NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
  card_name      TEXT NOT NULL,
  suit           TEXT NOT NULL,
  orientation    card_orientation NOT NULL DEFAULT 'upright',
  position_label TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_bottom_card BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reading_cards_reading_id ON reading_cards (reading_id);

-- client_notes
CREATE TABLE client_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  note       TEXT NOT NULL,
  tag        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_notes_client_id ON client_notes (client_id);

-- reading_templates
CREATE TABLE reading_templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  signoff_text           TEXT,
  booking_cta            TEXT,
  disclaimer_text        TEXT,
  email_subject_template TEXT,
  whatsapp_opening_line  TEXT,
  is_default             BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- app_settings (single row)
CREATE TABLE app_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_name             TEXT,
  signoff_name            TEXT,
  booking_url             TEXT,
  instagram_handle        TEXT,
  whatsapp_number         TEXT,
  default_reading_length  INTEGER DEFAULT 6000,
  default_tone_preset_id  UUID REFERENCES tone_presets (id) ON DELETE SET NULL,
  default_delivery_format delivery_format DEFAULT 'written',
  groq_model              TEXT DEFAULT 'llama-3.3-70b-versatile',
  business_name           TEXT,
  default_topic           TEXT,
  test_mode_enabled       BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- daily_messages
CREATE TABLE daily_messages (
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

CREATE INDEX idx_daily_messages_date ON daily_messages (message_date DESC);

-- ─── Updated-at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_readings_updated_at
  BEFORE UPDATE ON readings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tone_presets_updated_at
  BEFORE UPDATE ON tone_presets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reading_templates_updated_at
  BEFORE UPDATE ON reading_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_daily_messages_updated_at
  BEFORE UPDATE ON daily_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tone_presets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_messages   ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do everything (private internal tool)
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'clients', 'orders', 'order_addons', 'readings', 'reading_cards',
    'client_notes', 'tone_presets', 'reading_templates', 'app_settings',
    'daily_messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY "auth_all_%s" ON %I
       FOR ALL TO authenticated
       USING (true)
       WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- The public fetch endpoint (app/api/daily-message/fetch) is unauthenticated —
-- it gates access with its own DAILY_MESSAGE_FETCH_SECRET check instead of a
-- Supabase session. It runs as the anon role, so it needs its own narrow
-- read policy: approved messages only, never drafts.
CREATE POLICY "anon_select_approved_daily_messages" ON daily_messages
  FOR SELECT TO anon
  USING (approved = true);

-- ─── Migrations (run these if upgrading an existing database) ────────────────
--
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- ALTER TABLE readings ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE readings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS test_mode_enabled BOOLEAN NOT NULL DEFAULT false;
--
-- CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients (deleted_at) WHERE deleted_at IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders (deleted_at) WHERE deleted_at IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_readings_deleted_at ON readings (deleted_at) WHERE deleted_at IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_clients_is_test ON clients (is_test) WHERE is_test = true;
-- CREATE INDEX IF NOT EXISTS idx_orders_is_test ON orders (is_test) WHERE is_test = true;
-- CREATE INDEX IF NOT EXISTS idx_readings_is_test ON readings (is_test) WHERE is_test = true;
-- ALTER TABLE readings ADD COLUMN IF NOT EXISTS media_file_path TEXT;
-- ALTER TABLE readings ADD COLUMN IF NOT EXISTS media_signed_url TEXT;
-- ALTER TABLE readings ADD COLUMN IF NOT EXISTS media_url_expires_at TIMESTAMPTZ;
-- ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS business_name TEXT;
-- ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS default_topic TEXT;

-- ─── Seed Data ────────────────────────────────────────────────────────────────

-- Tone Preset 1: Intuitive & Personal
INSERT INTO tone_presets (name, description, prompt_text, is_default, default_for_tier)
VALUES (
  'Intuitive & Personal',
  'Warm, flowing and conversational. Focuses on emotional energy, intuition and soul connection. Best for Mini and Core readings.',
  'Write a deeply intuitive, emotionally intelligent tarot/psychic reading in my tone — soft, flowing, spiritual, honest and personal. The reading should feel like a conversation from soul to soul, not robotic or overly formal. Blend tarot interpretation, clairvoyant insight, energy reading and channeled emotions naturally together.

My writing style is warm, comforting and emotionally immersive. Highly intuitive and reflective. Poetic without trying too hard. Honest about both light and shadow. Focused on energy shifts, emotions, timing and soul connections. Written as though I am directly tuning into someone''s energy in real time. Gentle but direct when needed. Deeply validating without sounding cliché.

The reading should flow naturally from one point to the next instead of sounding like separate card meanings. Include emotional depth and specific energetic observations. Feel personal, spiritual and slightly mystical. Use phrases about energy, intuition, soul ties, emotional blocks, divine timing, inner knowing, healing, alignment and transformation. Mention what someone may be feeling internally even if they are not expressing it outwardly. Include subtle predictive energy and possible future outcomes without sounding absolute. Feel reassuring and insightful rather than generic.

Avoid overly theatrical fortune teller language. Avoid bullet points or rigid structure. Avoid repeating tarot definitions mechanically. Avoid generic advice that could apply to anyone. Avoid sounding AI-generated or overly polished.

Write in a way that sounds like it genuinely came from me — emotionally aware, spiritually connected and naturally flowing. The reading should feel immersive, as though the person receiving it feels completely seen and understood.',
  true,
  ARRAY['mini', 'core']
);

-- Tone Preset 2: Deep Dive & Psychological
INSERT INTO tone_presets (name, description, prompt_text, is_default, default_for_tier)
VALUES (
  'Deep Dive & Psychological',
  'Detailed and layered. Goes deeper into subconscious patterns, shadow aspects and karmic cycles. Best for Premium and Celtic Cross readings.',
  'Write a deeply detailed tarot reading in a natural flowing style that feels intuitive, emotionally layered, immersive, and personal. Avoid short interpretations or rigid card-by-card definitions. Blend the meanings of the cards together into a connected narrative that flows naturally from beginning to end.

Focus heavily on emotional depth, subconscious patterns, relationships, personal transformation, timing, fears, desires, internal conflict, healing, and spiritual lessons. Make the reading feel reflective and psychologically insightful rather than overly generic or overly positive. Include both shadow aspects and hopeful outcomes with balance and realism.

Write in long-form paragraphs with smooth transitions between themes. Avoid bullet points, headings, numbered sections, or dashes. Keep the tone warm, intuitive, honest, and conversational, like a professional reader channeling insight directly to the person receiving it.

Interpret reversals seriously and explore emotional blockages, avoidance, miscommunication, delays, karmic cycles, or resistance to change when relevant. Highlight repeating themes, mirrored energies, and emotional contradictions within the spread.

Where appropriate, discuss love and relationships, emotional wounds, personal growth, communication, career and finances, family dynamics, spiritual awakening, future possibilities, hidden truths, energy shifts and endings and new beginnings.

Make the reading feel cohesive instead of isolated card meanings. Build tension and release throughout the interpretation so it reads almost like a story unfolding emotionally and spiritually.

End with a strong concluding paragraph that ties the entire reading together with clarity, insight, and emotional resonance.',
  false,
  ARRAY['premium', 'celtic_cross']
);

-- Default reading template
INSERT INTO reading_templates (name, signoff_text, booking_cta, is_default)
VALUES (
  'Default',
  'With love and light ✨',
  'Ready to dive deeper? Book your next reading at the link below.',
  true
);

-- Default app settings
INSERT INTO app_settings (reader_name, signoff_name, default_reading_length, default_delivery_format, groq_model)
VALUES (
  'Reader',
  'With love',
  6000,
  'written',
  'llama-3.3-70b-versatile'
);
