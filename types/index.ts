// ─── Enums ───────────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'in_progress' | 'awaiting_review' | 'sent' | 'archived'
export type ReadingTier = 'mini' | 'core' | 'premium' | 'celtic_cross'
export type DeliveryFormat = 'written' | 'voice_note' | 'video'
export type DeliveryChannel = 'email' | 'whatsapp' | 'account'
export type CardOrientation = 'upright' | 'reversed'
export type AddonType = 'extra_question' | 'rush_24h' | 'oracle_card' | 'energy_cleansing' | 'follow_up'

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Client {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  birthday: string | null
  star_sign: string | null
  instagram_handle: string | null
  general_notes: string | null
  relationship_context: string | null
  is_returning: boolean
  total_spent: number
  is_test: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  client_id: string | null
  source: string | null
  source_order_id: string | null
  reading_tier: ReadingTier
  topic: string
  delivery_format: DeliveryFormat
  delivery_channel: DeliveryChannel
  status: OrderStatus
  price_total: number
  is_rush: boolean
  due_at: string | null
  internal_notes: string | null
  sent_at: string | null
  gmail_send_status: string | null
  website_sync_status: string | null
  is_test: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  client?: Client
}

export interface Reading {
  id: string
  order_id: string | null
  client_id: string | null
  reading_length: number | null
  character_target: number | null
  tone_preset_id: string | null
  question_or_focus: string | null
  specific_question: string | null
  bottom_of_deck_card: string | null
  bottom_of_deck_orientation: CardOrientation | null
  oracle_card_name: string | null
  include_oracle_card: boolean
  include_energy_cleansing: boolean
  energy_cleansing_notes: string | null
  reader_notes: string | null
  generated_prompt: string | null
  generated_reading: string | null
  email_version: string | null
  whatsapp_version: string | null
  pdf_url: string | null
  groq_model: string | null
  prompt_version: number
  regenerated_count: number
  final_approved: boolean
  is_test: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  order?: Order
  client?: Client
  cards?: ReadingCard[]
}

export interface ReadingCard {
  id: string
  reading_id: string
  card_name: string
  suit: string
  orientation: CardOrientation
  position_label: string | null
  sort_order: number
  is_bottom_card: boolean
  created_at: string
}

export interface TonePreset {
  id: string
  name: string
  description: string | null
  prompt_text: string
  is_default: boolean
  default_for_tier: string[] | null
  created_at: string
  updated_at: string
}

export interface ReadingTemplate {
  id: string
  name: string
  signoff_text: string | null
  booking_cta: string | null
  disclaimer_text: string | null
  email_subject_template: string | null
  whatsapp_opening_line: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface AppSettings {
  id: string
  reader_name: string | null
  signoff_name: string | null
  booking_url: string | null
  instagram_handle: string | null
  whatsapp_number: string | null
  default_reading_length: number | null
  default_tone_preset_id: string | null
  default_delivery_format: DeliveryFormat | null
  groq_model: string | null
  test_mode_enabled: boolean
  created_at: string
  updated_at: string
}

export interface ClientNote {
  id: string
  client_id: string
  note: string
  tag: string | null
  created_at: string
}

export interface OrderAddon {
  id: string
  order_id: string
  addon_type: AddonType
  addon_price: number
  addon_notes: string | null
  created_at: string
}

export interface TarotCard {
  name: string
  suit: 'Major Arcana' | 'Cups' | 'Pentacles' | 'Wands' | 'Swords'
  order: number
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface CardEntryForm {
  id: string
  name: string
  orientation: CardOrientation
  positionLabel: string
}

export interface ReadingFormState {
  clientId: string | null
  clientName: string
  clientEmail: string
  readingTier: ReadingTier
  topic: string
  deliveryFormat: DeliveryFormat
  deliveryChannel: DeliveryChannel
  dueAt: string
  priceTotal: string
  isRush: boolean
  status: OrderStatus
  tonePresetId: string
  readingLength: number
  suitFilter: string
  cards: CardEntryForm[]
  bottomCard: { name: string; orientation: CardOrientation }
  birthday: string
  starSign: string
  relationshipStatus: string
  otherPersonName: string
  isReturningClient: boolean
  specificQuestion: string
  mainFocus: string
  readerNotes: string
  includeOracleCard: boolean
  oracleCardName: string
  includeEnergyCleansing: boolean
  energyCleansingNotes: string
  generatedReading: string | null
  emailVersion: string | null
  whatsappVersion: string | null
  isGenerating: boolean
  generationError: string | null
  savedReadingId: string | null
  savedOrderId: string | null
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface GenerateReadingRequest {
  formState: ReadingFormState
  tonePresetText: string
}

export interface GenerateReadingResponse {
  readingId: string
  orderId: string
  generatedReading: string
  emailVersion: string
  whatsappVersion: string
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardKPIs {
  pending: number
  inProgress: number
  sentToday: number
  revenueToday: number
}
