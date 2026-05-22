import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('test_mode_enabled')
    .limit(1)
    .single()

  const initialTestMode = settings?.test_mode_enabled ?? false

  return <DashboardLayout initialTestMode={initialTestMode}>{children}</DashboardLayout>
}
