-- Schedule daily card message *generation* from inside Postgres (pg_cron)
-- instead of a Vercel scheduled route.
--
-- Run these statements in the Supabase SQL editor (or via `supabase db push`).
-- This file is committed to git, so it deliberately contains no secret values:
-- the cron secret is read from Supabase Vault at execution time (step 2), and
-- the only thing you must edit by hand is the app URL in step 3.
--
-- What this schedules: a POST to /api/daily-message/cron-generate, which
-- resolves "today" with todayDateString() (Europe/London), refuses to touch a
-- day that is already approved, skipped, soft-deleted or already drafted, and
-- then runs the same generation pipeline as the dashboard's single-day
-- "Generate" action (lib/daily-message/generate-for-date.ts), including its
-- shouldSkipWrite re-check-before-write race guard.
--
-- It does NOT approve or send anything. Generation only — the draft still
-- waits for Rhiannon's review, exactly as before.


-- ─── 1. Confirm the required extensions are enabled ──────────────────────────
-- Both are enabled from the Supabase dashboard (Database → Extensions), not
-- from here: pg_cron must be installed into the database named by
-- cron.database_name, and doing it by hand in the wrong database gives you a
-- job list that silently never runs. So this only *checks*, loudly.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION
      'pg_cron is not enabled. Enable it in Supabase → Database → Extensions, then re-run this migration.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION
      'pg_net is not enabled. Enable it in Supabase → Database → Extensions, then re-run this migration.';
  END IF;
END
$$;

-- Sanity check you can eyeball after the fact:
--   SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');


-- ─── 2. Store the secrets in Vault (run once, with the real values) ──────────
-- Two secrets are needed, both already created on this project:
--   daily_message_cron_secret  — matches DAILY_MESSAGE_CRON_SECRET on Vercel
--   vercel_protection_bypass   — the Protection Bypass for Automation value
-- Uncomment, paste in the real values, run once, then re-comment before
-- committing. Keeping them in Vault rather than inline in the cron.schedule()
-- command below means they are not stored in plaintext in the cron.job table
-- and never land in this repo.
--
-- Confirm both are present and readable with:
--   SELECT name, length(decrypted_secret) FROM vault.decrypted_secrets
--   WHERE name IN ('daily_message_cron_secret', 'vercel_protection_bypass');
--
-- This is NOT the same secret as DAILY_MESSAGE_FETCH_SECRET, and must not be
-- set to the same value: the fetch secret only reads today's approved text and
-- lives in an external automation, while this one can spend OpenAI tokens and
-- write rows.
--
--   SELECT vault.create_secret(
--     'paste-the-DAILY_MESSAGE_CRON_SECRET-value-here',
--     'daily_message_cron_secret',
--     'Bearer-style shared secret for POST /api/daily-message/cron-generate'
--   );
--
--   SELECT vault.create_secret(
--     'paste-the-Protection-Bypass-for-Automation-value-here',
--     'vercel_protection_bypass',
--     'Vercel Protection Bypass for Automation secret for the tarot-app project'
--   );
--
-- To rotate it later (set the value on Vercel first, then here):
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'daily_message_cron_secret'),
--     'the-new-value'
--   );
-- The scheduled job reads the secret at fire time, so rotating it needs no
-- change to the job itself.


-- ─── 3. Schedule the job ─────────────────────────────────────────────────────
--
-- ⚠ DST: pg_cron schedules are fixed UTC. They do NOT shift for BST.
--
-- cron.schedule() interprets its crontab expression in the database's own time
-- zone, which on Supabase is UTC. It is not a UK-local schedule. UK local time
-- is UTC+0 (GMT) from late October to late March and UTC+1 (BST) from late
-- March to late October, so one unchanged crontab entry fires at two different
-- UK local times across the year.
--
-- The schedule below is '0 3 * * *' — 03:00 UTC — which actually fires at:
--
--     winter (GMT, UTC+0):   03:00 UK local
--     summer (BST, UTC+1):   04:00 UK local
--
-- Both sit at least ~3 hours before Rhiannon's morning review, so the 1-hour
-- drift at each changeover changes nothing operationally: today's draft is
-- written and waiting either way. That buffer is the point — it is chosen so
-- that being an hour "wrong" twice a year is a non-event.
--
-- Two windows this time was picked to stay clear of:
--
--   1. The UK midnight boundary (23:00–01:00 UTC). In summer, 23:30 UTC is
--      00:30 BST *the next day*, so todayDateString() (Europe/London) would
--      resolve a different calendar date than the same schedule resolves in
--      winter — the job would draft for the wrong day, and in a changeover
--      week could run twice for one date and never for the next. 03:00 UTC is
--      two clear hours from that edge in the worst case.
--   2. 01:00–02:00 UTC, the window in which the changeover itself happens
--      (BST begins and ends at 01:00 UTC), where a job can be skipped or
--      double-fired on the two changeover nights.
--
-- If the morning review ever moves earlier than about 06:00 UK, revisit this
-- time — but keep at least an hour of slack on the summer (later) side, and do
-- not "fix" the drift by editing the schedule twice a year. pg_cron cannot
-- express a DST-following schedule at all, so a fixed UTC time with a wide
-- buffer is the correct answer, not a seasonal edit.
--
-- The URL below is the tarot-app project's production domain. It is not a
-- secret, so it is inline rather than in Vault — it should be readable at a
-- glance in `SELECT command FROM cron.job`.
--
-- ⚠ PRECONDITION (RESOLVED): this project has Vercel Authentication (SSO
-- protection) enabled for `all_except_custom_domains`, and every domain it
-- currently has is a *.vercel.app one. Left alone, net.http_post from pg_cron
-- would reach an SSO login page instead of the route and the job could never
-- work, whatever the secret said.
--
-- Resolved by enabling Protection Bypass for Automation on the tarot-app
-- project and sending its value as an `x-vercel-protection-bypass` header (see
-- the jsonb_build_object below). Vercel Authentication itself is deliberately
-- left ON — the bypass is a single scoped credential for this job, whereas
-- turning SSO off would expose every route on every deployment.
--
--   vercel project protection tarot-app --format json   # shows protectionBypass
--
-- The bypass value is stored in Vault as 'vercel_protection_bypass' (step 2),
-- not inlined here. Rotating it means updating both Vercel and that Vault
-- secret; the job itself needs no change.
--
-- There is a second layer to get past, and it is not Vercel's: this app's own
-- Next.js middleware (middleware.ts → lib/supabase/middleware.ts) redirects any
-- request without a Supabase session to /login. /api/daily-message/cron-generate
-- is on that file's `isPublic` allowlist for exactly this reason. If a cron fire
-- ever starts coming back as a 307 to /login, check that allowlist first.
--
-- Verify with: curl -i https://tarot-app-goldd.vercel.app/api/daily-message/cron-generate
-- — a 401 with an HTML login body means Vercel protection is still in the way;
-- a 307 to /login means the middleware allowlist is; the route's own 401 is a
-- small JSON {"error":"Unauthorized"} body.

