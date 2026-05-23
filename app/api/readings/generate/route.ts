import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFullReading } from '@/lib/ai/generate'
import { chatComplete } from '@/lib/ai/client'
import { formatAiError } from '@/lib/ai/errors'
import { READING_CHARACTER_TARGETS, AI_CONFIG } from '@/lib/ai/config'
import { ADDON_PRICES } from '@/lib/config/pricing'
import { getCardBySuit } from '@/data/tarot-cards'
import type { ReadingFormState, CardEntryForm } from '@/types'
import type { PromptInput } from '@/lib/ai/prompts/builder'

function trimAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const sub = text.slice(0, maxLength)
  for (let i = sub.length - 1; i >= 0; i--) {
    if (['.', '!', '?'].includes(sub[i])) return sub.slice(0, i + 1)
  }
  return sub
}

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
  let body: { formState: ReadingFormState; tonePresetText: string; isTestMode?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { formState: f, tonePresetText, isTestMode = false } = body

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
    questionsOrFocus: f.questionsOrFocus || undefined,
    starSign: f.starSign || undefined,
    isReturningClient: f.isReturningClient || false,
    cards: validCards.map(mapCardToPromptInput),
    bottomCard: {
      name: f.bottomCard?.name || '',
      orientation: f.bottomCard?.orientation || 'upright',
    },
    oracleCardName: f.includeOracleCard && f.oracleCardName ? f.oracleCardName : undefined,
    includeEnergyCleansing: f.includeEnergyCleansing || false,
    energyCleansingNotes: f.energyCleansingNotes || undefined,
    specificQuestion: f.includeExtraQuestion && f.extraQuestionText?.trim() ? f.extraQuestionText.trim() : undefined,
    futureTimeframe: f.futureTimeframe || undefined,
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

  const { generatedReading: rawReading, generatedPrompt, groqModel } = generationResult

  console.log('Future section included:', rawReading.includes('Future Energy'))

  // Length check and optional continuation
  const minLength = Math.floor(characterTarget * 0.85)
  const maxLength = Math.ceil(characterTarget * 1.15)
  let finalReading = rawReading

  if (finalReading.length > maxLength) {
    finalReading = trimAtSentence(finalReading, maxLength)
  }

  let attempts = 0
  while (finalReading.length < minLength && attempts < 2) {
    attempts++
    const tail = finalReading.slice(-2000)
    try {
      const continuation = await chatComplete(
        'You are an expert tarot reader. Continue the reading exactly where it left off.',
        `The tarot reading so far is ${finalReading.length} characters. It needs at least ${minLength} characters. Continue naturally from where it ended. Do not repeat anything already written. Do not add a sign-off or closing — only continue the body of the reading.\n\n...\n${tail}`,
        AI_CONFIG.maxTokens
      )
      finalReading = finalReading + '\n\n' + continuation
      if (finalReading.length > maxLength) finalReading = trimAtSentence(finalReading, maxLength)
    } catch {
      break
    }
  }

  const lengthStatus =
    finalReading.length < minLength ? 'SHORT' :
    finalReading.length > maxLength ? 'TRIMMED' : 'PASS'
  console.log(`Reading length: ${finalReading.length} chars / ${characterTarget} target — ${lengthStatus}`)

  // Append sign-off and disclaimer from the default template
  let generatedReading = finalReading
  const { data: defaultTemplate } = await supabase
    .from('reading_templates')
    .select('signoff_text, disclaimer_text')
    .eq('is_default', true)
    .limit(1)
    .single()

  if (defaultTemplate?.signoff_text?.trim()) {
    generatedReading += `\n\n${defaultTemplate.signoff_text.trim()}`
  }
  if (defaultTemplate?.disclaimer_text?.trim()) {
    generatedReading += `\n\n${defaultTemplate.disclaimer_text.trim()}`
  }

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

  // Create or update order
  let orderId: string
  const orderPayload = {
    client_id: clientId,
    reading_tier: f.readingTier || 'core',
    topic: f.topic || 'General',
    delivery_format: f.deliveryFormat || 'written',
    delivery_channel: 'email',
    status: 'awaiting_review' as const,
    price_total: parseFloat(f.priceTotal || '0') || 0,
    is_rush: f.isRush || false,
    due_at: f.dueAt || null,
    is_test: isTestMode,
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

  // Fetch tone preset id
  const tonePresetId: string | null = f.tonePresetId || null

  // Save reading
  const readingPayload = {
    order_id: orderId || null,
    client_id: clientId,
    character_target: characterTarget,
    tone_preset_id: tonePresetId,
    question_or_focus: f.questionsOrFocus || null,
    bottom_of_deck_card: f.bottomCard?.name || null,
    bottom_of_deck_orientation: f.bottomCard?.orientation || 'upright',
    oracle_card_name: f.includeOracleCard ? f.oracleCardName || null : null,
    include_oracle_card: f.includeOracleCard || false,
    include_energy_cleansing: f.includeEnergyCleansing || false,
    energy_cleansing_notes: f.energyCleansingNotes || null,
    specific_question: f.includeExtraQuestion && f.extraQuestionText?.trim() ? f.extraQuestionText.trim() : null,
    future_timeframe: f.futureTimeframe || null,
    generated_prompt: generatedPrompt,
    generated_reading: generatedReading,
    email_version: null,
    whatsapp_version: null,
    groq_model: groqModel,
    prompt_version: 1,
    final_approved: false,
    is_test: isTestMode,
    updated_at: new Date().toISOString(),
  }

  let readingId: string

  if (f.savedReadingId) {
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
  })
}
