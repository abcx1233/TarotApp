import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TEST_MODE_COOKIE } from '@/lib/test-mode'

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

  // Per-browser-session, from a cookie — see lib/test-mode.ts.
  const initialTestMode = cookies().get(TEST_MODE_COOKIE)?.value === '1'

  return <DashboardLayout initialTestMode={initialTestMode}>{children}</DashboardLayout>
}
