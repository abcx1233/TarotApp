-- Future-section timeframe for readings.
--
-- Written by POST /api/readings/generate and POST /api/readings/save-draft, and
-- read back by ReadingForm when a reading is reopened. The value is the label
-- picked in the form ('Next 3 months', 'Next 6 months', 'Rest of the year',
-- 'Full 12 months', '24 months'), which lib/ai/prompts/future-section.ts matches
-- on to size the future section.
--
-- The live database already had this column before it was recorded here; this
-- migration brings the repo in line with it. Nullable with no default and no
-- CHECK constraint, matching the live column exactly: NULL means no timeframe
-- was chosen, and the prompt then falls back to "through to year end".
--
-- No existing column is touched.

ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS future_timeframe text;
