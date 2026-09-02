import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayDateString } from '@/lib/daily-message/dates'

// Bulk soft-delete, always scoped to today onward — the client can't extend
// this into the past no matter what it sends, since `fromDate` is computed
// here rather than accepted as input.
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { mode?: 'pending' | 'all' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.mode !== 'pending' && body.mode !== 'all') {
    return NextResponse.json({ error: 'mode must be "pending" or "all"' }, { status: 422 })
  }

  let query = supabase
    .from('daily_messages')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .gte('message_date', todayDateString())
    .is('deleted_at', null)

  if (body.mode === 'pending') {
    query = query.eq('approved', false)
  }

  const { data, error } = await query.select('id')

  if (error) {
    console.error('[daily-message/delete-batch] Error:', error)
    return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 })
  }

  return NextResponse.json({ deleted: data?.length ?? 0 })
}
