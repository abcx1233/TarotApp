import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDailyCardMessage } from '@/lib/ai/generate'
import { formatAiError } from '@/lib/ai/errors'
import type { CardOrientation } from '@/types'

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

  let body: { cardName?: string; orientation?: CardOrientation }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const cardName = body.cardName?.trim()
  const orientation: CardOrientation = body.orientation === 'reversed' ? 'reversed' : 'upright'

  if (!cardName) {
    return NextResponse.json({ error: 'cardName is required' }, { status: 422 })
  }

  let generatedText: string
  try {
    const result = await generateDailyCardMessage(cardName, orientation)
    generatedText = result.generatedReading
      .replace(/—/g, ', ')
      .replace(/–/g, ', ')
      .replace(/\s,\s/g, ', ')
      .replace(/,\s*,/g, ',')
      .trim()
  } catch (err) {
    console.error('[daily-message/generate] Generation error:', err)
    return NextResponse.json({ error: formatAiError(err) }, { status: 500 })
  }

  const messageDate = todayDateString()

  const { data: row, error } = await supabase
    .from('daily_messages')
    .upsert(
      {
        message_date: messageDate,
        card_name: cardName,
        card_orientation: orientation,
        generated_text: generatedText,
        final_text: null,
        approved: false,
        approved_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'message_date' }
    )
    .select('id, message_date, card_name, card_orientation, generated_text, final_text, approved, approved_at')
    .single()

  if (error || !row) {
    console.error('[daily-message/generate] Upsert error:', error)
    return NextResponse.json({ error: 'Failed to save the generated message' }, { status: 500 })
  }

  return NextResponse.json({ dailyMessage: row })
}
