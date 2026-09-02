import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { todayDateString } from '@/lib/daily-message/dates'

function notReady(): NextResponse {
  return new NextResponse('NOT_READY', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function serverError(): NextResponse {
  return new NextResponse('ERROR', {
    status: 500,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(request: Request) {
  const secret = process.env.DAILY_MESSAGE_FETCH_SECRET
  const providedKey = new URL(request.url).searchParams.get('key')

  if (!secret || providedKey !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('daily_messages')
    .select('final_text, approved')
    .eq('message_date', todayDateString())
    .is('deleted_at', null)
    .maybeSingle()

  // maybeSingle() returns { data: null, error: null } when there's simply no
  // row for today — that's the normal NOT_READY case. A non-null error here
  // means the query itself failed (bad column, connection issue, etc.) and
  // must not be presented the same way as "nothing ready yet".
  if (error) {
    console.error('[daily-message/fetch] DB error:', error)
    return serverError()
  }

  if (!row || !row.approved || !row.final_text) {
    return notReady()
  }

  return new NextResponse(row.final_text, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
