import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDailyCardMessage } from '@/lib/ai/generate'
import { formatAiError } from '@/lib/ai/errors'
import { drawRandomCard } from '@/data/tarot-cards'
import { todayDateString, addDays, isValidDateString, shouldSkipWrite } from '@/lib/daily-message/dates'
import { DAILY_MESSAGE_COLUMNS } from '@/lib/daily-message/columns'
import type { CardOrientation } from '@/types'

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

  let cardName = body.cardName?.trim()
  let orientation: CardOrientation = body.orientation === 'reversed' ? 'reversed' : 'upright'

  // No card supplied (e.g. the calendar's "Generate for this day" button) —
  // auto-draw one, avoiding whatever was assigned in the 7 days before this date.
  if (!cardName) {
    const { data: recentRows, error: recentError } = await supabase
      .from('daily_messages')
      .select('card_name')
      .lt('message_date', messageDate)
      .gte('message_date', addDays(messageDate, -7))
      .is('deleted_at', null)

    // Not fatal — worst case the no-repeat window isn't enforced for this one
    // draw — but it must not fail silently, so it's logged.
    if (recentError) {
      console.error('[daily-message/generate] Failed to read recent history for no-repeat check:', recentError)
    }

    const draw = drawRandomCard((recentRows ?? []).map((r) => r.card_name))
    cardName = draw.card.name
    orientation = draw.orientation
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

  // The OpenAI call above can take several seconds, during which this date
  // may have been deleted or skipped. Re-check immediately before writing —
  // this narrows that race to a single round-trip rather than eliminating it
  // outright (a fully atomic guard would need a DB-level conditional
  // upsert), but it stops the common case: a delete or skip made while
  // generation was already in flight silently getting overwritten when the
  // model call finally returns.
  const { data: currentState, error: stateError } = await supabase
    .from('daily_messages')
    .select('deleted_at, skipped')
    .eq('message_date', messageDate)
    .maybeSingle()

  if (stateError) {
    console.error('[daily-message/generate] Failed to re-check state before writing:', stateError)
    // Fall through and write anyway — refusing to save a successful
    // generation because an unrelated read failed would be worse than the
    // narrow race this check exists to close.
  } else if (shouldSkipWrite(currentState)) {
    console.log(
      `[daily-message/generate] Not writing ${messageDate} — ${currentState?.deleted_at ? 'deleted' : 'skipped'} while generation was in flight.`
    )
    return NextResponse.json({ dailyMessage: null, skippedWrite: true })
  }

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
        skipped: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'message_date' }
    )
    .select(DAILY_MESSAGE_COLUMNS)
    .single()

  if (error || !row) {
    console.error('[daily-message/generate] Upsert error:', error)
    return NextResponse.json({ error: 'Failed to save the generated message' }, { status: 500 })
  }

  return NextResponse.json({ dailyMessage: row })
}
