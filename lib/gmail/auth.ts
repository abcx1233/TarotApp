import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/gmail.send']

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_SENDER_ADDRESS
  )
}

export function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Gmail OAuth2 credentials are not configured.')
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : 'http://localhost:3000'

  const redirectUri = `${baseUrl}/api/auth/gmail/callback`

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  if (process.env.GMAIL_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    })
  }

  return oauth2Client
}

export function getAuthUrl(appBaseUrl: string): string {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Gmail OAuth2 credentials are not configured.')
  }

  const redirectUri = `${appBaseUrl}/api/auth/gmail/callback`
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export { SCOPES }
