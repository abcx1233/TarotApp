import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { formatAiError } from '@/lib/ai/errors'
import { todayDateString } from '@/lib/daily-message/dates'
import { generateDailyMessageForDate } from '@/lib/daily-message/generate-for-date'

// Generation is a Node-only path (OpenAI SDK + service-role Supabase client),
// same as the inbound webhook routes.
export const runtime = 'nodejs'

const LOG_PREFIX = '[daily-message/cron-generate]'
const SECRET_HEADER = 'x-daily-message-cron-secret'

/**
 * Server-to-server trigger for generating *today's* daily card message,
 * called by the Supabase pg_cron job (see
 * supabase/migrations/add_daily_message_pg_cron.sql).
 *
 * Deliberately separate from the public GET /api/daily-message/fetch route and
 * its DAILY_MESSAGE_FETCH_SECRET: that secret only ever reads today's approved
 * text and is handed to an external consumer (the WhatsApp automation), while
 * this one can spend OpenAI tokens and write rows. Different blast radius, so
 * a different secret — a leak of the read secret must not grant write.
 */

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, so length is checked first —
  // that leaks only the length, not the contents.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Service role, because there is no Supabase session on a cron-triggered
// request: RLS grants daily_messages writes to `authenticated` only, and the
// anon role has just the narrow "approved rows" SELECT policy. Same pattern as
// lib/webhooks/inbound-order.ts, but with no fallback to the publishable key —
// falling back there would produce silent RLS write failures rather than a
// clear configuration error.
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(request: Request) {
  const secret = process.env.DAILY_MESSAGE_CRON_SECRET
  if (!secret) {
    console.error(`${LOG_PREFIX} DAILY_MESSAGE_CRON_SECRET is not set — refusing to run.`)
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  if (!secretMatches(request.headers.get(SECRET_HEADER), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    console.error(`${LOG_PREFIX} SUPABASE_SERVICE_ROLE_KEY is not set — refusing to run.`)
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  // Always today, always via todayDateString() (Europe/London). Any date in
  // the request body is ignored on purpose: the pg_cron schedule is fixed UTC
  // and can fire either side of the UK midnight boundary as BST comes and
  // goes, so "today" must be resolved here by the one function that knows the
  // zone — never passed in, and never derived from the DB's or the runtime's
  // own clock. A cron trigger also has no business backfilling other dates.
  const messageDate = todayDateString()

  // Idempotency / don't-overwrite pre-check. The pipeline's own
  // shouldSkipWrite guard would already refuse to write over a skipped or
  // deleted day, but only *after* the OpenAI call — and it does not protect an
  // approved or already-drafted day at all, because for the interactive route
  // an explicit regenerate click is meant to replace the draft. A cron run is
  // not an explicit click: if this fires twice, or fires after Rhiannon has
  // already generated/edited/approved today by hand, it must leave her work
  // alone and spend nothing.
  const { data: existing, error: existingError } = await supabase
    .from('daily_messages')
    .select('id, approved, skipped, deleted_at, generated_text')
    .eq('message_date', messageDate)
    .maybeSingle()

  if (existingError) {
    console.error(`${LOG_PREFIX} Failed to read today's row:`, existingError)
    return NextResponse.json({ error: 'Failed to read existing message' }, { status: 500 })
  }

  if (existing) {
    // Soft-deleted: today was explicitly thrown away. Regenerating would
    // resurrect it, which is exactly what the delete meant to prevent.
    if (existing.deleted_at) {
      console.log(`${LOG_PREFIX} ${messageDate} is soft-deleted — leaving it alone.`)
      return NextResponse.json({ status: 'day_deleted', date: messageDate, generated: false })
    }
    if (existing.skipped) {
      console.log(`${LOG_PREFIX} ${messageDate} is marked skipped — leaving it alone.`)
      return NextResponse.json({ status: 'day_skipped', date: messageDate, generated: false })
    }
    if (existing.approved) {
      console.log(`${LOG_PREFIX} ${messageDate} is already approved — leaving it alone.`)
      return NextResponse.json({ status: 'already_approved', date: messageDate, generated: false })
    }
    if (existing.generated_text) {
      console.log(`${LOG_PREFIX} ${messageDate} already has a draft — leaving it alone.`)
      return NextResponse.json({ status: 'already_generated', date: messageDate, generated: false })
    }
    // A row with no generated_text (e.g. one created by an earlier failed
    // attempt) is fair game — fall through and generate into it.
  }

  // No card is passed, so the shared pipeline auto-draws one honouring the
  // no-repeat-in-7-days window, exactly as the dashboard's "Generate for this
  // day" button does.
  const result = await generateDailyMessageForDate({
    supabase,
    messageDate,
    logPrefix: LOG_PREFIX,
  })

  switch (result.outcome) {
    case 'generated':
      console.log(`${LOG_PREFIX} Generated ${messageDate}: ${result.row.card_name} (${result.row.card_orientation}).`)
      return NextResponse.json({
        status: 'generated',
        date: messageDate,
        generated: true,
        cardName: result.row.card_name,
        orientation: result.row.card_orientation,
      })
    case 'skipped_write':
      // Deleted or skipped *during* the OpenAI call — the race guard fired.
      return NextResponse.json({
        status: result.reason === 'deleted' ? 'day_deleted' : 'day_skipped',
        date: messageDate,
        generated: false,
        raced: true,
      })
    case 'generation_failed':
      return NextResponse.json(
        { status: 'generation_failed', date: messageDate, generated: false, error: formatAiError(result.error) },
        { status: 500 }
      )
    case 'write_failed':
      return NextResponse.json(
        { status: 'write_failed', date: messageDate, generated: false, error: 'Failed to save the generated message' },
        { status: 500 }
      )
  }
}
