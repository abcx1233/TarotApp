import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { finalText?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const finalText = body.finalText?.trim()
  if (!finalText) {
    return NextResponse.json({ error: 'finalText is required' }, { status: 422 })
  }

  const messageDate = todayDateString()

  const { data: row, error } = await supabase
    .from('daily_messages')
    .update({
      final_text: finalText,
      approved: true,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('message_date', messageDate)
    .select('id, message_date, card_name, card_orientation, generated_text, final_text, approved, approved_at')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'No draft found for today — generate one first' }, { status: 404 })
  }

  return NextResponse.json({ dailyMessage: row })
}
