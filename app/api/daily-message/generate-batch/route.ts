import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { drawCardsForDateRange, type DateCardDraw } from '@/data/tarot-cards'
import { generateDailyCardMessage } from '@/lib/ai/generate'
import { addDays, isValidDateString } from '@/lib/daily-message/dates'

const DEFAULT_DAYS = 30
const MAX_DAYS = 90
const CONCURRENCY = 6

type FreshDraw = Extract<DateCardDraw, { alreadyAssigned: false }>

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { startDate?: string; days?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!isValidDateString(body.startDate)) {
    return NextResponse.json({ error: 'startDate (YYYY-MM-DD) is required' }, { status: 422 })
  }
  const startDate = body.startDate
  const days = body.days && body.days > 0 ? Math.min(Math.floor(body.days), MAX_DAYS) : DEFAULT_DAYS

  const rangeEnd = addDays(startDate, days - 1)
  const lookbackStart = addDays(startDate, -7)

  // Pull everything from 7 days before the range through the end of it — this
  // both seeds the no-repeat lookback window and tells us which dates to skip.
  // Soft-deleted rows are excluded entirely: they no longer occupy their date
  // for no-repeat or skip purposes.
  const { data: existingRows, error: fetchError } = await supabase
    .from('daily_messages')
    .select('message_date, card_name, skipped')
    .gte('message_date', lookbackStart)
    .lte('message_date', rangeEnd)
    .is('deleted_at', null)
    .order('message_date', { ascending: true })

  if (fetchError) {
    console.error('[daily-message/generate-batch] Fetch error:', fetchError)
    return NextResponse.json({ error: 'Failed to read existing messages' }, { status: 500 })
  }

  const recentHistory = (existingRows ?? []).filter((r) => r.message_date < startDate && !r.skipped)
  // A skipped day maps to `null` — left alone, but with no card to track for
  // the no-repeat window (nothing was actually drawn there).
  const existingByDate: Record<string, string | null> = {}
  for (const row of existingRows ?? []) {
    if (row.message_date >= startDate) {
      existingByDate[row.message_date] = row.skipped ? null : row.card_name
    }
  }

  const draws = drawCardsForDateRange(startDate, days, recentHistory, existingByDate)
  const toGenerate = draws.filter((d): d is FreshDraw => !d.alreadyAssigned)
  const skipped = draws.length - toGenerate.length

  let generated = 0
  let failed = 0

  for (let i = 0; i < toGenerate.length; i += CONCURRENCY) {
    const chunk = toGenerate.slice(i, i + CONCURRENCY)

    const results = await Promise.allSettled(
      chunk.map(async (draw) => {
        const result = await generateDailyCardMessage(draw.cardName, draw.orientation)
        const generatedText = result.generatedReading
          .replace(/—/g, ', ')
          .replace(/–/g, ', ')
          .replace(/\s,\s/g, ', ')
          .replace(/,\s*,/g, ',')
          .trim()

        const { error: upsertError } = await supabase.from('daily_messages').upsert(
          {
            message_date: draw.date,
            card_name: draw.cardName,
            card_orientation: draw.orientation,
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

        if (upsertError) throw upsertError
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        generated++
      } else {
        failed++
        console.error('[daily-message/generate-batch] Generation failed:', result.reason)
      }
    }
  }

  return NextResponse.json({ generated, skipped, failed })
}
