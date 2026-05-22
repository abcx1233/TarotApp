'use client'

import { useReducer, useCallback, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { CardEntry } from './CardEntry'
import { TonePresetSelect } from './TonePresetSelect'
import { AddOnsSection } from './AddOnsSection'
import { OutputPanel } from './OutputPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Toggle } from '@/components/ui/Toggle'
import { createClient } from '@/lib/supabase/client'
import { READING_CHARACTER_TARGETS } from '@/lib/ai/config'
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

const TIER_PRICES: Record<ReadingTier, string> = {
  mini: '10.00',
  core: '25.00',
  premium: '45.00',
  celtic_cross: '10.00',
}

// ─── Initial state ─────────────────────────────────────────────────────────────

function makeBlankCard(): CardEntryForm {
  return { id: crypto.randomUUID(), name: '', orientation: 'upright', positionLabel: '' }
}

function initialState(): ReadingFormState {
  return {
    clientId: null,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    readingTier: 'core',
    topic: 'General',
    starSign: '',
    deliveryFormat: 'written',
    dueAt: '',
    priceTotal: '',
    isRush: false,
    isReturningClient: false,
    status: 'pending',
    tonePresetId: '',
    readingLength: READING_CHARACTER_TARGETS.core,
    suitFilter: 'all',
    cards: [makeBlankCard()],
    bottomCard: { name: '', orientation: 'upright' },
    questionsOrFocus: '',
    includeOracleCard: false,
    oracleCardName: '',
    includeEnergyCleansing: false,
    energyCleansingNotes: '',
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
        topic: order?.topic ?? 'General',
        deliveryFormat: (order?.delivery_format as DeliveryFormat) ?? 'written',
        priceTotal: order?.price_total != null ? String(order.price_total) : '',
        isRush: order?.is_rush ?? false,
        dueAt: order?.due_at ? order.due_at.slice(0, 16) : '',
        tonePresetId: data.tone_preset_id ?? '',
        readingLength: data.character_target ?? READING_CHARACTER_TARGETS.core,
        questionsOrFocus: data.question_or_focus ?? data.specific_question ?? '',
        includeOracleCard: data.include_oracle_card ?? false,
        oracleCardName: data.oracle_card_name ?? '',
        includeEnergyCleansing: data.include_energy_cleansing ?? false,
        energyCleansingNotes: data.energy_cleansing_notes ?? '',
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

// ─── Section component ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400 shrink-0">
          {title}
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-brand-600 text-white'
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
  const [isPriceAutoSet, setIsPriceAutoSet] = useState(false)
  const { isTestMode } = useTestMode()
  const router = useRouter()

  const isDirtyRef = useRef(false)
  const lastUserSelectedTierRef = useRef<string>('')

  const set = useCallback(
    (field: keyof ReadingFormState, value: ReadingFormState[keyof ReadingFormState]) => {
      isDirtyRef.current = true
      dispatch({ type: 'SET', field, value })
    },
    []
  )

  // Restore saved reading on mount
  useEffect(() => {
    if (!initialReading) return

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

    if (initialReading.id) {
      setIsReopenMode(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load app settings (skip if restoring)
  useEffect(() => {
    if (initialReading) return
    async function loadSettings() {
      const supabase = createClient()
      const { data } = await supabase
        .from('app_settings')
        .select('default_topic, business_name')
        .limit(1)
        .single()

      if (data?.default_topic) {
        dispatch({ type: 'SET', field: 'topic', value: data.default_topic })
      }
      if (data?.business_name) {
        setBusinessName(data.business_name)
      }
    }
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load business name when restoring (for action buttons)
  useEffect(() => {
    if (!initialReading) return
    async function loadBusinessName() {
      const supabase = createClient()
      const { data } = await supabase
        .from('app_settings')
        .select('business_name')
        .limit(1)
        .single()
      if (data?.business_name) setBusinessName(data.business_name)
    }
    loadBusinessName()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set first tone preset as default (only if nothing is set yet)
  useEffect(() => {
    if (tonePresets.length > 0 && !state.tonePresetId) {
      const defaultPreset = tonePresets.find((p) => p.is_default) ?? tonePresets[0]
      dispatch({ type: 'SET', field: 'tonePresetId', value: defaultPreset.id })
    }
  }, [tonePresets, state.tonePresetId])

  // Suggest a tone preset when the user manually changes the tier
  useEffect(() => {
    if (state.readingTier !== lastUserSelectedTierRef.current) return
    const recommended = tonePresets.find((p) =>
      (p.default_for_tier ?? []).includes(state.readingTier)
    )
    if (recommended) {
      dispatch({ type: 'SET', field: 'tonePresetId', value: recommended.id })
    }
  }, [state.readingTier, tonePresets])

  async function searchClients(query: string) {
    if (query.length < 2) { setClientSuggestions([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, email, phone')
      .ilike('full_name', `%${query}%`)
      .limit(6)
    setClientSuggestions(data ?? [])
  }

  function handleBack() {
    if (isDirtyRef.current) {
      if (!window.confirm('You have unsaved changes. Leave this page?')) return
    }
    router.push('/dashboard')
  }

  function handleClearForm() {
    if (!window.confirm('Clear the form and start fresh? Any unsaved changes will be lost.')) return
    dispatch({ type: 'RESET' })
    isDirtyRef.current = false
    setIsReopenMode(false)
    setReadingLengthOverridden(false)
    router.replace('/dashboard/readings/new')
  }

  async function handleGenerate() {
    const selectedPreset = tonePresets.find((p) => p.id === state.tonePresetId)
    if (!selectedPreset) {
      dispatch({ type: 'SET_ERROR', error: 'Please select a tone preset.' })
      return
    }

    const validCards = state.cards.filter((c) => c.name.trim())
    if (validCards.length === 0) {
      dispatch({ type: 'SET_ERROR', error: 'Add at least one card before generating.' })
      return
    }

    dispatch({ type: 'SET_GENERATING', value: true })

    try {
      const response = await fetch('/api/readings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formState: state,
          tonePresetText: selectedPreset.prompt_text,
          isTestMode,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${response.status}`)
      }

      const data = await response.json()
      dispatch({
        type: 'SET_OUTPUT',
        reading: data.generatedReading,
        readingId: data.readingId,
        orderId: data.orderId,
      })
      isDirtyRef.current = false
      router.replace(`/dashboard/readings/new?readingId=${data.readingId}`)
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Generation failed',
      })
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

    if (data.readingId && !state.savedReadingId) {
      dispatch({ type: 'SET', field: 'savedReadingId', value: data.readingId })
    }
    if (data.orderId && !state.savedOrderId) {
      dispatch({ type: 'SET', field: 'savedOrderId', value: data.orderId })
    }

    isDirtyRef.current = false

    if (data.readingId) {
      router.replace(`/dashboard/readings/new?readingId=${data.readingId}`)
    }
  }

  async function handleMarkReady() {
    if (!state.savedReadingId) return
    const supabase = createClient()
    await supabase
      .from('readings')
      .update({ final_approved: true, updated_at: new Date().toISOString() })
      .eq('id', state.savedReadingId)
    if (state.savedOrderId) {
      await supabase
        .from('orders')
        .update({ status: 'awaiting_review', updated_at: new Date().toISOString() })
        .eq('id', state.savedOrderId)
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
      await supabase
        .from('readings')
        .update({ final_approved: true, updated_at: new Date().toISOString() })
        .eq('id', state.savedReadingId)
    }

    dispatch({ type: 'SET', field: 'status', value: 'sent' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header — Back | Title (centred) | Clear form */}
      <div className="shrink-0 relative flex items-center border-b border-slate-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-slate-900 pointer-events-none">
          {isReopenMode ? 'Edit Reading' : 'New Reading'}
        </h1>
        <button
          type="button"
          onClick={handleClearForm}
          className="ml-auto text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
        >
          Clear form
        </button>
      </div>

      {/* Reopen mode banner */}
      {isReopenMode && (
        <div className="shrink-0 flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3">
          <p className="text-sm font-medium text-amber-900">
            Editing saved reading —{' '}
            <span className="font-semibold">{state.clientName || 'Unknown client'}</span>
          </p>
          <button
            type="button"
            className="ml-4 text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
            onClick={() => {
              dispatch({ type: 'RESET' })
              isDirtyRef.current = false
              setIsReopenMode(false)
              setReadingLengthOverridden(false)
              router.replace('/dashboard/readings/new')
            }}
          >
            Start fresh instead
          </button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row flex-1 min-h-0">
        {/* ── Left: Input panel ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-8 xl:max-w-2xl border-r border-slate-200">

          {/* Order Info */}
          <Section title="Order Info">
            {/* Client name with autocomplete */}
            <div>
              <Label htmlFor="client-name">Client name</Label>
              <div className="relative">
                <Input
                  id="client-name"
                  value={state.clientName}
                  onChange={(e) => {
                    set('clientName', e.target.value)
                    searchClients(e.target.value)
                  }}
                  placeholder="Search or type new client…"
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
            </div>

            <FieldRow>
              <div>
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={state.clientEmail}
                  onChange={(e) => set('clientEmail', e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <Label htmlFor="price">Price (£)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={state.priceTotal}
                  onChange={(e) => {
                    set('priceTotal', e.target.value)
                    setIsPriceAutoSet(false)
                  }}
                  placeholder="0.00"
                />
                {isPriceAutoSet && (
                  <p className="mt-1 text-xs text-slate-400">Auto-set from tier — edit to override</p>
                )}
              </div>
            </FieldRow>

            <div>
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                type="tel"
                value={state.clientPhone}
                onChange={(e) => set('clientPhone', e.target.value)}
                placeholder="+44 7700 000000"
              />
            </div>

            <div>
              <Label htmlFor="reading-tier">Reading tier</Label>
              <Select
                id="reading-tier"
                value={state.readingTier}
                onChange={(e) => {
                  isDirtyRef.current = true
                  const tier = e.target.value as ReadingTier
                  lastUserSelectedTierRef.current = tier
                  if (!readingLengthOverridden) {
                    dispatch({ type: 'SET_TIER', tier })
                  } else {
                    dispatch({ type: 'SET', field: 'readingTier', value: tier })
                  }
                  dispatch({ type: 'SET', field: 'priceTotal', value: TIER_PRICES[tier] })
                  setIsPriceAutoSet(true)
                }}
              >
                <option value="mini">Mini Written (~3,000 chars)</option>
                <option value="core">Core Written (~6,000 chars)</option>
                <option value="premium">Premium Written (~12,000 chars)</option>
                <option value="celtic_cross">Celtic Cross (~5,000 chars)</option>
              </Select>
            </div>

            <FieldRow>
              <div>
                <Label htmlFor="topic">Topic</Label>
                <Select
                  id="topic"
                  value={state.topic}
                  onChange={(e) => set('topic', e.target.value)}
                >
                  <option>Love</option>
                  <option>Career</option>
                  <option>General</option>
                  <option>Spiritual Guidance</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="star-sign">Star sign</Label>
                <Select
                  id="star-sign"
                  value={state.starSign}
                  onChange={(e) => set('starSign', e.target.value)}
                >
                  <option value="">Select…</option>
                  {['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </div>
            </FieldRow>

            <div>
              <Label>Delivery format</Label>
              <PillGroup
                options={[
                  { value: 'written', label: 'Written' },
                  { value: 'voice_note', label: 'Voice Note' },
                  { value: 'video', label: 'Video' },
                ]}
                value={state.deliveryFormat}
                onChange={(v) => set('deliveryFormat', v as DeliveryFormat)}
              />
            </div>
            <div>
              <Label htmlFor="due-at">Due date & time</Label>
              <Input
                id="due-at"
                type="datetime-local"
                value={state.dueAt}
                onChange={(e) => set('dueAt', e.target.value)}
              />
            </div>

            <Toggle
              checked={state.isReturningClient}
              onChange={(v) => set('isReturningClient', v)}
              label="Returning client"
            />
          </Section>

          {/* Reading Setup */}
          <Section title="Reading Setup">
            <TonePresetSelect
              presets={tonePresets}
              value={state.tonePresetId}
              onChange={(id) => set('tonePresetId', id)}
            />
            <div>
              <div className="flex items-baseline gap-2">
                <Label htmlFor="reading-length">Reading length (characters)</Label>
                {!readingLengthOverridden ? (
                  <button
                    type="button"
                    className="text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800"
                    onClick={() => setReadingLengthOverridden(true)}
                  >
                    Override
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
                    onClick={() => {
                      setReadingLengthOverridden(false)
                      dispatch({ type: 'SET_TIER', tier: state.readingTier })
                    }}
                  >
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
              {readingLengthOverridden && (
                <p className="mt-1 text-xs text-amber-600">
                  Custom length set — tier changes will not apply
                </p>
              )}
            </div>
          </Section>

          {/* Card Entry */}
          <Section title="Card Entry">
            <CardEntry
              cards={state.cards}
              suitFilter={state.suitFilter}
              bottomCard={state.bottomCard}
              onCardsChange={(cards) => {
                isDirtyRef.current = true
                dispatch({ type: 'SET_CARDS', cards })
              }}
              onSuitFilterChange={(suit) => set('suitFilter', suit)}
              onBottomCardChange={(card) => {
                isDirtyRef.current = true
                dispatch({ type: 'SET_BOTTOM_CARD', card })
              }}
            />
          </Section>

          {/* Reading Focus */}
          <Section title="Reading Focus">
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
          </Section>

          {/* Spirit Led Add-Ons */}
          <Section title="Spirit Led Add-Ons">
            <AddOnsSection
              includeOracleCard={state.includeOracleCard}
              oracleCardName={state.oracleCardName}
              includeEnergyCleansing={state.includeEnergyCleansing}
              energyCleansingNotes={state.energyCleansingNotes}
              onToggleOracleCard={(v) => set('includeOracleCard', v)}
              onOracleCardNameChange={(v) => set('oracleCardName', v)}
              onToggleEnergyCleansing={(v) => set('includeEnergyCleansing', v)}
              onEnergyCleansingNotesChange={(v) => set('energyCleansingNotes', v)}
            />
          </Section>
        </div>

        {/* ── Right: Output panel ───────────────────────────────────────── */}
        <div className="xl:w-[520px] shrink-0 flex flex-col p-6 min-h-[500px] xl:min-h-0">
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
          />
        </div>
      </div>
    </div>
  )
}