-- Drop any previous version of this job first. pg_cron ≥ 1.4 replaces a job
-- with the same name on re-schedule, but doing it explicitly keeps this
-- migration re-runnable on any version and makes the intent obvious.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-message-generate') THEN
    PERFORM cron.unschedule('daily-message-generate');
  END IF;
END
$$;

SELECT cron.schedule(
  'daily-message-generate',
  '0 3 * * *',  -- 03:00 UTC daily → 03:00 GMT in winter, 04:00 BST in summer
  $job$
  SELECT net.http_post(
    url     := 'https://tarot-app-goldd.vercel.app/api/daily-message/cron-generate',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-daily-message-cron-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'daily_message_cron_secret'),
      -- Gets past Vercel Authentication, which is still enabled for
      -- all_except_custom_domains (see the PRECONDITION note above). Read from
      -- Vault for the same reason as the cron secret: it must not sit in git,
      -- nor in plaintext in cron.job.command.
      'x-vercel-protection-bypass',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vercel_protection_bypass')
    ),
    -- pg_net's default timeout is 5s, which is shorter than a single OpenAI
    -- call, so left at the default every run would record a timeout. Note
    -- this timeout only abandons pg_net's side of the request; the Vercel
    -- function keeps running to completion, so a recorded timeout does not
    -- necessarily mean the message wasn't written. Check daily_messages, not
    -- just net._http_response.
    timeout_milliseconds := 120000
  );
  $job$
);


-- ─── 4. Verifying it (after the first real fire) ─────────────────────────────
--
-- pg_net is fire-and-forget: cron.schedule's command returns as soon as the
-- request is queued, so cron.job_run_details will show 'succeeded' even if the
-- HTTP call failed. Always check all three of these together.
--
-- The job as scheduled (confirm the schedule, and that the secret is a Vault
-- lookup rather than a literal):
--   SELECT jobid, jobname, schedule, active, command FROM cron.job
--   WHERE jobname = 'daily-message-generate';
--
-- Whether cron fired at all, in UTC:
--   SELECT d.start_time, d.status, d.return_message
--   FROM cron.job_run_details d
--   JOIN cron.job j USING (jobid)
--   WHERE j.jobname = 'daily-message-generate'
--   ORDER BY d.start_time DESC LIMIT 10;
--
-- What the route actually answered (200 + {"status":"generated"} on a normal
-- day; {"status":"already_approved"|"already_generated"|"day_skipped"|
-- "day_deleted"} means it correctly left an existing day alone; 401 means the
-- Vault secret and DAILY_MESSAGE_CRON_SECRET on Vercel disagree):
--   SELECT created, status_code, content
--   FROM net._http_response
--   ORDER BY created DESC LIMIT 10;
--
-- And the thing that actually matters — the row itself, in UK local terms:
--   SELECT message_date, card_name, card_orientation, approved, skipped,
--          created_at AT TIME ZONE 'Europe/London' AS created_uk
--   FROM daily_messages
--   ORDER BY message_date DESC LIMIT 5;
--
-- To test without waiting for 03:00 UTC, run the POST by hand (same header the
-- job sends) — it is idempotent, so a second call on a day that already has a
-- draft answers {"status":"already_generated"} without spending tokens:
--   curl -X POST https://tarot-app-goldd.vercel.app/api/daily-message/cron-generate \
--     -H 'x-daily-message-cron-secret: <the-secret>'
--
-- To pause the job without deleting it:
--   UPDATE cron.job SET active = false WHERE jobname = 'daily-message-generate';
-- To remove it entirely:
--   SELECT cron.unschedule('daily-message-generate');
