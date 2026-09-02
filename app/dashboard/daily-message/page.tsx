import { createClient } from '@/lib/supabase/server'
import { DailyMessageForm } from '@/components/daily-message/DailyMessageForm'
import type { DailyMessage } from '@/types'

export const metadata = {
  title: 'Daily Card Message — Reader Console',
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getTodayMessage(): Promise<DailyMessage | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('daily_messages')
    .select('*')
    .eq('message_date', todayDateString())
    .single()

  return (data as DailyMessage) ?? null
}

async function getHistory(): Promise<DailyMessage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('daily_messages')
    .select('*')
    .order('message_date', { ascending: false })
    .limit(7)

  return (data as DailyMessage[]) ?? []
}

export default async function DailyMessagePage() {
  const [todayMessage, history] = await Promise.all([getTodayMessage(), getHistory()])

  return (
    <div className="flex h-full flex-col min-h-0">
      <DailyMessageForm initialTodayMessage={todayMessage} initialHistory={history} />
    </div>
  )
}
