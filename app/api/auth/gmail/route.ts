import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/gmail/auth'

export async function GET(request: NextRequest) {
  // Auth guard
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>Gmail not configured</h2>
        <p>Add <code>GMAIL_CLIENT_ID</code> and <code>GMAIL_CLIENT_SECRET</code> to your environment variables.</p>
        <p><a href="/dashboard/settings">← Back to settings</a></p>
      </body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const origin = request.nextUrl.origin
  const authUrl = getAuthUrl(origin)

  return NextResponse.redirect(authUrl)
}
