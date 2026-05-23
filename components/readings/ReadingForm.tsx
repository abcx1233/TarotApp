'use client'

import { useReducer, useCallback, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ScrollText, Loader2, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { CardEntry, CELTIC_CROSS_POSITIONS } from './CardEntry'
import { TonePresetSelect } from './TonePresetSelect'
import { AddOnsSection } from './AddOnsSection'
import { OrderAddOnsSection } from './OrderAddOnsSection'
import { OutputPanel } from './OutputPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Toggle } from '@/components/ui/Toggle'
import { createClient } from '@/lib/supabase/client'
import { READING_CHARACTER_TARGETS } from '@/lib/ai/config'
import { READING_PRICES, ADDON_PRICES } from '@/lib/config/pricing'
import { useTestMode } from '@/contexts/TestModeContext'
import type {
  ReadingFormState,
  TonePreset,
  ReadingTier,
  CardEntryForm,
  CardOrientation,
  DeliveryFormat,
  RestoredReadingData,
} from '@/types'

// ─── Initial state ─────────────────────────────────────────────────────────────

function makeBlankCard(): CardEntryForm {
  return { id: crypto.randomUUID(), name: '', orientation: 'upright', positionLabel: '' }
}

function makeCelticCrossCards(existing: CardEntryForm[] = []): CardEntryForm[] {
  return CELTIC_CROSS_POSITIONS.map((pos, i) => ({
    id: existing[i]?.id ?? crypto.randomUUID(),
    name: existing[i]?.name ?? '',
    orientation: existing[i]?.orientation ?? 'upright',
    positionLabel: pos,
  }))
}

const TIER_DEFAULT_CARD_COUNT: Record<string, number> = {
  mini: 3,
  core: 6,
  premium: 10,
  celtic_cross: 10,
}

function initialState(): ReadingFormState {
  return {
    clientId: null,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    readingTier: 'mini',
    topic: '',
    starSign: '',
    deliveryFormat: 'written',
    dueAt: '',
    priceTotal: '',
    isRush: false,
    isReturningClient: false,
    status: 'pending',
    tonePresetId: '',
    readingLength: READING_CHARACTER_TARGETS.mini,
    suitFilter: 'all',
    cards: Array.from({ length: TIER_DEFAULT_CARD_COUNT['mini'] }, makeBlankCard),
    bottomCard: { name: '', orientation: 'upright' },
    questionsOrFocus: '',
    includeOracleCard: false,
    oracleCardName: '',
    includeEnergyCleansing: false,
    energyCleansingNotes: '',
    includeExtraQuestion: false,
    extraQuestionText: '',
    includeFollowUp: false,
    includeFuture: false,
    futureTimeframe: '',
    generatedReading: null,
    isGenerating: false,
    generationError: null,
    savedReadingId: null,
    savedOrderId: null,
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET'; field: keyof ReadingFormState; value: ReadingFormState[keyof ReadingFormState] }
  | { type: 'SET_TIER'; tier: ReadingTier }
  | { type: 'SET_CARDS'; cards: CardEntryForm[] }
  | { type: 'SET_BOTTOM_CARD'; card: { name: string; orientation: CardOrientation } }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SET_OUTPUT'; reading: string; readingId: string; orderId: string }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_CELTIC_CROSS_LAYOUT'; existingCards: CardEntryForm[] }
  | { type: 'CLEAR_POSITION_LABELS' }
  | { type: 'SET_CARD_COUNT'; targetCount: number; keep: boolean }
  | { type: 'RESTORE'; data: RestoredReadingData; cards: CardEntryForm[]; bottomCard: { name: string; orientation: CardOrientation } }
  | { type: 'RESET' }

function reducer(state: ReadingFormState, action: Action): ReadingFormState {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.field]: action.value }
    case 'SET_TIER':
      return {
        ...state,
        readingTier: action.tier,
        readingLength: READING_CHARACTER_TARGETS[action.tier] ?? state.readingLength,
      }
    case 'SET_CARDS':
      return { ...state, cards: action.cards }
    case 'SET_BOTTOM_CARD':
      return { ...state, bottomCard: action.card }
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.value, generationError: null }
    case 'SET_OUTPUT':
      return {
        ...state,
        isGenerating: false,
        generationError: null,
        generatedReading: action.reading,
        savedReadingId: action.readingId,
        savedOrderId: action.orderId,
        status: 'awaiting_review',
      }
    case 'SET_ERROR':
      return { ...state, isGenerating: false, generationError: action.error }
    case 'SET_CELTIC_CROSS_LAYOUT':
      return { ...state, cards: makeCelticCrossCards(action.existingCards) }
    case 'CLEAR_POSITION_LABELS':
      return { ...state, cards: state.cards.map((c) => ({ ...c, positionLabel: '' })) }
    case 'SET_CARD_COUNT': {
      if (!action.keep) {
        return { ...state, cards: Array.from({ length: action.targetCount }, makeBlankCard) }
      }
      // Clear position labels (from Celtic Cross) and adjust count, never remove named cards
      let cards = state.cards.map((c) => ({ ...c, positionLabel: '' }))
      if (cards.length < action.targetCount) {
        const extras = Array.from({ length: action.targetCount - cards.length }, makeBlankCard)
        return { ...state, cards: [...cards, ...extras] }
      }
      if (cards.length > action.targetCount) {
        const result = [...cards]
        while (result.length > action.targetCount && !result[result.length - 1].name.trim()) {
          result.pop()
        }
        return { ...state, cards: result }
      }
      return { ...state, cards }
    }
    case 'RESTORE': {
      const { data, cards, bottomCard } = action
      const order = data.order
      const client = data.client
      return {
        ...initialState(),
        clientId: client?.id ?? null,
        clientName: client?.full_name ?? '',
        clientEmail: client?.email ?? '',
        clientPhone: client?.phone ?? '',
        starSign: client?.star_sign ?? '',
        isReturningClient: client?.is_returning ?? false,
        readingTier: (order?.reading_tier as ReadingTier) ?? 'core',
        topic: order?.topic ?? '',
        deliveryFormat: (order?.delivery_format as DeliveryFormat) ?? 'written',
        priceTotal: order?.price_total != null ? String(order.price_total) : '',
        isRush: order?.is_rush ?? false,
        dueAt: order?.due_at ? order.due_at.slice(0, 16) : '',
        tonePresetId: data.tone_preset_id ?? '',
        readingLength: data.character_target ?? READING_CHARACTER_TARGETS.core,
        questionsOrFocus: data.question_or_focus ?? '',
        includeOracleCard: data.include_oracle_card ?? false,
        oracleCardName: data.oracle_card_name ?? '',
        includeEnergyCleansing: data.include_energy_cleansing ?? false,
        energyCleansingNotes: data.energy_cleansing_notes ?? '',
        includeExtraQuestion: !!(data.specific_question?.trim()),
        extraQuestionText: data.specific_question ?? '',
        includeFollowUp: false,
        includeFuture: !!(data.future_timeframe),
        futureTimeframe: data.future_timeframe ?? '',
        generatedReading: data.generated_reading,
        savedReadingId: data.id || null,
        savedOrderId: order?.id ?? null,
        status: data.id ? 'awaiting_review' : 'pending',
        cards,
        bottomCard,
      }
    }
    case 'RESET':
      return initialState()
    default:
      return state
  }
}

