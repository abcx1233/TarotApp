import { google } from 'googleapis'
import { createOAuth2Client, isGmailConfigured } from './auth'

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  from?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

function buildRawEmail(opts: SendEmailOptions): string {
  const from = opts.from || process.env.GMAIL_SENDER_ADDRESS || ''
  const lines = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    opts.body,
  ]
  return Buffer.from(lines.join('\n')).toString('base64url')
}

export async function sendReadingEmail(
  opts: SendEmailOptions
): Promise<SendEmailResult> {
  if (!isGmailConfigured()) {
    return {
      success: false,
      error:
        'Gmail is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_SENDER_ADDRESS to your environment.',
    }
  }

  try {
    const auth = createOAuth2Client()
    const gmail = google.gmail({ version: 'v1', auth })

    const raw = buildRawEmail(opts)

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    return {
      success: true,
      messageId: response.data.id ?? undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
