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
  // Protect the future section and closing lines — trim only the main body
  const futureMatch = text.match(/\n\nWhat I'm Sensing/)
  if (futureMatch && futureMatch.index !== undefined) {
    const splitIdx = futureMatch.index
    const body = text.slice(0, splitIdx)
    const tail = text.slice(splitIdx)
    if (body.length <= maxLength) return text // body fits; preserve future section as-is
    const sub = body.slice(0, maxLength)
    for (let i = sub.length - 1; i >= 0; i--) {
      if (['.', '!', '?'].includes(sub[i])) return sub.slice(0, i + 1) + tail
    }
    return sub + tail
  }
  const sub = text.slice(0, maxLength)
  for (let i = sub.length - 1; i >= 0; i--) {
    if (['.', '!', '?'].includes(sub[i])) return sub.slice(0, i + 1)
  }
  return sub
}

function truncateAtEndMarker(text: string): string {
  const idx = text.indexOf('[END OF READING]')
  if (idx === -1) return text
  return text.slice(0, idx).trimEnd()
}

function truncateAfterSignOff(text: string, templateSignOff?: string): string {
  const lower = text.toLowerCase()

  // Check variants shortest-first so 'with love and light' matches before longer forms.
  // Always include the template sign-off text as the highest-priority candidate.
  const variants: string[] = [
    'with love and light',
    'with love and light ✨',
    'with love and light.',
  ]
  if (templateSignOff?.trim()) {
    const t = templateSignOff.trim().toLowerCase()
    if (!variants.includes(t)) variants.unshift(t)
  }

  let truncateAt = -1
  for (const variant of variants) {
    const idx = lower.indexOf(variant)
    if (idx !== -1) {
      truncateAt = idx + variant.length
      break
    }
  }

  if (truncateAt !== -1) {
    return text.slice(0, truncateAt).trimEnd()
  }

  return text
}

function truncateAfterClosingLines(text: string): string {
  const paragraphs = text.split(/\n\n+/)
  let lastShortSeqEnd = -1
  let i = 0

  while (i < paragraphs.length) {
    const trimmed = paragraphs[i].trim()
    if (trimmed.length > 0 && trimmed.length < 100) {
      let j = i
      while (j < paragraphs.length && paragraphs[j].trim().length < 100 && paragraphs[j].trim().length > 0) {
        j++
      }
      const seqLen = j - i
      // 3+ consecutive short paragraphs followed by longer content = likely closing lines mid-reading.
      // But if that longer content is the ritual or future section, it's legitimate — don't cut it.
      if (seqLen >= 3 && j < paragraphs.length) {
        const nextPara = paragraphs[j].trim()
        const isLegitFollower =
          nextPara.startsWith('A Ritual For You') ||
          nextPara.startsWith("What I'm Sensing") ||
          nextPara.startsWith('Oracle Card')
        if (!isLegitFollower) {
          lastShortSeqEnd = j - 1
        }
      }
      i = j
    } else {
      i++
    }
  }

  if (lastShortSeqEnd !== -1) {
    return paragraphs.slice(0, lastShortSeqEnd + 1).join('\n\n')
  }

  return text
}


