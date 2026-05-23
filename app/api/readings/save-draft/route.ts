import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCardBySuit } from '@/data/tarot-cards'
import { ADDON_PRICES } from '@/lib/config/pricing'
import type { ReadingFormState, CardEntryForm } from '@/types'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { formState: ReadingFormState; isTestMode?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { formState: f, isTestMode = false } = body

  // Upsert client
  let clientId: string | null = f.clientId

  if (clientId) {
    if (f.clientPhone?.trim()) {
      await supabase.from('clients').update({ phone: f.clientPhone.trim() }).eq('id', clientId)
    }
  } else if (!clientId && f.clientEmail?.trim()) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('email', f.clientEmail.trim())
      .limit(1)
      .single()

    if (existing) {
      clientId = existing.id
      if (f.clientPhone?.trim()) {
        await supabase.from('clients').update({ phone: f.clientPhone.trim() }).eq('id', clientId)
      }
    } else if (f.clientName?.trim()) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          full_name: f.clientName.trim(),
          email: f.clientEmail.trim(),
          phone: f.clientPhone?.trim() || null,
          star_sign: f.starSign || null,
          is_returning: f.isReturningClient || false,
          is_test: isTestMode,
        })
        .select('id')
        .single()
      clientId = newClient?.id ?? null
    }
  } else if (!clientId && f.clientName?.trim()) {
    const { data: newClient } = await supabase
      .from('clients')
      .insert({
        full_name: f.clientName.trim(),
        email: f.clientEmail?.trim() || null,
        phone: f.clientPhone?.trim() || null,
        star_sign: f.starSign || null,
        is_returning: f.isReturningClient || false,
        is_test: isTestMode,
      })
      .select('id')
      .single()
    clientId = newClient?.id ?? null
  }

  // Create or update order (don't downgrade existing status)
  let orderId: string
  const orderBase = {
    client_id: clientId,
    reading_tier: f.readingTier || 'core',
    topic: f.topic || 'General',
    delivery_format: f.deliveryFormat || 'written',
    delivery_channel: 'email',
    price_total: parseFloat(f.priceTotal || '0') || 0,
    is_rush: f.isRush || false,
    due_at: f.dueAt || null,
    is_test: isTestMode,
    updated_at: new Date().toISOString(),
  }

  if (f.savedOrderId) {
    await supabase.from('orders').update(orderBase).eq('id', f.savedOrderId)
    orderId = f.savedOrderId
  } else {
    const { data: newOrder } = await supabase
      .from('orders')
      .insert({ ...orderBase, status: 'pending', source: 'manual' })
      .select('id')
      .single()
    orderId = newOrder?.id ?? ''
  }

  // Save order addons (follow-up)
  if (orderId) {
    await supabase.from('order_addons').delete().eq('order_id', orderId).eq('addon_type', 'follow_up')
    if (f.includeFollowUp) {
      await supabase.from('order_addons').insert({
        order_id: orderId,
        addon_type: 'follow_up',
        addon_price: ADDON_PRICES.follow_up,
        addon_notes: null,
      })
    }
  }

  // Save reading (preserve generated_reading if exists)
  const readingPayload = {
    order_id: orderId || null,
    client_id: clientId,
    character_target: f.readingLength || 6000,
    tone_preset_id: f.tonePresetId || null,
    question_or_focus: f.questionsOrFocus || null,
    future_timeframe: f.futureTimeframe || null,
    bottom_of_deck_card: f.bottomCard?.name || null,
    bottom_of_deck_orientation: f.bottomCard?.orientation || 'upright',
    oracle_card_name: f.includeOracleCard ? f.oracleCardName || null : null,
    include_oracle_card: f.includeOracleCard || false,
    include_energy_cleansing: f.includeEnergyCleansing || false,
    energy_cleansing_notes: f.energyCleansingNotes || null,
    specific_question: f.includeExtraQuestion && f.extraQuestionText?.trim() ? f.extraQuestionText.trim() : null,
    generated_reading: f.generatedReading ?? null,
    is_test: isTestMode,
    updated_at: new Date().toISOString(),
  }

  let readingId: string

  if (f.savedReadingId) {
    await supabase.from('readings').update(readingPayload).eq('id', f.savedReadingId)
    readingId = f.savedReadingId
  } else {
    const { data: newReading } = await supabase
      .from('readings')
      .insert({ ...readingPayload, regenerated_count: 0, final_approved: false })
      .select('id')
      .single()
    readingId = newReading?.id ?? ''
  }

  // Save cards (only if valid cards exist)
  const validCards = (f.cards ?? []).filter((c: CardEntryForm) => c.name?.trim())

  if (readingId && validCards.length > 0) {
    await supabase.from('reading_cards').delete().eq('reading_id', readingId)

    const cardInserts = validCards.map((card: CardEntryForm, i: number) => {
      const tarotCard = getCardBySuit(card.name)
      return {
        reading_id: readingId,
        card_name: card.name,
        suit: tarotCard?.suit ?? 'Unknown',
        orientation: card.orientation,
        position_label: card.positionLabel || null,
        sort_order: i,
        is_bottom_card: false,
      }
    })

    if (f.bottomCard?.name?.trim()) {
      const bottomTarotCard = getCardBySuit(f.bottomCard.name)
      cardInserts.push({
        reading_id: readingId,
        card_name: f.bottomCard.name,
        suit: bottomTarotCard?.suit ?? 'Unknown',
        orientation: f.bottomCard.orientation,
        position_label: 'Bottom of Deck',
        sort_order: 999,
        is_bottom_card: true,
      })
    }

    await supabase.from('reading_cards').insert(cardInserts)
  }

  return NextResponse.json({ readingId, orderId })
}
