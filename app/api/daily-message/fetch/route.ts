import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function notReady(): NextResponse {
  return new NextResponse('NOT_READY', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function GET(request: Request) {
  const secret = process.env.DAILY_MESSAGE_FETCH_SECRET
  const providedKey = new URL(request.url).searchParams.get('key')

  if (!secret || providedKey !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const { data: row } = await supabase
    .from('daily_messages')
    .select('final_text, approved')
    .eq('message_date', todayDateString())
    .single()

  if (!row || !row.approved || !row.final_text) {
    return notReady()
  }

  return new NextResponse(row.final_text, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}
