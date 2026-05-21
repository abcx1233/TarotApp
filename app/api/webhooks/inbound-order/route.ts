import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createOrderFromWebhook } from '@/lib/webhooks/inbound-order'
import { parseStripeMetadata } from '@/lib/webhooks/stripe-parser'

// Disable body parsing — needed for Stripe signature verification
export const runtime = 'nodejs'

async function handleStripe(request: Request, rawBody: Buffer): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook secret not configured' }, { status: 500 })
  }

  const stripe = new Stripe(process.env.STRIPE_WEBHOOK_SECRET ?? '', {
    apiVersion: '2024-06-20' as const,
  })

  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: `Webhook verification failed: ${msg}` }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const parsed = parseStripeMetadata(session)

  if (!parsed.clientEmail) {
    return NextResponse.json({ error: 'No client email in Stripe session' }, { status: 422 })
  }

  const result = await createOrderFromWebhook(parsed)
  return NextResponse.json({ success: true, ...result })
}

async function handleGenericWebhook(request: Request, body: Record<string, unknown>): Promise<NextResponse> {
  const webhookSecret = process.env.WEBHOOK_SECRET
  const providedSecret = request.headers.get('x-webhook-secret')

  if (!webhookSecret || providedSecret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse generic webhook body
  const parsed = {
    clientName: (body.client_name ?? body.name ?? 'Unknown') as string,
    clientEmail: (body.email ?? body.client_email ?? '') as string,
    starSign: body.star_sign as string | undefined,
    readingTier: (body.reading_tier ?? body.tier ?? 'core') as 'mini' | 'core' | 'premium' | 'celtic_cross',
    deliveryFormat: (body.delivery_format ?? body.format ?? 'written') as 'written' | 'voice_note' | 'video',
    questionOrFocus: (body.question ?? body.focus ?? body.questions_or_focus ?? '') as string,
    priceTotal: Number(body.price_total ?? body.amount ?? 0),
    sourceOrderId: (body.order_id ?? body.stripe_payment_id ?? '') as string,
    isRush: Boolean(body.is_rush ?? body.rush_24h),
    includeOracleCard: Boolean(body.oracle_card),
    includeEnergyCleansing: Boolean(body.energy_cleansing),
    addons: [] as { type: 'oracle_card' | 'energy_cleansing' | 'extra_question' | 'follow_up' | 'rush_24h'; price: number }[],
  }

  if (!parsed.clientEmail) {
    return NextResponse.json({ error: 'client email is required' }, { status: 422 })
  }

  const result = await createOrderFromWebhook(parsed)
  return NextResponse.json({ success: true, ...result })
}

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer())
  const isStripe = !!request.headers.get('stripe-signature')

  try {
    if (isStripe) {
      return await handleStripe(request, rawBody)
    }

    // Generic webhook (Supabase DB webhook or Zapier)
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(rawBody.toString())
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    return await handleGenericWebhook(request, body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[inbound-order webhook]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
