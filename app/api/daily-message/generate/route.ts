import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatAiError } from '@/lib/ai/errors'
import { todayDateString, isValidDateString } from '@/lib/daily-message/dates'
import { generateDailyMessageForDate } from '@/lib/daily-message/generate-for-date'
import type { CardOrientation } from '@/types'

const LOG_PREFIX = '[daily-message/generate]'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { cardName?: string; orientation?: CardOrientation; date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const messageDate = isValidDateString(body.date) ? body.date : todayDateString()

  // The draw → generate → re-check → upsert pipeline lives in
  // lib/daily-message/generate-for-date so the pg_cron trigger route runs the
  // identical thing rather than a second copy of it.
  const result = await generateDailyMessageForDate({
    supabase,
    messageDate,
    cardName: body.cardName,
    orientation: body.orientation,
    logPrefix: LOG_PREFIX,
  })

  switch (result.outcome) {
    case 'generated':
      return NextResponse.json({ dailyMessage: result.row })
    case 'skipped_write':
      return NextResponse.json({ dailyMessage: null, skippedWrite: true })
    case 'generation_failed':
      return NextResponse.json({ error: formatAiError(result.error) }, { status: 500 })
    case 'write_failed':
      return NextResponse.json({ error: 'Failed to save the generated message' }, { status: 500 })
  }
}
