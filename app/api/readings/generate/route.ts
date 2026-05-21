import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFullReading } from '@/lib/ai/generate'
import { formatAiError } from '@/lib/ai/errors'
import { READING_CHARACTER_TARGETS } from '@/lib/ai/config'
import { getCardBySuit } from '@/data/tarot-cards'
import type { ReadingFormState, CardEntryForm } from '@/types'
import type { PromptInput } from '@/lib/ai/prompts/builder'

function mapCardToPromptInput(card: CardEntryForm) {
  return {
    name: card.name,
    orientation: card.orientation,
    positionLabel: card.positionLabel || undefined,
  }
}

export async function POST(request: Request) {
  // Auth check
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { formState: ReadingFormState; tonePresetText: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { formState: f, tonePresetText } = body

  // Validate
  if (!tonePresetText?.trim()) {
    return NextResponse.json({ error: 'Tone preset text is required' }, { status: 422 })
  }

  const validCards = (f.cards ?? []).filter((c: CardEntryForm) => c.name?.trim())
  if (validCards.length === 0) {
    return NextResponse.json({ error: 'At least one card is required' }, { status: 422 })
  }

  // Build prompt input
  const characterTarget =
    f.readingLength || READING_CHARACTER_TARGETS[f.readingTier] || 6000

  const promptInput: PromptInput = {
    tonePresetText,
    characterTarget,
    topic: f.topic || 'General',
    specificQuestion: f.specificQuestion || undefined,
    mainFocus: f.mainFocus || undefined,
    cards: validCards.map(mapCardToPromptInput),
    bottomCard: {
      name: f.bottomCard?.name || '',
      orientation: f.bottomCard?.orientation || 'upright',
    },
    oracleCardName: f.includeOracleCard && f.oracleCardName ? f.oracleCardName : undefined,
    includeEnergyCleansing: f.includeEnergyCleansing || false,
    energyCleansingNotes: f.energyCleansingNotes || undefined,
    birthday: f.birthday || undefined,
    starSign: f.starSign || undefined,
    pronouns: f.pronouns || undefined,
    relationshipStatus: f.relationshipStatus || undefined,
    otherPersonName: f.otherPersonName || undefined,
    isReturningClient: f.isReturningClient || false,
  }

  // Generate
  let generationResult
  try {
    generationResult = await generateFullReading(promptInput)
  } catch (err) {
    return NextResponse.json(
      { error: formatAiError(err) },
      { status: 500 }
    )
  }

  const { generatedReading, emailVersion, whatsappVersion, generatedPrompt, groqModel } =
    generationResult

  // Upsert client
  let clientId: string | null = f.clientId

  if (!clientId && f.clientEmail?.trim()) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('email', f.clientEmail.trim())
      .limit(1)
      .single()

    if (existing) {
      clientId = existing.id
    } else if (f.clientName?.trim()) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          full_name: f.clientName.trim(),
          email: f.clientEmail.trim(),
          star_sign: f.starSign || null,
          is_returning: f.isReturningClient || false,
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
        star_sign: f.starSign || null,
        is_returning: f.isReturningClient || false,
      })
      .select('id')
      .single()
    clientId = newClient?.id ?? null
  }

  // Create or update order
  let orderId: string
  const orderPayload = {
    client_id: clientId,
    reading_tier: f.readingTier || 'core',
    topic: f.topic || 'General',
    delivery_format: f.deliveryFormat || 'written',
    delivery_channel: f.deliveryChannel || 'email',
    status: 'awaiting_review' as const,
    price_total: parseFloat(f.priceTotal || '0') || 0,
    is_rush: f.isRush || false,
    due_at: f.dueAt || null,
    internal_notes: f.readerNotes || null,
    updated_at: new Date().toISOString(),
  }

  if (f.savedOrderId) {
    await supabase.from('orders').update(orderPayload).eq('id', f.savedOrderId)
    orderId = f.savedOrderId
  } else {
    const { data: newOrder } = await supabase
      .from('orders')
      .insert({ ...orderPayload, source: 'manual' })
      .select('id')
      .single()
    orderId = newOrder?.id ?? ''
  }

  // Fetch tone preset id
  let tonePresetId: string | null = f.tonePresetId || null

  // Save reading
  const readingPayload = {
    order_id: orderId || null,
    client_id: clientId,
    character_target: characterTarget,
    tone_preset_id: tonePresetId,
    question_or_focus: f.mainFocus || null,
    specific_question: f.specificQuestion || null,
    bottom_of_deck_card: f.bottomCard?.name || null,
    bottom_of_deck_orientation: f.bottomCard?.orientation || 'upright',
    oracle_card_name: f.includeOracleCard ? f.oracleCardName || null : null,
    include_oracle_card: f.includeOracleCard || false,
    include_energy_cleansing: f.includeEnergyCleansing || false,
    energy_cleansing_notes: f.energyCleansingNotes || null,
    reader_notes: f.readerNotes || null,
    generated_prompt: generatedPrompt,
    generated_reading: generatedReading,
    email_version: emailVersion,
    whatsapp_version: whatsappVersion,
    groq_model: groqModel,
    prompt_version: 1,
    final_approved: false,
    updated_at: new Date().toISOString(),
  }

  let readingId: string

  if (f.savedReadingId) {
    // Get current regenerated_count and increment
    const { data: existingReading } = await supabase
      .from('readings')
      .select('regenerated_count')
      .eq('id', f.savedReadingId)
      .single()

    await supabase
      .from('readings')
      .update({
        ...readingPayload,
        regenerated_count: (existingReading?.regenerated_count ?? 0) + 1,
      })
      .eq('id', f.savedReadingId)
    readingId = f.savedReadingId
  } else {
    const { data: newReading } = await supabase
      .from('readings')
      .insert({ ...readingPayload, regenerated_count: 0 })
      .select('id')
      .single()
    readingId = newReading?.id ?? ''
  }

  // Save reading cards
  if (readingId) {
    // Delete old cards for this reading
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

    // Add bottom card
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

    if (cardInserts.length > 0) {
      await supabase.from('reading_cards').insert(cardInserts)
    }
  }

  // Update order status
  if (orderId) {
    await supabase
      .from('orders')
      .update({ status: 'awaiting_review', updated_at: new Date().toISOString() })
      .eq('id', orderId)
  }

  return NextResponse.json({
    readingId,
    orderId,
    generatedReading,
    emailVersion,
    whatsappVersion,
  })
}
