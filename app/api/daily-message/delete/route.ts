import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayDateString, isValidDateString } from '@/lib/daily-message/dates'

// Soft-deletes a single date's message. Past dates are locked — this only
// ever touches today or a future date.
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
    return NextResponse.json({ error: 'Past dates are locked and cannot be deleted' }, { status: 403 })
  }

  const { data: row, error } = await supabase
    .from('daily_messages')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('message_date', body.date)
    .is('deleted_at', null)
    .select('id, message_date')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'No message found for that date' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true, messageDate: row.message_date })
}
