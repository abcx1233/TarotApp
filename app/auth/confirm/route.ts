import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Landing point for Supabase invite/recovery email links. Configure the
// corresponding email templates in the Supabase dashboard (Authentication →
// Email Templates) to point at:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}
// This exchanges the one-time token for a real session (setting the auth
// cookies) before handing off to /auth/set-password, which needs that
// session to call supabase.auth.updateUser(). Must stay in the middleware's
// isPublic list — there is no session yet when this route is first hit.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/set-password?type=${type}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('That link is invalid or has expired. Please request a new one.')}`
  )
}
