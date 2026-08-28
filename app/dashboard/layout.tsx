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
    data: { session },
  } = await supabase.auth.getSession()

  // Use getSession() here (not getUser()) so a transient Supabase network
  // failure can't kick an authenticated user to /login and trigger a redirect
  // loop with the middleware's /login→/dashboard guard.
  if (!session) {
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
