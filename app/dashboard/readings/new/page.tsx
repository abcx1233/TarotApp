import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'
import { Trash2, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ReadingForm } from '@/components/readings/ReadingForm'
import { Button } from '@/components/ui/Button'
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
      audit_score,
      audit_checks,
      audit_generated_at,
      deleted_at,
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

  // Look for an existing reading for this order — the newest one that isn't in
  // Trash first. Only if every reading for the order is trashed do we fall back
  // to the newest trashed one, and then the page blocks it (TrashedReadingNotice)
  // rather than loading it into the form, where edits would land on a hidden row.
  const { data: liveReadingRow } = await supabase
    .from('readings')
    .select('id')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (liveReadingRow?.id) {
    return fetchReadingById(liveReadingRow.id)
  }

  const { data: trashedReadingRow } = await supabase
    .from('readings')
    .select('id')
    .eq('order_id', orderId)
    .not('deleted_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (trashedReadingRow?.id) {
    return fetchReadingById(trashedReadingRow.id)
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
    audit_score: null,
    audit_checks: null,
    audit_generated_at: null,
    deleted_at: null,
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

// Mirrors RETENTION_DAYS in app/dashboard/trash/page.tsx — past this the item
// no longer appears in Trash, so there's nothing to send the user to.
const TRASH_RETENTION_DAYS = 30

const TIER_LABELS: Record<string, string> = {
  mini: 'Mini', core: 'Core', premium: 'Premium', celtic_cross: 'Celtic Cross',
}

/**
 * Shown instead of the form when the reading being opened is in Trash.
 * Deliberately doesn't restore it here: restoring happens from Trash, the same
 * as for clients, orders and daily messages, so the user always sees it.
 */
function TrashedReadingNotice({ reading }: { reading: RestoredReadingData }) {
  const deletedAt = new Date(reading.deleted_at!)
  const stillInTrash = differenceInDays(new Date(), deletedAt) < TRASH_RETENTION_DAYS
  const clientName = reading.client?.full_name
  const tier = reading.order?.reading_tier ? TIER_LABELS[reading.order.reading_tier] ?? reading.order.reading_tier : null
  const description = [clientName ? `${clientName}'s` : 'This', tier, 'reading'].filter(Boolean).join(' ')

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
            <Trash2 size={18} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">This reading is in Trash</h1>
            <p className="mt-1 text-sm text-slate-600">
              {description} was moved to Trash on {format(deletedAt, 'd MMMM yyyy')}. It can&apos;t be
              opened or edited while it&apos;s in Trash, because changes would be saved to a hidden reading.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {stillInTrash
                ? 'Restore it from Trash first, then open the order again.'
                : `It was deleted more than ${TRASH_RETENTION_DAYS} days ago, so it no longer appears in Trash and can't be restored from here.`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {stillInTrash && (
            <Link href="/dashboard/trash?tab=readings">
              <Button size="sm">
                <RotateCcw size={13} />
                Go to Trash to restore
              </Button>
            </Link>
          )}
          <Link href="/dashboard/orders">
            <Button size="sm" variant="outline">Back to Orders</Button>
          </Link>
        </div>
      </div>
    </div>
  )
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

  if (initialReading?.deleted_at) {
    return <TrashedReadingNotice reading={initialReading} />
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      <ReadingForm initialTonePresets={tonePresets} initialReading={initialReading} />
    </div>
  )
}
