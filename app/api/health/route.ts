import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayDateString } from '@/lib/daily-message/dates'

export const dynamic = 'force-dynamic'

type Level = 'ok' | 'warn' | 'error'
interface Check {
  id: string
  label: string
  level: Level
  detail: string
}

const has = (name: string) => Boolean(process.env[name]?.trim())

/**
 * Signed-in-only status check. It reports whether things are configured and whether
 * the database answers; it never makes a paid call (e.g. to OpenAI) and never returns
 * a secret value — only whether each one is set.
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checks: Check[] = []

  // Database
  const started = Date.now()
  const { error: dbError } = await supabase.from('app_settings').select('id').limit(1)
  checks.push(
    dbError
      ? { id: 'database', label: 'Database', level: 'error', detail: 'The database did not respond to a test query.' }
      : { id: 'database', label: 'Database', level: 'ok', detail: `Responding (${Date.now() - started} ms).` }
  )

  // AI provider (configuration only)
  checks.push(
    has('OPENAI_API_KEY')
      ? { id: 'ai', label: 'AI generation', level: 'ok', detail: `API key set${has('OPENAI_MODEL') ? `, model ${process.env.OPENAI_MODEL}` : ''}.` }
      : { id: 'ai', label: 'AI generation', level: 'error', detail: 'OPENAI_API_KEY is not set, so readings cannot be generated.' }
  )

  // Server-side database access (needed by webhooks and cron)
  checks.push(
    has('SUPABASE_SERVICE_ROLE_KEY')
      ? { id: 'service-role', label: 'Server database access', level: 'ok', detail: 'Service role key is set.' }
      : { id: 'service-role', label: 'Server database access', level: 'warn', detail: 'SUPABASE_SERVICE_ROLE_KEY is not set. Webhooks and the daily-message job will fail.' }
  )

  // Gmail
  const gmailMissing = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER_ADDRESS'].filter((n) => !has(n))
  checks.push(
    gmailMissing.length === 0
      ? { id: 'gmail', label: 'Email sending', level: 'ok', detail: 'Gmail credentials are set.' }
      : { id: 'gmail', label: 'Email sending', level: 'warn', detail: `Not configured (missing ${gmailMissing.length} of 4 Gmail settings).` }
  )

  // Daily message job
  const today = todayDateString()
  const { data: todayRow, error: dailyError } = await supabase
    .from('daily_messages')
    .select('id, approved')
    .eq('message_date', today)
    .is('deleted_at', null)
    .maybeSingle()
  if (dailyError) {
    checks.push({ id: 'daily', label: 'Daily message', level: 'warn', detail: 'Could not check today’s message.' })
  } else if (!has('DAILY_MESSAGE_CRON_SECRET')) {
    checks.push({ id: 'daily', label: 'Daily message', level: 'warn', detail: 'DAILY_MESSAGE_CRON_SECRET is not set, so the scheduled job cannot run here.' })
  } else if (!todayRow) {
    checks.push({ id: 'daily', label: 'Daily message', level: 'warn', detail: 'No message exists for today yet.' })
  } else {
    checks.push({
      id: 'daily',
      label: 'Daily message',
      level: todayRow.approved ? 'ok' : 'warn',
      detail: todayRow.approved ? 'Today’s message is approved.' : 'Today’s message is a draft waiting for approval.',
    })
  }

  const worst: Level = checks.some((c) => c.level === 'error') ? 'error' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok'
  return NextResponse.json({ status: worst, checks, checkedAt: new Date().toISOString() })
}
