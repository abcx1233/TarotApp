import { NextResponse, type NextRequest } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Auth guard
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>Gmail authorisation failed</h2>
        <p>Error: ${error}</p>
        <p><a href="/dashboard/settings">← Back to settings</a></p>
      </body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/settings', request.nextUrl.origin))
  }

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const redirectUri = `${request.nextUrl.origin}/api/auth/gmail/callback`

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>Gmail not configured</h2>
        <p>Missing <code>GMAIL_CLIENT_ID</code> or <code>GMAIL_CLIENT_SECRET</code>.</p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const { tokens } = await oauth2Client.getToken(code)
  const refreshToken = tokens.refresh_token

  return new NextResponse(
    `<html>
      <body style="font-family:sans-serif;padding:2rem;max-width:560px">
        <h2 style="color:#1e3a8a">Gmail connected ✓</h2>
        <p>Copy your refresh token below and add it to your environment as <code>GMAIL_REFRESH_TOKEN</code>.</p>
        <p>After adding it to your deployment, redeploy for it to take effect.</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:1rem;word-break:break-all;font-family:monospace;font-size:12px;border:1px solid #cbd5e1">
          ${refreshToken ?? '⚠ No refresh token returned. Make sure prompt=consent was set.'}
        </div>
        <p style="margin-top:1.5rem"><a href="/dashboard/settings" style="color:#4f46e5">← Back to settings</a></p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
