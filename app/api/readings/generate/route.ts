import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFullReading } from '@/lib/ai/generate'
import { chatComplete } from '@/lib/ai/client'
import { formatAiError } from '@/lib/ai/errors'
import { READING_CHARACTER_TARGETS } from '@/lib/ai/config'
import { ADDON_PRICES } from '@/lib/config/pricing'
import { getCardBySuit } from '@/data/tarot-cards'
import { auditReading, type AuditResult } from '@/lib/ai/audit'
import { assembleReadingText } from '@/lib/readings/assemble-reading'
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
    topic: f.topic || '',
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
    specificQuestion: f.includeExtraQuestion && f.extraQuestionText?.trim() ? f.extraQuestionText.trim() : undefined,
    futureTimeframe: f.futureTimeframe || undefined,
    tier: f.readingTier,
    includeFuture: f.includeFuture || false,
  }

  // Dynamic max_tokens: character_target / 3 + 500 (headroom for future section and add-ons)
  const maxTokens = Math.round(characterTarget / 3) + 500

  // Generate
  let generationResult
  try {
    generationResult = await generateFullReading(promptInput, maxTokens)
  } catch (err) {
    console.error('[route/generate] Generation error:', err)
    console.error('[route/generate] Error JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err instanceof Error ? err : {})))
    return NextResponse.json(
      { error: formatAiError(err) },
      { status: 500 }
    )
  }

  const { generatedReading: _rawText, generatedPrompt, aiModel } = generationResult

  // Fetch template early so sign-off text is available for truncation
  const { data: defaultTemplate } = await supabase
    .from('reading_templates')
    .select('signoff_text, disclaimer_text')
    .eq('is_default', true)
    .limit(1)
    .single()

  // Card list for continuation prompt — must match what was given to the model
  const cardListForContinuation = [
    ...validCards.map((c: CardEntryForm) => c.name).filter(Boolean),
    ...(promptInput.bottomCard?.name?.trim() ? [`${promptInput.bottomCard.name} (bottom of deck)`] : []),
  ].join(', ')

  // Dash strip, continuation, add-on reassembly, ritual cut, truncation, final
  // dash strip, then sign-off and disclaimer. See lib/readings/assemble-reading.ts.
  const { generatedReading, templateSignOff } = await assembleReadingText({
    rawText: _rawText,
    characterTarget,
    cardList: cardListForContinuation,
    templateSignOff: defaultTemplate?.signoff_text,
    disclaimerText: defaultTemplate?.disclaimer_text,
    complete: chatComplete,
  })

  // ── Post-generation audit ───────────────────────────────────────────────
  // Reads the finished text above. It does not and must not feed back into
  // generation, continuation or truncation — this is a report on the output,
  // not a step that changes it.
  //
  // Deliberately non-fatal: a reading that generated correctly has to save and
  // return even if auditing it falls over, so a failure here costs the audit,
  // never the reading. auditReading() already degrades internally when only the
  // model call fails; this catch is for everything else.
  const specificQuestion =
    f.includeExtraQuestion && f.extraQuestionText?.trim() ? f.extraQuestionText.trim() : null

  let audit: AuditResult | null = null
  try {
    audit = await auditReading({
      finalText: generatedReading,
      // The in-process card list, not a re-read of reading_cards, so the audit
      // sees exactly what the prompt was given.
      drawnCards: validCards.map((c: CardEntryForm) => c.name),
      bottomCard: f.bottomCard?.name || null,
      oracleCardName: f.includeOracleCard ? f.oracleCardName || null : null,
      includeOracleCard: f.includeOracleCard || false,
      includeEnergyCleansing: f.includeEnergyCleansing || false,
      characterTarget,
      signOffText: templateSignOff,
      disclaimerText: defaultTemplate?.disclaimer_text ?? null,
      topic: f.topic,
      questionOrFocus: f.questionsOrFocus || null,
      specificQuestion,
    })
    console.log(
      `Audit: ${audit.score}/100 (${audit.band})${audit.degraded ? ' [degraded]' : ''} — ` +
        `${audit.checks.filter((c) => c.status === 'fail').map((c) => c.id).join(', ') || 'all clear'}`
    )
  } catch (err) {
    console.error('[readings/generate] Audit failed, saving reading without it:', err)
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
    updated_at: new Date().toISOString(),
  }

  // is_test is set only on insert. An existing order keeps whatever it was
  // created with — regenerating a real order while Test Mode is on must never
  // relabel it as test data (Settings → "Clear all test data" deletes by it).
  if (f.savedOrderId) {
    await supabase.from('orders').update(orderPayload).eq('id', f.savedOrderId)
    orderId = f.savedOrderId
  } else {
    const { data: newOrder } = await supabase
      .from('orders')
      .insert({ ...orderPayload, source: 'manual', is_test: isTestMode })
      .select('id')
      .single()
    orderId = newOrder?.id ?? ''
  }

  // Save order addons
  if (orderId) {
    await supabase.from('order_addons').delete().eq('order_id', orderId).eq('addon_type', 'follow_up')
    if (f.includeFollowUp) {
      await supabase.from('order_addons').insert({ order_id: orderId, addon_type: 'follow_up', addon_price: ADDON_PRICES.follow_up, addon_notes: null })
    }

    await supabase.from('order_addons').delete().eq('order_id', orderId).eq('addon_type', 'oracle_card')
    if (f.includeOracleCard) {
      await supabase.from('order_addons').insert({ order_id: orderId, addon_type: 'oracle_card', addon_price: ADDON_PRICES.oracle_card, addon_notes: null })
    }

    await supabase.from('order_addons').delete().eq('order_id', orderId).eq('addon_type', 'energy_cleansing')
    if (f.includeEnergyCleansing) {
      await supabase.from('order_addons').insert({ order_id: orderId, addon_type: 'energy_cleansing', addon_price: ADDON_PRICES.energy_cleansing, addon_notes: null })
    }

    await supabase.from('order_addons').delete().eq('order_id', orderId).eq('addon_type', 'extra_question')
    if (f.includeExtraQuestion) {
      await supabase.from('order_addons').insert({ order_id: orderId, addon_type: 'extra_question', addon_price: ADDON_PRICES.extra_question, addon_notes: null })
    }

    await supabase.from('order_addons').delete().eq('order_id', orderId).eq('addon_type', 'rush_24h')
    if (f.isRush) {
      await supabase.from('order_addons').insert({ order_id: orderId, addon_type: 'rush_24h', addon_price: ADDON_PRICES.rush_24h, addon_notes: null })
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
    energy_cleansing_notes: null,
    specific_question: f.includeExtraQuestion && f.extraQuestionText?.trim() ? f.extraQuestionText.trim() : null,
    future_timeframe: f.futureTimeframe || null,
    generated_prompt: generatedPrompt,
    generated_reading: generatedReading,
    email_version: null,
    whatsapp_version: null,
    groq_model: aiModel,
    prompt_version: 1,
    final_approved: false,
    // Null when the audit could not run at all — "not audited", distinct from
    // a zero score. See supabase/migrations/add_reading_audit_columns.sql.
    audit_score: audit?.score ?? null,
    audit_checks: audit ?? null,
    audit_generated_at: audit?.generatedAt ?? null,
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
    // A new reading inherits is_test from its order, never from the toggle
    // directly. When the order was just created above it already carries
    // isTestMode; when it already existed, read its stored value so a new
    // reading under a real order can't become test data (or vice versa).
    // If that read fails, default to false: a stray non-test row is
    // recoverable, a real reading deleted by "Clear all test data" is not.
    let readingIsTest = isTestMode
    if (f.savedOrderId) {
      const { data: parentOrder } = await supabase
        .from('orders')
        .select('is_test')
        .eq('id', f.savedOrderId)
        .single()
      readingIsTest = parentOrder?.is_test ?? false
    }

    const { data: newReading } = await supabase
      .from('readings')
      .insert({ ...readingPayload, regenerated_count: 0, is_test: readingIsTest })
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
    audit,
  })
}
