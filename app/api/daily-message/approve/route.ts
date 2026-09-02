import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayDateString, isValidDateString } from '@/lib/daily-message/dates'
import { DAILY_MESSAGE_COLUMNS } from '@/lib/daily-message/columns'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { finalText?: string; date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const finalText = body.finalText?.trim()
  if (!finalText) {
    return NextResponse.json({ error: 'finalText is required' }, { status: 422 })
  }

  const messageDate = isValidDateString(body.date) ? body.date : todayDateString()

  const { data: row, error } = await supabase
    .from('daily_messages')
    .update({
      final_text: finalText,
      approved: true,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('message_date', messageDate)
    .is('deleted_at', null)
    .select(DAILY_MESSAGE_COLUMNS)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'No draft found for that date — generate one first' }, { status: 404 })
  }

  return NextResponse.json({ dailyMessage: row })
}
