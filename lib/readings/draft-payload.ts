import { stripReadingDashes } from '@/lib/text/dashes'
import type { ReadingFormState } from '@/types'

/**
 * The readings row Save Draft writes, for both insert and update. Pure, so the
 * draft's stored text can be tested without a database.
 */
export function buildDraftReadingPayload(f: ReadingFormState, orderId: string, clientId: string | null) {
  return {
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
    energy_cleansing_notes: null,
    specific_question: f.includeExtraQuestion && f.extraQuestionText?.trim() ? f.extraQuestionText.trim() : null,
    // The same final dash pass the generate route applies: a draft edited or
    // pasted in the review editor isn't exempt from it.
    generated_reading: f.generatedReading == null ? null : stripReadingDashes(f.generatedReading),
    updated_at: new Date().toISOString(),
  }
}
