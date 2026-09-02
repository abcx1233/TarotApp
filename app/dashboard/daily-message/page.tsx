import { createClient } from '@/lib/supabase/server'
import { DailyMessageForm } from '@/components/daily-message/DailyMessageForm'
import type { DailyMessage } from '@/types'

export const metadata = {
  title: 'Daily Card Message — Reader Console',
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getTodayMessage(): Promise<{ message: DailyMessage | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('daily_messages')
    .select('*')
    .eq('message_date', todayDateString())
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('[daily-message/page] Failed to load today\'s message:', error)
    return { message: null, error: "Failed to load today's message — check the server logs." }
  }

  return { message: data as DailyMessage | null, error: null }
}

async function getHistory(): Promise<{ history: DailyMessage[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('daily_messages')
    .select('*')
    .is('deleted_at', null)
    .order('message_date', { ascending: false })
    .limit(7)

  if (error) {
    console.error('[daily-message/page] Failed to load history:', error)
    return { history: [], error: 'Failed to load recent history — check the server logs.' }
  }

  return { history: (data ?? []) as DailyMessage[], error: null }
}

export default async function DailyMessagePage() {
  const [{ message: todayMessage, error: todayError }, { history, error: historyError }] = await Promise.all([
    getTodayMessage(),
    getHistory(),
  ])

  const loadError = todayError || historyError || null

  return (
    <div className="flex h-full flex-col min-h-0">
      <DailyMessageForm
        initialTodayMessage={todayMessage}
        initialHistory={history}
        initialLoadError={loadError}
      />
    </div>
  )
}
