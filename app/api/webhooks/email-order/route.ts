import { NextResponse } from 'next/server'
import { parseEmailOrder } from '@/lib/webhooks/email-parser'
import { createOrderFromWebhook } from '@/lib/webhooks/inbound-order'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const webhookSecret = process.env.WEBHOOK_SECRET
  const providedSecret = request.headers.get('x-webhook-secret')

  if (!webhookSecret || providedSecret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.text()
  if (!body.trim()) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 })
  }

  const parsed = parseEmailOrder(body)

  if (!parsed.clientEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 422 })
  }

  try {
    const result = await createOrderFromWebhook(parsed)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[email-order webhook]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
