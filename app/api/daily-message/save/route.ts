import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidDateString } from '@/lib/daily-message/dates'

// Persists an edit to a draft's text without approving it — used by the
// calendar's "Save edit" action. Approving is a separate, explicit step.
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { date?: string; text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!isValidDateString(body.date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 422 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 422 })
  }

  const { data: row, error } = await supabase
    .from('daily_messages')
    .update({
      generated_text: text,
      updated_at: new Date().toISOString(),
    })
    .eq('message_date', body.date)
    .select('id, message_date, card_name, card_orientation, generated_text, final_text, approved, approved_at')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'No draft found for that date' }, { status: 404 })
  }

  return NextResponse.json({ dailyMessage: row })
}
