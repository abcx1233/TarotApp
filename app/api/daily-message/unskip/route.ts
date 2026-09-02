import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidDateString } from '@/lib/daily-message/dates'

// Un-marks a skipped date, returning it to Empty so it can be generated
// normally again.
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

  const { data: row, error } = await supabase
    .from('daily_messages')
    .update({ skipped: false, updated_at: new Date().toISOString() })
    .eq('message_date', body.date)
    .eq('skipped', true)
    .is('deleted_at', null)
    .select('id, message_date')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'No skipped date found to un-skip' }, { status: 404 })
  }

  return NextResponse.json({ unskipped: true, messageDate: row.message_date })
}