function getMainBodyLength(text: string): number {
  const markers = ["\n\nWhat I'm Sensing", '\n\nOracle Card', '\n\nA Ritual For You']
  let earliest = text.length
  for (const marker of markers) {
    const idx = text.indexOf(marker)
    if (idx !== -1 && idx < earliest) earliest = idx
  }
  return earliest
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

  // Server-side dash removal (safety net — fires regardless of model compliance)
  let rawReading = _rawText
    .replace(/—/g, ', ')
    .replace(/–/g, ', ')
    .replace(/\s,\s/g, ', ')
    .replace(/,\s*,/g, ',')
  // Restore oracle card heading format damaged by em dash removal above (colon avoids dash rule)
  rawReading = rawReading.replace(/^Oracle Card[,\s]+/gm, 'Oracle Card: ')
  // Fetch template early so sign-off text is available for truncation
  const { data: defaultTemplate } = await supabase
    .from('reading_templates')
    .select('signoff_text, disclaimer_text')
    .eq('is_default', true)
    .limit(1)
    .single()

  const minLength = Math.floor(characterTarget * 0.85)
  const maxLength = Math.ceil(characterTarget * 1.15)

  // Card list for continuation prompt — must match what was given to the model
  const cardListForContinuation = [
    ...validCards.map((c: CardEntryForm) => c.name).filter(Boolean),
    ...(promptInput.bottomCard?.name?.trim() ? [`${promptInput.bottomCard.name} (bottom of deck)`] : []),
  ].join(', ')

  // Split rawReading into main body and add-on sections (oracle, ritual, future).
  // Continuations must be appended to the main body only — not after the ritual —
  // otherwise getMainBodyLength() never grows and the loop runs without effect.
  const addonMarkers = ["\n\nWhat I'm Sensing", '\n\nOracle Card', '\n\nA Ritual For You']
  let addonStart = rawReading.length
  for (const marker of addonMarkers) {
    const idx = rawReading.indexOf(marker)
    if (idx !== -1 && idx < addonStart) addonStart = idx
  }
  let mainBody = rawReading.slice(0, addonStart)
  const addons = rawReading.slice(addonStart)

  console.log('Continuation check:', mainBody.length, '/', characterTarget, 'needs:', mainBody.length < characterTarget * 0.85)

  const maxAttempts = characterTarget >= 10000 ? 4 : 2
  let attempts = 0
  while (mainBody.length < minLength && attempts < maxAttempts) {
    attempts++
    const currentLength = mainBody.length
    const tail = mainBody.slice(-2000)
    try {
      const continuationText = await chatComplete(
        'You are an expert tarot reader. Continue the reading exactly where it left off.',
        `The reading body is currently ${currentLength} characters. It needs to reach at least ${minLength} characters. You need to write approximately ${minLength - currentLength} more characters. Continue from where the reading left off with more depth and insight into the cards already present. Do not repeat anything already written. Do not add a closing or sign-off.\n\nIMPORTANT: Do not repeat or summarise any card interpretation already written above. Do not go through the cards in order again. Do not restate what has already been said about any card.\n\nInstead, go deeper into ONE OR TWO of the most significant cards in this spread. Explore the relationship between two specific cards and what they reveal together, a deeper layer of psychological truth that has not been mentioned yet, what the person might be feeling that they have not admitted to themselves yet, or the shadow aspect of a card that was only touched on in the main reading.\n\nWrite new insight, not a summary of what is already there.\n\nOnly these cards exist in this spread: ${cardListForContinuation}\n\nDo not mention any other cards.\n\nWhen you have finished writing, add this on its own line:\n[END OF READING]\n\nDo not write anything after [END OF READING].\n\n...\n${tail}`,
        AI_CONFIG.maxTokens
      )
      console.log(`Continuation ${attempts} generated:`, continuationText.length, 'chars')
      const cleanContinuation = continuationText.replace(/\[END OF READING\]/g, '').trim()
      mainBody = mainBody + '\n\n' + cleanContinuation
      console.log('rawReading after append: main body now', mainBody.length, 'chars')
      console.log(`After continuation ${attempts}:`, mainBody.length, '/', characterTarget, 'chars')
    } catch {
      break
    }
  }

  // Reassemble with add-ons now that the main body is at target length
  rawReading = mainBody + addons

  // Hard-cut ritual to at most 700 chars of content after the heading.
  // Runs once after all continuations are complete.
  const ritualIdx = rawReading.indexOf('A Ritual For You')
  if (ritualIdx !== -1) {
    const contentStart = rawReading.indexOf('\n', ritualIdx)
    if (contentStart !== -1) {
      // Find the FIRST sentence end after at least 150 chars of ritual content.
      // Using indexOf (not lastIndexOf) so we cut at the end of the first paragraph,
      // not the end of a second paragraph that the model may have added.
      let cutPoint = -1
      for (let i = contentStart + 150; i < Math.min(contentStart + 700, rawReading.length); i++) {
        const ch = rawReading[i]
        if (ch === '.' || ch === '!' || ch === '?') {
          cutPoint = i + 1
          break
        }
      }
      if (cutPoint !== -1) {
        const removed = rawReading.slice(cutPoint)
        if (removed.trim().length > 50) {
          console.log('Ritual paragraph kept:', rawReading.slice(ritualIdx, ritualIdx + 300))
          rawReading = rawReading.slice(0, cutPoint)
          console.log('Ritual hard cut at:', cutPoint, 'removed:', removed.trim().length, 'chars')
        }
      }
    }
  }

  console.log('Future section included:', rawReading.includes("What I'm Sensing"))
  console.log('END OF READING marker found:', rawReading.includes('[END OF READING]'))
  console.log('Raw text last 200 chars:', rawReading.slice(-200))

  // Truncate at [END OF READING] marker (primary mechanism), then sign-off detection
  let finalReading = truncateAtEndMarker(rawReading)
  finalReading = truncateAfterSignOff(finalReading, defaultTemplate?.signoff_text)

  if (finalReading.length > maxLength) {
    finalReading = trimAtSentence(finalReading, maxLength)
  }

  // Heuristic closing-lines detection (catches cases where marker was not used)
  finalReading = truncateAfterClosingLines(finalReading)

  // Final safety pass: marker then sign-off
  finalReading = truncateAtEndMarker(finalReading)
  finalReading = truncateAfterSignOff(finalReading, defaultTemplate?.signoff_text)

  const mainBodyLength = getMainBodyLength(finalReading)
  const lengthStatus =
    mainBodyLength < minLength ? 'SHORT' :
    mainBodyLength > maxLength ? 'TRIMMED' : 'PASS'
  console.log(`Main body: ${mainBodyLength} chars / ${characterTarget} target — ${lengthStatus} (total: ${finalReading.length} chars)`)

  // Strip any sign-off the model may have added, then always append the template sign-off.
  const templateSignOff = defaultTemplate?.signoff_text?.trim() || 'With love and light ✨'
  const signOffVariants = [
    'with love and light',
    'with love and light ✨',
    'with love and light.',
  ]
  let generatedReading = finalReading
  for (const variant of signOffVariants) {
    const idx = generatedReading.toLowerCase().lastIndexOf(variant.toLowerCase())
    if (idx !== -1) {
      generatedReading = generatedReading.slice(0, idx).trimEnd()
    }
  }
  generatedReading = generatedReading + '\n\n' + templateSignOff
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
