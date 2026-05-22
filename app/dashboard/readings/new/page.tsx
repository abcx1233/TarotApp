import { createClient } from '@/lib/supabase/server'
import { ReadingForm } from '@/components/readings/ReadingForm'
import { TONE_PRESETS as FALLBACK_PRESETS } from '@/lib/ai/prompts/tone-presets'
import type { TonePreset, RestoredReadingData } from '@/types'

export const metadata = {
  title: 'New Reading — Reader Console',
}

async function getTonePresets(): Promise<TonePreset[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tone_presets')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data || data.length === 0) {
    return FALLBACK_PRESETS.map((p, i) => ({
      id: `fallback-${i}`,
      name: p.name,
      description: p.description,
      prompt_text: p.promptText,
      is_default: i === 0,
      default_for_tier: p.defaultForTiers,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  }

  return data as TonePreset[]
}

async function fetchReadingById(readingId: string): Promise<RestoredReadingData | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('readings')
    .select(`
      id,
      tone_preset_id,
      character_target,
      question_or_focus,
      specific_question,
      bottom_of_deck_card,
      bottom_of_deck_orientation,
      oracle_card_name,
      include_oracle_card,
      include_energy_cleansing,
      energy_cleansing_notes,
      reader_notes,
      generated_reading,
      order:orders ( id, reading_tier, topic, delivery_format, delivery_channel, price_total, is_rush, due_at ),
      client:clients ( id, full_name, email, phone, star_sign, birthday, is_returning ),
      cards:reading_cards ( card_name, orientation, position_label, sort_order, is_bottom_card )
    `)
    .eq('id', readingId)
    .single()

  return data as RestoredReadingData | null
}

async function fetchReadingByOrderId(orderId: string): Promise<RestoredReadingData | null> {
  const supabase = createClient()

  // Look for an existing reading for this order
  const { data: readingRow } = await supabase
    .from('readings')
    .select('id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (readingRow?.id) {
    return fetchReadingById(readingRow.id)
  }

  // No reading yet — pre-fill from order + client only
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, reading_tier, topic, delivery_format, delivery_channel,
      price_total, is_rush, due_at,
      client:clients ( id, full_name, email, phone, star_sign, birthday, is_returning )
    `)
    .eq('id', orderId)
    .single()

  if (!order) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderAny = order as any

  return {
    id: '',
    tone_preset_id: null,
    character_target: null,
    question_or_focus: null,
    specific_question: null,
    bottom_of_deck_card: null,
    bottom_of_deck_orientation: 'upright',
    oracle_card_name: null,
    include_oracle_card: false,
    include_energy_cleansing: false,
    energy_cleansing_notes: null,
    reader_notes: null,
    generated_reading: null,
    order: {
      id: orderAny.id,
      reading_tier: orderAny.reading_tier,
      topic: orderAny.topic,
      delivery_format: orderAny.delivery_format,
      delivery_channel: orderAny.delivery_channel,
      price_total: orderAny.price_total,
      is_rush: orderAny.is_rush,
      due_at: orderAny.due_at,
    },
    client: orderAny.client ?? null,
    cards: [],
  }
}

export default async function NewReadingPage({
  searchParams,
}: {
  searchParams: { readingId?: string | string[]; orderId?: string | string[] }
}) {
  const readingId = typeof searchParams.readingId === 'string' ? searchParams.readingId : undefined
  const orderId = typeof searchParams.orderId === 'string' ? searchParams.orderId : undefined

  const [tonePresets, initialReading] = await Promise.all([
    getTonePresets(),
    readingId
      ? fetchReadingById(readingId)
      : orderId
      ? fetchReadingByOrderId(orderId)
      : Promise.resolve(null),
  ])

  return (
    <div className="flex h-full flex-col min-h-0">
      <ReadingForm initialTonePresets={tonePresets} initialReading={initialReading} />
    </div>
  )
}
