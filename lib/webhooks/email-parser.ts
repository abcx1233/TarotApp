import type { ParsedInboundOrder } from './stripe-parser'
import { ADDON_PRICES } from '@/lib/config/pricing'

function parseBool(val: string): boolean {
  return val.trim().toLowerCase() === 'yes'
}

function parseTier(val: string): ParsedInboundOrder['readingTier'] {
  const v = val.trim().toLowerCase()
  if (v === 'mini') return 'mini'
  if (v === 'premium') return 'premium'
  if (v.includes('celtic')) return 'celtic_cross'
  return 'core'
}

function parseFormat(val: string): ParsedInboundOrder['deliveryFormat'] {
  const v = val.trim().toLowerCase()
  if (v.includes('voice')) return 'voice_note'
  if (v.includes('video')) return 'video'
  return 'written'
}

export function parseEmailOrder(raw: string): ParsedInboundOrder {
  const fields: Record<string, string> = {}

  for (const line of raw.split('\n')) {
    const sep = line.indexOf(': ')
    if (sep === -1) continue
    fields[line.slice(0, sep).trim()] = line.slice(sep + 2).trim()
  }

  const includeOracleCard      = parseBool(fields['Oracle Card'] ?? '')
  const includeEnergyCleansing = parseBool(fields['Energy Cleansing Ritual'] ?? '')
  const includeExtraQuestion   = parseBool(fields['Extra Question'] ?? '')
  const isRush                 = parseBool(fields['Rush 24-Hour Delivery'] ?? '')
  const includeFollowUp        = parseBool(fields['Follow-Up Within 48 Hours'] ?? '')

  const addons: ParsedInboundOrder['addons'] = []
  if (includeOracleCard)      addons.push({ type: 'oracle_card',      price: ADDON_PRICES.oracle_card })
  if (includeEnergyCleansing) addons.push({ type: 'energy_cleansing', price: ADDON_PRICES.energy_cleansing })
  if (includeExtraQuestion)   addons.push({ type: 'extra_question',   price: ADDON_PRICES.extra_question })
  if (isRush)                 addons.push({ type: 'rush_24h',         price: ADDON_PRICES.rush_24h })
  if (includeFollowUp)        addons.push({ type: 'follow_up',        price: ADDON_PRICES.follow_up })

  const priceRaw = (fields['Total Paid'] ?? '').replace(/[£$,\s]/g, '')

  return {
    clientName:          fields['Name']?.trim() || 'Unknown',
    clientEmail:         fields['Email']?.trim() ?? '',
    starSign:            fields['Star Sign']?.trim() || undefined,
    readingTier:         parseTier(fields['Reading Tier'] ?? ''),
    deliveryFormat:      parseFormat(fields['Format'] ?? ''),
    questionOrFocus:     fields['Questions or Areas of Focus']?.trim() || undefined,
    priceTotal:          parseFloat(priceRaw) || 0,
    sourceOrderId:       '',
    isRush,
    includeOracleCard,
    includeEnergyCleansing,
    addons,
  }
}
