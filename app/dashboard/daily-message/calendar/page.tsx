import { CalendarView } from '@/components/daily-message/CalendarView'

export const metadata = {
  title: 'Daily Message Calendar — Reader Console',
}

export default function DailyMessageCalendarPage() {
  return (
    <div className="flex h-full flex-col min-h-0">
      <CalendarView />
    </div>
  )
}
