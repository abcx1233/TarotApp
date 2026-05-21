import Stripe from 'stripe'
import type { ReadingTier, DeliveryFormat, AddonType } from '@/types'

export interface ParsedInboundOrder {
  clientName: string
  clientEmail: string
  starSign?: string
  readingTier: ReadingTier
  deliveryFormat: DeliveryFormat
  questionOrFocus?: string
  priceTotal: number
  sourceOrderId: string
  isRush: boolean
  includeOracleCard: boolean
  includeEnergyCleansing: boolean
  addons: Array<{ type: AddonType; price: number; notes?: string }>
}

function parseTier(raw: string): ReadingTier {
  const r = raw.toLowerCase()
  if (r.includes('mini')) return 'mini'
  if (r.includes('premium')) return 'premium'
  if (r.includes('celtic')) return 'celtic_cross'
  return 'core'
}

function parseFormat(raw: string): DeliveryFormat {
  const r = raw.toLowerCase()
  if (r.includes('voice')) return 'voice_note'
  if (r.includes('video')) return 'video'
  return 'written'
}

export function suggestTopic(questionOrFocus: string): string {
  const text = questionOrFocus.toLowerCase()
  if (/love|relationship|partner|boyfriend|girlfriend|husband|wife|romance/.test(text))
    return 'Love'
  if (/career|job|work|business|money|finance|income/.test(text)) return 'Career'
  if (/spiritual|soul|path|purpose|universe|awakening/.test(text))
    return 'Spiritual Guidance'
  return 'General'
}

export function parseStripeMetadata(
  session: Stripe.Checkout.Session
): ParsedInboundOrder {
  const meta = session.metadata ?? {}

  const readingTier = parseTier(meta.reading_tier ?? meta.tier ?? 'core')
  const deliveryFormat = parseFormat(meta.format ?? meta.delivery_format ?? 'written')

  const addons: ParsedInboundOrder['addons'] = []
  let isRush = false
  let includeOracleCard = false
  let includeEnergyCleansing = false

  if (meta.addon_rush === 'true' || meta.rush_24h === 'true') {
    isRush = true
    addons.push({ type: 'rush_24h', price: 0 })
  }
  if (meta.addon_oracle === 'true' || meta.oracle_card === 'true') {
    includeOracleCard = true
    addons.push({ type: 'oracle_card', price: 0 })
  }
  if (meta.addon_energy === 'true' || meta.energy_cleansing === 'true') {
    includeEnergyCleansing = true
    addons.push({ type: 'energy_cleansing', price: 0 })
  }
  if (meta.addon_extra_question === 'true' || meta.extra_question === 'true') {
    addons.push({ type: 'extra_question', price: 0 })
  }
  if (meta.addon_follow_up === 'true' || meta.follow_up === 'true') {
    addons.push({ type: 'follow_up', price: 0 })
  }

  return {
    clientName: meta.client_name ?? meta.name ?? 'Unknown',
    clientEmail: session.customer_details?.email ?? meta.email ?? '',
    starSign: meta.star_sign ?? meta.starsign ?? undefined,
    readingTier,
    deliveryFormat,
    questionOrFocus: meta.question ?? meta.focus ?? meta.questions_or_focus ?? undefined,
    priceTotal: (session.amount_total ?? 0) / 100,
    sourceOrderId: session.id,
    isRush,
    includeOracleCard,
    includeEnergyCleansing,
    addons,
  }
}
