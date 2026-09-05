import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDailyCardMessage } from '@/lib/ai/generate'
import { drawRandomCard } from '@/data/tarot-cards'
import { addDays, shouldSkipWrite } from '@/lib/daily-message/dates'
import { DAILY_MESSAGE_COLUMNS } from '@/lib/daily-message/columns'
import type { CardOrientation, DailyMessage } from '@/types'

// The row shape actually selected back — DAILY_MESSAGE_COLUMNS deliberately
// omits created_at/updated_at.
export type DailyMessageRow = Omit<DailyMessage, 'created_at' | 'updated_at'>

export type GenerateForDateResult =
  | { outcome: 'generated'; row: DailyMessageRow }
  | { outcome: 'skipped_write'; reason: 'deleted' | 'skipped' }
  | { outcome: 'generation_failed'; error: unknown }
  | { outcome: 'write_failed'; error: unknown }

export interface GenerateForDateOptions {
  supabase: SupabaseClient
  /** Already-resolved YYYY-MM-DD. Callers must resolve "today" via todayDateString(). */
  messageDate: string
  /** Omit to auto-draw a card, honouring the no-repeat-in-7-days window. */
  cardName?: string
  orientation?: CardOrientation
  /** Log tag, so cron vs. interactive runs stay distinguishable in the logs. */
  logPrefix: string
}

/**
 * The single-day generation pipeline: draw (if needed) → generate → re-check →
 * upsert. Extracted verbatim out of app/api/daily-message/generate so that
 * every trigger for a single day's message — the authenticated dashboard
 * action and the pg_cron server-to-server route — runs exactly the same
 * safety behaviour, in particular the shouldSkipWrite race guard below.
 *
 * Deliberately takes `messageDate` pre-resolved rather than defaulting to
 * "today" itself: there must be exactly one way to derive "today" in this
 * feature (todayDateString(), Europe/London), and it must be visible at the
 * call site rather than hidden in here.
 *
 * Auth/secret gating is the caller's job — this function assumes the request
 * has already been authorised and that `supabase` is a client permitted to
 * write daily_messages.
 */
export async function generateDailyMessageForDate({
  supabase,
  messageDate,
  cardName: requestedCardName,
  orientation: requestedOrientation,
  logPrefix,
}: GenerateForDateOptions): Promise<GenerateForDateResult> {
  let cardName = requestedCardName?.trim()
  let orientation: CardOrientation = requestedOrientation === 'reversed' ? 'reversed' : 'upright'

  // No card supplied (e.g. the calendar's "Generate for this day" button, or
  // the cron trigger) — auto-draw one, avoiding whatever was assigned in the
  // 7 days before this date.
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
      console.error(`${logPrefix} Failed to read recent history for no-repeat check:`, recentError)
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
    console.error(`${logPrefix} Generation error:`, err)
    return { outcome: 'generation_failed', error: err }
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
    console.error(`${logPrefix} Failed to re-check state before writing:`, stateError)
    // Fall through and write anyway — refusing to save a successful
    // generation because an unrelated read failed would be worse than the
    // narrow race this check exists to close.
  } else if (shouldSkipWrite(currentState)) {
    const reason = currentState?.deleted_at ? 'deleted' : 'skipped'
    console.log(`${logPrefix} Not writing ${messageDate} — ${reason} while generation was in flight.`)
    return { outcome: 'skipped_write', reason }
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
    console.error(`${logPrefix} Upsert error:`, error)
    return { outcome: 'write_failed', error }
  }

  return { outcome: 'generated', row: row as DailyMessageRow }
}
