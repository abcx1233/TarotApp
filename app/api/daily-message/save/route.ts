import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidDateString } from '@/lib/daily-message/dates'
import { DAILY_MESSAGE_COLUMNS } from '@/lib/daily-message/columns'

// Persists an edit to a draft's text without re-approving it. Approving is a
// separate, explicit step — but if the day is already approved, the live
// text being served (final_text) must be kept in sync with the edit, or the
// edit silently has no effect on what actually gets sent.
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

  const { data: existing, error: fetchError } = await supabase
    .from('daily_messages')
    .select('id, approved')
    .eq('message_date', body.date)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError) {
    console.error('[daily-message/save] Failed to look up existing message:', fetchError)
    return NextResponse.json({ error: 'Failed to look up that date' }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'No draft found for that date' }, { status: 404 })
  }

  const updatePayload: { generated_text: string; updated_at: string; final_text?: string } = {
    generated_text: text,
    updated_at: new Date().toISOString(),
  }
  if (existing.approved) {
    updatePayload.final_text = text
  }

  const { data: row, error } = await supabase
    .from('daily_messages')
    .update(updatePayload)
    .eq('id', existing.id)
    .select(DAILY_MESSAGE_COLUMNS)
    .single()

  if (error || !row) {
    console.error('[daily-message/save] Update error:', error)
    return NextResponse.json({ error: 'Failed to save the edit' }, { status: 500 })
  }

  return NextResponse.json({ dailyMessage: row })
}
