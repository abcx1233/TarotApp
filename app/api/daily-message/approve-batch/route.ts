import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidDateString } from '@/lib/daily-message/dates'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { dates?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const dates = (body.dates ?? []).filter(isValidDateString)
  if (dates.length === 0) {
    return NextResponse.json({ error: 'dates is required' }, { status: 422 })
  }

  const { data: rows, error: fetchError } = await supabase
    .from('daily_messages')
    .select('id, generated_text')
    .in('message_date', dates)
    .eq('approved', false)

  if (fetchError) {
    console.error('[daily-message/approve-batch] Fetch error:', fetchError)
    return NextResponse.json({ error: 'Failed to read messages' }, { status: 500 })
  }

  const approvable = (rows ?? []).filter((r) => r.generated_text?.trim())

  let approved = 0
  const now = new Date().toISOString()
  for (const row of approvable) {
    const { error } = await supabase
      .from('daily_messages')
      .update({
        final_text: row.generated_text,
        approved: true,
        approved_at: now,
        updated_at: now,
      })
      .eq('id', row.id)

    if (!error) approved++
  }

  return NextResponse.json({ approved, skipped: dates.length - approved })
}