// ─── Section component ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

// PillGroup with disabled support (FIX 15)
function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; disabled?: boolean }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={opt.disabled}
          onClick={() => !opt.disabled && onChange(opt.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
            opt.disabled
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
              : value === opt.value
              ? 'bg-brand-700 text-white shadow-sm ring-1 ring-brand-800/20'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface ReadingFormProps {
  initialTonePresets: TonePreset[]
  initialReading?: RestoredReadingData | null
}

export function ReadingForm({ initialTonePresets, initialReading }: ReadingFormProps) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [tonePresets] = useState<TonePreset[]>(initialTonePresets)
  const [clientSuggestions, setClientSuggestions] = useState<{ id: string; full_name: string; email: string; phone: string | null }[]>([])
  const [businessName, setBusinessName] = useState('Deep Blue Divination')
  const [isReopenMode, setIsReopenMode] = useState(false)
  const [readingLengthOverridden, setReadingLengthOverridden] = useState(false)
  const [isPriceAutoSet, setIsPriceAutoSet] = useState(true)
  const { isTestMode } = useTestMode()
  const router = useRouter()

  const hasOutput = !!(state.generatedReading || state.isGenerating || state.generationError)
  const isCelticCross = state.readingTier === 'celtic_cross'

  const [validationErrors, setValidationErrors] = useState<{
    clientName?: string
    clientEmail?: string
    cards?: string
  }>({})

  const isDirtyRef = useRef(false)
  const lastUserSelectedTierRef = useRef<string>('')
  const outputRef = useRef<HTMLDivElement>(null)
  const validationSummaryRef = useRef<HTMLDivElement>(null)
  const clientNameRef = useRef<HTMLDivElement>(null)
  const clientEmailRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  const set = useCallback(
    (field: keyof ReadingFormState, value: ReadingFormState[keyof ReadingFormState]) => {
      isDirtyRef.current = true
      dispatch({ type: 'SET', field, value })
    },
    []
  )

  // ── Auto-price effect (FIX 14) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isPriceAutoSet) return
    const base = READING_PRICES[state.readingTier]?.[state.deliveryFormat] ?? 0
    const addons =
      (state.includeOracleCard ? ADDON_PRICES.oracle_card : 0) +
      (state.isRush ? ADDON_PRICES.rush_24h : 0) +
      (state.includeExtraQuestion ? ADDON_PRICES.extra_question : 0) +
      (state.includeEnergyCleansing ? ADDON_PRICES.energy_cleansing : 0) +
      (state.includeFollowUp ? ADDON_PRICES.follow_up : 0)
    dispatch({ type: 'SET', field: 'priceTotal', value: String(base + addons) })
  }, [
    isPriceAutoSet,
    state.readingTier,
    state.deliveryFormat,
    state.includeOracleCard,
    state.isRush,
    state.includeExtraQuestion,
    state.includeEnergyCleansing,
    state.includeFollowUp,
  ])

  // Computed pricing breakdown for display
  const basePrice = READING_PRICES[state.readingTier]?.[state.deliveryFormat] ?? null
  const addonTotal =
    (state.includeOracleCard ? ADDON_PRICES.oracle_card : 0) +
    (state.isRush ? ADDON_PRICES.rush_24h : 0) +
    (state.includeExtraQuestion ? ADDON_PRICES.extra_question : 0) +
    (state.includeEnergyCleansing ? ADDON_PRICES.energy_cleansing : 0) +
    (state.includeFollowUp ? ADDON_PRICES.follow_up : 0)
  const runningTotal = (basePrice ?? 0) + addonTotal

  // Restore saved reading on mount
  useEffect(() => {
    if (!initialReading) return
    setIsPriceAutoSet(false)
    const mainCards = initialReading.cards
      .filter((c) => !c.is_bottom_card)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: crypto.randomUUID(),
        name: c.card_name,
        orientation: c.orientation as CardOrientation,
        positionLabel: c.position_label ?? '',
      }))
    const bottomCardRow = initialReading.cards.find((c) => c.is_bottom_card)
    const bottomCard = bottomCardRow
      ? { name: bottomCardRow.card_name, orientation: bottomCardRow.orientation as CardOrientation }
      : {
          name: initialReading.bottom_of_deck_card ?? '',
          orientation: (initialReading.bottom_of_deck_orientation as CardOrientation) ?? 'upright',
        }
    dispatch({
      type: 'RESTORE',
      data: initialReading,
      cards: mainCards.length > 0 ? mainCards : [makeBlankCard()],
      bottomCard,
    })
    isDirtyRef.current = false
    if (initialReading.id) setIsReopenMode(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load app settings
  useEffect(() => {
    if (initialReading) return
    async function loadSettings() {
      const supabase = createClient()
      const { data } = await supabase.from('app_settings').select('business_name').limit(1).single()
      if (data?.business_name) setBusinessName(data.business_name)
    }
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load business name when restoring
  useEffect(() => {
    if (!initialReading) return
    async function loadBusinessName() {
      const supabase = createClient()
      const { data } = await supabase.from('app_settings').select('business_name').limit(1).single()
      if (data?.business_name) setBusinessName(data.business_name)
    }
    loadBusinessName()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set default tone preset
  useEffect(() => {
    if (tonePresets.length > 0 && !state.tonePresetId) {
      const defaultPreset = tonePresets.find((p) => p.is_default) ?? tonePresets[0]
      dispatch({ type: 'SET', field: 'tonePresetId', value: defaultPreset.id })
    }
  }, [tonePresets, state.tonePresetId])

  // Suggest tone preset on tier change
  useEffect(() => {
    if (state.readingTier !== lastUserSelectedTierRef.current) return
    const recommended = tonePresets.find((p) => (p.default_for_tier ?? []).includes(state.readingTier))
    if (recommended) dispatch({ type: 'SET', field: 'tonePresetId', value: recommended.id })
  }, [state.readingTier, tonePresets])

  async function searchClients(query: string) {
    if (query.length < 2) { setClientSuggestions([]); return }
    const supabase = createClient()
    const { data } = await supabase.from('clients').select('id, full_name, email, phone').ilike('full_name', `%${query}%`).limit(6)
    setClientSuggestions(data ?? [])
  }

  function handleBack() {
    if (isDirtyRef.current && !window.confirm('You have unsaved changes. Leave this page?')) return
    router.push('/dashboard')
  }

  function handleClearForm() {
    if (!window.confirm('Clear the form and start fresh? Any unsaved changes will be lost.')) return
    dispatch({ type: 'RESET' })
    isDirtyRef.current = false
    setIsReopenMode(false)
    setReadingLengthOverridden(false)
    setIsPriceAutoSet(false)
    router.replace('/dashboard/readings/new')
  }

  // Handle tier change with card-count auto-populate (CHANGE 6, 10)
  function handleTierChange(tier: ReadingTier) {
    isDirtyRef.current = true
    lastUserSelectedTierRef.current = tier
    const prevTier = state.readingTier

    // Force format to 'written' for Celtic Cross (CHANGE 10)
    if (tier === 'celtic_cross' && state.deliveryFormat !== 'written') {
      dispatch({ type: 'SET', field: 'deliveryFormat', value: 'written' })
    }

    const targetCount = TIER_DEFAULT_CARD_COUNT[tier] ?? 1
    const hasNamedCards = state.cards.some((c) => c.name.trim())
    const TIER_LABELS: Record<string, string> = { mini: 'Mini', core: 'Core', premium: 'Premium', celtic_cross: 'Celtic Cross' }

    if (tier === 'celtic_cross') {
      if (prevTier !== 'celtic_cross') {
        if (hasNamedCards) {
          const confirmed = window.confirm(
            `Changing to Celtic Cross adjusts the card count to 10 cards.\nKeep your already entered cards?`
          )
          dispatch({ type: 'SET_CELTIC_CROSS_LAYOUT', existingCards: confirmed ? state.cards : [] })
        } else {
          dispatch({ type: 'SET_CELTIC_CROSS_LAYOUT', existingCards: state.cards })
        }
      }
    } else {
      if (hasNamedCards) {
        const confirmed = window.confirm(
          `Changing to ${TIER_LABELS[tier]} adjusts the card count to ${targetCount} cards.\nKeep your already entered cards?`
        )
        dispatch({ type: 'SET_CARD_COUNT', targetCount, keep: confirmed })
      } else {
        dispatch({ type: 'SET_CARD_COUNT', targetCount, keep: false })
      }
    }

    // Update tier and length
    if (!readingLengthOverridden) {
      dispatch({ type: 'SET_TIER', tier })
    } else {
      dispatch({ type: 'SET', field: 'readingTier', value: tier })
    }
    setIsPriceAutoSet(true)
  }

  function validateForm(): { clientName?: string; clientEmail?: string; cards?: string } {
    const errors: { clientName?: string; clientEmail?: string; cards?: string } = {}

    if (!state.clientName.trim()) {
      errors.clientName = 'Client name is required'
    }

    const email = state.clientEmail.trim()
    if (!email) {
      errors.clientEmail = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.clientEmail = 'Please enter a valid email address'
    }

    const filledCount = state.cards.filter((c) => c.name.trim()).length
    if (state.readingTier === 'mini') {
      if (filledCount < 3) {
        errors.cards = `Mini readings require at least 3 cards — you have ${filledCount} entered`
      }
    } else if (state.readingTier === 'core') {
      if (filledCount < 6) {
        errors.cards = `Core readings require at least 6 cards — you have ${filledCount} entered`
      }
    } else if (state.readingTier === 'premium') {
      if (filledCount < 10) {
        errors.cards = `Premium readings require at least 10 cards — you have ${filledCount} entered`
      }
    } else if (state.readingTier === 'celtic_cross') {
      const emptyCount = state.cards.filter((c) => !c.name.trim()).length
      if (emptyCount > 0) {
        errors.cards = `All 10 Celtic Cross positions must have a card selected — ${emptyCount} position${emptyCount === 1 ? '' : 's'} are empty`
      }
    }

    return errors
  }

  async function handleGenerate() {
    const errors = validateForm()
    const errorCount = Object.keys(errors).length
    if (errorCount > 0) {
      setValidationErrors(errors)
      setTimeout(() => {
        if (errorCount > 1) {
          validationSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else if (errors.clientName) {
          clientNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (errors.clientEmail) {
          clientEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (errors.cards) {
          cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 50)
      return
    }
    setValidationErrors({})

    const selectedPreset = tonePresets.find((p) => p.id === state.tonePresetId)
    if (!selectedPreset) {
      dispatch({ type: 'SET_ERROR', error: 'Please select a tone preset.' })
      return
    }

    dispatch({ type: 'SET_GENERATING', value: true })

    // FIX 5: scroll to output on small screens
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }

    try {
      const response = await fetch('/api/readings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formState: state, tonePresetText: selectedPreset.prompt_text, isTestMode }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${response.status}`)
      }
      const data = await response.json()
      dispatch({ type: 'SET_OUTPUT', reading: data.generatedReading, readingId: data.readingId, orderId: data.orderId })
      isDirtyRef.current = false
      router.replace(`/dashboard/readings/new?readingId=${data.readingId}`)
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Generation failed' })
    }
  }

  async function handleSaveDraft() {
    const response = await fetch('/api/readings/save-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formState: state, isTestMode }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error ?? 'Save failed')
    }
    const data = await response.json()
    if (data.readingId && !state.savedReadingId) dispatch({ type: 'SET', field: 'savedReadingId', value: data.readingId })
    if (data.orderId && !state.savedOrderId) dispatch({ type: 'SET', field: 'savedOrderId', value: data.orderId })
    isDirtyRef.current = false
    if (data.readingId) router.replace(`/dashboard/readings/new?readingId=${data.readingId}`)
  }

  async function handleMarkReady() {
    if (!state.savedReadingId) return
    const supabase = createClient()
    await supabase.from('readings').update({ final_approved: true, updated_at: new Date().toISOString() }).eq('id', state.savedReadingId)
    if (state.savedOrderId) {
      await supabase.from('orders').update({ status: 'awaiting_review', updated_at: new Date().toISOString() }).eq('id', state.savedOrderId)
    }
  }

  async function handleMarkSent() {
    if (!state.savedOrderId) return
    const supabase = createClient()
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', state.savedOrderId)
    if (orderError) throw new Error(orderError.message)
    if (state.savedReadingId) {
      await supabase.from('readings').update({ final_approved: true, updated_at: new Date().toISOString() }).eq('id', state.savedReadingId)
    }
    dispatch({ type: 'SET', field: 'status', value: 'sent' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="shrink-0 relative flex items-center border-b border-slate-200 bg-white px-6 py-4">
        <button type="button" onClick={handleBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} />
          Back
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-slate-900 pointer-events-none">
          {isReopenMode ? 'Edit Reading' : 'New Reading'}
        </h1>
        <button type="button" onClick={handleClearForm} className="ml-auto text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600">
          Clear form
        </button>
      </div>

      {/* Rush banner (CHANGE 2) */}
      <div
        className={clsx(
          'shrink-0 overflow-hidden transition-all duration-300',
          state.isRush ? 'max-h-16' : 'max-h-0'
        )}
      >
        <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-6 py-2.5">
          <Zap size={13} className="text-rose-600 shrink-0" />
          <span className="text-xs font-medium text-rose-700">Rush Order — prioritised delivery within 24 hours</span>
        </div>
      </div>

      {/* Reopen mode banner */}
      {isReopenMode && (
        <div className="shrink-0 flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3">
          <p className="text-sm font-medium text-amber-900">
            Editing saved reading — <span className="font-semibold">{state.clientName || 'Unknown client'}</span>
          </p>
          <button
            type="button"
            className="ml-4 text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
            onClick={() => {
              dispatch({ type: 'RESET' })
              isDirtyRef.current = false
              setIsReopenMode(false)
              setReadingLengthOverridden(false)
              setIsPriceAutoSet(false)
              router.replace('/dashboard/readings/new')
            }}
          >
            Start fresh instead
          </button>
        </div>
      )}

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">

        {/* ── Left: Form ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6 lg:border-r lg:border-slate-200">

          {/* Validation summary — shown when multiple fields fail */}
          {Object.keys(validationErrors).length > 1 && (
            <div
              ref={validationSummaryRef}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              Please fix {Object.keys(validationErrors).length} issue{Object.keys(validationErrors).length !== 1 ? 's' : ''} before generating
            </div>
          )}

          {/* Order Info */}
          <Section title="Order Info">
            {/* Row 1: Client name — full width */}
            <div ref={clientNameRef}>
              <Label htmlFor="client-name">Client name</Label>
              <div className="relative">
                <Input
                  id="client-name"
                  value={state.clientName}
                  onChange={(e) => { set('clientName', e.target.value); searchClients(e.target.value) }}
                  placeholder="Search or type new client…"
                  error={validationErrors.clientName}
                />
                {clientSuggestions.length > 0 && (
                  <ul className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                    {clientSuggestions.map((c) => (
                      <li
                        key={c.id}
                        className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                        onMouseDown={() => {
                          isDirtyRef.current = true
                          dispatch({ type: 'SET', field: 'clientId', value: c.id })
                          dispatch({ type: 'SET', field: 'clientName', value: c.full_name })
                          dispatch({ type: 'SET', field: 'clientEmail', value: c.email ?? '' })
                          dispatch({ type: 'SET', field: 'clientPhone', value: c.phone ?? '' })
                          setClientSuggestions([])
                        }}
                      >
                        <span className="font-medium text-slate-800">{c.full_name}</span>
                        <span className="text-xs text-slate-400">{c.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {validationErrors.clientName && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.clientName}</p>
              )}
            </div>

            {/* Row 2: Email + Phone */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div ref={clientEmailRef}>
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={state.clientEmail}
                  onChange={(e) => set('clientEmail', e.target.value)}
                  placeholder="client@example.com"
                  error={validationErrors.clientEmail}
                />
                {validationErrors.clientEmail && (
                  <p className="mt-1 text-xs text-red-600">{validationErrors.clientEmail}</p>
                )}
              </div>
              <div>
                <Label htmlFor="client-phone">Phone</Label>
                <Input id="client-phone" type="tel" value={state.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} placeholder="+44 7700 000000" />
              </div>
            </div>

            {/* Row 3: Reading tier — full width */}
            <div>
              <Label htmlFor="reading-tier">Reading tier</Label>
              <Select
                id="reading-tier"
                value={state.readingTier}
                onChange={(e) => handleTierChange(e.target.value as ReadingTier)}
              >
                <option value="mini">Mini Written (~3,000 chars)</option>
                <option value="core">Core Written (~6,000 chars)</option>
                <option value="premium">Premium Written (~12,000 chars)</option>
                <option value="celtic_cross">Celtic Cross (~6,000 chars)</option>
              </Select>
            </div>

            {/* Row 4: Topic + Star sign */}
            <FieldRow>
              <div>
                <Label htmlFor="topic">Topic</Label>
                <Select id="topic" value={state.topic} onChange={(e) => set('topic', e.target.value)}>
                  <option value=""></option>
                  <option>Love & Relationships</option>
                  <option>Career & Work</option>
                  <option>Finance & Abundance</option>
                  <option>Spiritual Guidance</option>
                  <option>General Guidance</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="star-sign">Star sign</Label>
                <Select id="star-sign" value={state.starSign} onChange={(e) => set('starSign', e.target.value)}>
                  <option value="">Select…</option>
                  {['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </div>
            </FieldRow>

            {/* Row 5: Questions or Areas of Focus */}
            <div>
              <Label htmlFor="questions-or-focus">Questions or Areas of Focus</Label>
              <Textarea
                id="questions-or-focus"
                value={state.questionsOrFocus}
                onChange={(e) => set('questionsOrFocus', e.target.value)}
                placeholder="Love & Relationships, Career & Work, Finance & Abundance, General Guidance — or leave blank to let spirit guide the reading"
                rows={4}
              />
            </div>

            {/* Row 6: Include future energy toggle + optional timeframe */}
            <div className="space-y-2">
              <Toggle
                checked={state.includeFuture}
                onChange={(v) => {
                  set('includeFuture', v)
                  if (!v) set('futureTimeframe', '')
                }}
                label="Include future energy"
              />
              {state.includeFuture && (
                <div>
                  <Label htmlFor="future-timeframe">Future timeframe</Label>
                  <Select
                    id="future-timeframe"
                    value={state.futureTimeframe}
                    onChange={(e) => set('futureTimeframe', e.target.value)}
                  >
                    <option value="">Select a timeframe...</option>
                    <option value="Next 3 months">Next 3 months</option>
                    <option value="Next 6 months">Next 6 months</option>
                    <option value="Rest of the year">Rest of the year</option>
                    <option value="Full 12 months">Full 12 months</option>
                    <option value="24 months">24 months</option>
                  </Select>
                </div>
              )}
            </div>

            {/* Row 7: Delivery format — full width */}
            <div>
              <Label>Delivery format</Label>
              <PillGroup
                options={[
                  { value: 'written', label: 'Written' },
                  { value: 'voice_note', label: 'Voice Note', disabled: isCelticCross },
                  { value: 'video', label: 'Video', disabled: isCelticCross },
                ]}
                value={state.deliveryFormat}
                onChange={(v) => {
                  set('deliveryFormat', v as DeliveryFormat)
                  setIsPriceAutoSet(true)
                }}
              />
              {isCelticCross && (
                <p className="mt-1.5 text-xs text-slate-500">Celtic Cross is available as written only</p>
              )}
            </div>

            {/* Row 8: Returning client — full width */}
            <Toggle checked={state.isReturningClient} onChange={(v) => set('isReturningClient', v)} label="Returning client" />

            {/* Row 9: Price + Due date */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="price">Price</Label>
                <div className="relative">
                  <span className="pointer-events-none select-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">£</span>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={state.priceTotal}
                    onChange={(e) => { set('priceTotal', e.target.value); setIsPriceAutoSet(false) }}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
                {isPriceAutoSet && basePrice !== null && (
                  <p className="mt-1 text-xs text-slate-500">
                    {addonTotal > 0
                      ? `Base: £${basePrice} + Add-ons: £${addonTotal} = Total: £${runningTotal} — `
                      : 'Auto-set — '}
                    <button type="button" className="underline hover:text-slate-700" onClick={() => setIsPriceAutoSet(false)}>
                      edit to override
                    </button>
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="due-at">Due date &amp; time</Label>
                <Input id="due-at" type="datetime-local" value={state.dueAt} onChange={(e) => set('dueAt', e.target.value)} />
                <p className="mt-1 text-xs text-slate-400">Auto-filled when orders come in via Stripe — override if needed</p>
              </div>
            </div>

            {/* Row 10: Order Add-Ons */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Order Add-Ons</p>
              <OrderAddOnsSection
                includeExtraQuestion={state.includeExtraQuestion}
                extraQuestionText={state.extraQuestionText}
                includeFollowUp={state.includeFollowUp}
                isRush={state.isRush}
                onToggleExtraQuestion={(v) => { set('includeExtraQuestion', v); setIsPriceAutoSet(true) }}
                onExtraQuestionTextChange={(v) => set('extraQuestionText', v)}
                onToggleFollowUp={(v) => { set('includeFollowUp', v); setIsPriceAutoSet(true) }}
                onToggleRush={(v) => { set('isRush', v); setIsPriceAutoSet(true) }}
              />
            </div>
          </Section>

          {/* Reading Setup */}
          <Section title="Reading Setup">
            <TonePresetSelect presets={tonePresets} value={state.tonePresetId} onChange={(id) => set('tonePresetId', id)} />
            <div>
              <div className="flex items-baseline gap-2">
                <Label htmlFor="reading-length">Reading length (characters)</Label>
                {!readingLengthOverridden ? (
                  <button type="button" className="text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800" onClick={() => setReadingLengthOverridden(true)}>
                    Override
                  </button>
                ) : (
                  <button type="button" className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600" onClick={() => { setReadingLengthOverridden(false); dispatch({ type: 'SET_TIER', tier: state.readingTier }) }}>
                    Reset to default
                  </button>
                )}
              </div>
              <Input
                id="reading-length"
                type="number"
                min="500"
                max="20000"
                step="500"
                value={state.readingLength}
                onChange={(e) => set('readingLength', parseInt(e.target.value, 10))}
                readOnly={!readingLengthOverridden}
                className={!readingLengthOverridden ? 'bg-slate-50 text-slate-500 cursor-default' : ''}
              />
              {readingLengthOverridden && <p className="mt-1 text-xs text-amber-600">Custom length set — tier changes will not apply</p>}
            </div>
          </Section>

          {/* Card Entry */}
          <Section title="Card Entry">
            <div ref={cardsRef}>
              {validationErrors.cards && (
                <p className="mb-3 text-xs text-red-600">{validationErrors.cards}</p>
              )}
              <CardEntry
                cards={state.cards}
                suitFilter={state.suitFilter}
                bottomCard={state.bottomCard}
                onCardsChange={(cards) => { isDirtyRef.current = true; dispatch({ type: 'SET_CARDS', cards }) }}
                onSuitFilterChange={(suit) => set('suitFilter', suit)}
                onBottomCardChange={(card) => { isDirtyRef.current = true; dispatch({ type: 'SET_BOTTOM_CARD', card }) }}
                isCelticCross={isCelticCross}
                readingTier={state.readingTier}
              />
            </div>
          </Section>

          {/* Spirit Led Add-Ons (CHANGE 1) */}
          <Section title="Spirit Led Add-Ons">
            <AddOnsSection
              includeOracleCard={state.includeOracleCard}
              oracleCardName={state.oracleCardName}
              includeEnergyCleansing={state.includeEnergyCleansing}
              energyCleansingNotes={state.energyCleansingNotes}
              onToggleOracleCard={(v) => { set('includeOracleCard', v); setIsPriceAutoSet(true) }}
              onOracleCardNameChange={(v) => set('oracleCardName', v)}
              onToggleEnergyCleansing={(v) => { set('includeEnergyCleansing', v); setIsPriceAutoSet(true) }}
              onEnergyCleansingNotesChange={(v) => set('energyCleansingNotes', v)}
            />
          </Section>

          {/* Generate button — small/medium screens only (FIX 13) */}
          {!hasOutput && (
            <div className="pb-2 lg:hidden">
              {state.generationError && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {state.generationError}
                </p>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={state.isGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {state.isGenerating ? (
                  <><Loader2 size={16} className="animate-spin" />Generating…</>
                ) : (
                  <><ScrollText size={16} />Generate Reading</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Output panel ─────────────────────────────────────── */}
        <div
          ref={outputRef}
          className={clsx(
            'shrink-0 flex-col lg:w-1/2 border-t border-slate-200 lg:border-t-0',
            hasOutput ? 'flex' : 'hidden lg:flex'
          )}
        >
          <OutputPanel
            generatedReading={state.generatedReading}
            isGenerating={state.isGenerating}
            generationError={state.generationError}
            onGenerate={handleGenerate}
            onRegenerate={handleGenerate}
            onSaveDraft={handleSaveDraft}
            onMarkReady={handleMarkReady}
            onMarkSent={handleMarkSent}
            readingId={state.savedReadingId}
            clientName={state.clientName}
            clientEmail={state.clientEmail}
            clientPhone={state.clientPhone}
            readingTier={state.readingTier}
            topic={state.topic}
            deliveryFormat={state.deliveryFormat}
            businessName={businessName}
            readingLength={state.readingLength}
            hasAddons={state.includeOracleCard || state.includeEnergyCleansing}
          />
        </div>
      </div>
    </div>
  )
}
