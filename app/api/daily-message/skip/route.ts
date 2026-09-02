import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayDateString, isValidDateString } from '@/lib/daily-message/dates'
import { DAILY_MESSAGE_COLUMNS } from '@/lib/daily-message/columns'

// Marks an empty date as intentionally skipped — no card, no generation.
// Only valid for today or a future date that doesn't already have an
// active message.
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!isValidDateString(body.date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 422 })
  }

  if (body.date < todayDateString()) {
    return NextResponse.json({ error: 'Past dates are locked and cannot be skipped' }, { status: 403 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('daily_messages')
    .select('id')
    .eq('message_date', body.date)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingError) {
    console.error('[daily-message/skip] Failed to check for an existing message:', existingError)
    return NextResponse.json({ error: 'Failed to check for an existing message on that date' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ error: 'A message already exists for that date' }, { status: 422 })
  }

  const { data: row, error } = await supabase
    .from('daily_messages')
    .upsert(
      {
        message_date: body.date,
        card_name: '',
        card_orientation: 'upright',
        generated_text: null,
        final_text: null,
        approved: false,
        approved_at: null,
        skipped: true,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'message_date' }
    )
    .select(DAILY_MESSAGE_COLUMNS)
    .single()

  if (error || !row) {
    console.error('[daily-message/skip] Upsert error:', error)
    return NextResponse.json({ error: 'Failed to skip that date' }, { status: 500 })
  }

  return NextResponse.json({ dailyMessage: row })
}
