-- Add media upload fields to readings table
-- Run these statements in the Supabase SQL editor

ALTER TABLE readings ADD COLUMN IF NOT EXISTS media_file_path text;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS media_signed_url text;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS media_url_expires_at timestamptz;

-- ─── Supabase Storage setup ────────────────────────────────────────────────────
--
-- 1. Go to Storage in the Supabase dashboard
-- 2. Create a new bucket named: reading-media
-- 3. Set the bucket to Private (not public)
-- 4. Add the following RLS policies to the bucket:
--
-- POLICY: Allow authenticated users to upload files
--   Operation: INSERT
--   Target roles: authenticated
--   Policy: (bucket_id = 'reading-media')
--
-- POLICY: Allow authenticated users to read files
--   Operation: SELECT
--   Target roles: authenticated
--   Policy: (bucket_id = 'reading-media')
--
-- POLICY: Allow authenticated users to create signed URLs
--   Operation: SELECT on storage.objects
--   Target roles: authenticated
--   Policy: (bucket_id = 'reading-media')
--
-- 5. File size limit: 500 MB (adjust as needed for video)
-- 6. Allowed MIME types: audio/*, video/*
