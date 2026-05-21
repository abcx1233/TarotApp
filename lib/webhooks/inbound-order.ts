import { createClient } from '@supabase/supabase-js'
import { suggestTopic } from './stripe-parser'
import type { ParsedInboundOrder } from './stripe-parser'
import { TONE_PRESETS } from '@/lib/ai/prompts/tone-presets'

// Uses service role for webhook processing — never call from client
function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  // Fall back to publishable key if service role not provided
  const apiKey = key || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!apiKey) throw new Error('Supabase key is not set')

  return createClient(url, apiKey)
}

function getDefaultTonePresetName(tier: string): string {
  if (tier === 'mini' || tier === 'core') return 'Intuitive & Personal'
  return 'Deep Dive & Psychological'
}

export async function createOrderFromWebhook(order: ParsedInboundOrder): Promise<{
  clientId: string
  orderId: string
}> {
  const supabase = getServiceSupabase()

  // 1. Upsert client by email
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, is_returning')
    .eq('email', order.clientEmail)
    .limit(1)

  let clientId: string
  const isReturning = (existingClients?.length ?? 0) > 0

  if (isReturning && existingClients?.[0]) {
    clientId = existingClients[0].id
    // Mark as returning
    await supabase
      .from('clients')
      .update({ is_returning: true, updated_at: new Date().toISOString() })
      .eq('id', clientId)
  } else {
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        full_name: order.clientName,
        email: order.clientEmail,
        star_sign: order.starSign ?? null,
        is_returning: false,
      })
      .select('id')
      .single()

    if (error || !newClient) throw new Error(`Failed to create client: ${error?.message}`)
    clientId = newClient.id
  }

  // 2. Determine topic
  const topic = order.questionOrFocus ? suggestTopic(order.questionOrFocus) : 'General'

  // 3. Create order
  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      client_id: clientId,
      source: 'stripe',
      source_order_id: order.sourceOrderId,
      reading_tier: order.readingTier,
      topic,
      delivery_format: order.deliveryFormat,
      delivery_channel: 'email',
      status: 'pending',
      price_total: order.priceTotal,
      is_rush: order.isRush,
    })
    .select('id')
    .single()

  if (orderError || !newOrder) throw new Error(`Failed to create order: ${orderError?.message}`)
  const orderId = newOrder.id

  // 4. Create add-on records
  if (order.addons.length > 0) {
    await supabase.from('order_addons').insert(
      order.addons.map((addon) => ({
        order_id: orderId,
        addon_type: addon.type,
        addon_price: addon.price,
        addon_notes: addon.notes ?? null,
      }))
    )
  }

  // 5. Create initial reading record
  const tonePresetName = getDefaultTonePresetName(order.readingTier)
  const { data: tonePreset } = await supabase
    .from('tone_presets')
    .select('id')
    .eq('name', tonePresetName)
    .limit(1)
    .single()

  const characterTargets: Record<string, number> = {
    mini: 3000,
    core: 6000,
    premium: 12000,
    celtic_cross: 5000,
  }

  await supabase.from('readings').insert({
    order_id: orderId,
    client_id: clientId,
    character_target: characterTargets[order.readingTier] ?? 6000,
    tone_preset_id: tonePreset?.id ?? null,
    question_or_focus: order.questionOrFocus ?? null,
    include_oracle_card: order.includeOracleCard,
    include_energy_cleansing: order.includeEnergyCleansing,
    prompt_version: 1,
    regenerated_count: 0,
    final_approved: false,
  })

  return { clientId, orderId }
}
