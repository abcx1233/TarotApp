'use client'

import { useReducer, useCallback, useEffect, useState } from 'react'
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
import type { ReadingFormState, TonePreset, ReadingTier, CardEntryForm, CardOrientation } from '@/types'

// ─── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_CARD: CardEntryForm = {
  id: crypto.randomUUID(),
  name: '',
  orientation: 'upright',
  positionLabel: '',
}

function initialState(): ReadingFormState {
  return {
    clientId: null,
    clientName: '',
    clientEmail: '',
    readingTier: 'core',
    topic: 'General',
    deliveryFormat: 'written',
    deliveryChannel: 'email',
    dueAt: '',
    priceTotal: '',
    isRush: false,
    status: 'pending',
    tonePresetId: '',
    readingLength: READING_CHARACTER_TARGETS.core,
    suitFilter: 'all',
    cards: [INITIAL_CARD],
    bottomCard: { name: '', orientation: 'upright' },
    birthday: '',
    starSign: '',
    relationshipStatus: '',
    otherPersonName: '',
    isReturningClient: false,
    specificQuestion: '',
    mainFocus: '',
    readerNotes: '',
    includeOracleCard: false,
    oracleCardName: '',
    includeEnergyCleansing: false,
    energyCleansingNotes: '',
    generatedReading: null,
    emailVersion: null,
    whatsappVersion: null,
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
  | { type: 'SET_OUTPUT'; reading: string; email: string; whatsapp: string; readingId: string; orderId: string }
  | { type: 'SET_ERROR'; error: string }
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
        emailVersion: action.email,
        whatsappVersion: action.whatsapp,
        savedReadingId: action.readingId,
        savedOrderId: action.orderId,
        status: 'awaiting_review',
      }
    case 'SET_ERROR':
      return { ...state, isGenerating: false, generationError: action.error }
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
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h3>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface ReadingFormProps {
  initialTonePresets: TonePreset[]
}

export function ReadingForm({ initialTonePresets }: ReadingFormProps) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [tonePresets, setTonePresets] = useState<TonePreset[]>(initialTonePresets)
  const [clientSuggestions, setClientSuggestions] = useState<{ id: string; full_name: string; email: string }[]>([])
  const { isTestMode } = useTestMode()

  const set = useCallback(
    (field: keyof ReadingFormState, value: ReadingFormState[keyof ReadingFormState]) =>
      dispatch({ type: 'SET', field, value }),
    []
  )

  // Set first tone preset as default
  useEffect(() => {
    if (tonePresets.length > 0 && !state.tonePresetId) {
      const defaultPreset = tonePresets.find((p) => p.is_default) ?? tonePresets[0]
      dispatch({ type: 'SET', field: 'tonePresetId', value: defaultPreset.id })
    }
  }, [tonePresets, state.tonePresetId])

  // When tier changes, suggest a tone preset
  useEffect(() => {
    const tier = state.readingTier
    const recommended = tonePresets.find((p) =>
      (p.default_for_tier ?? []).includes(tier)
    )
    if (recommended) {
      dispatch({ type: 'SET', field: 'tonePresetId', value: recommended.id })
    }
  }, [state.readingTier, tonePresets])

  // Client search
  async function searchClients(query: string) {
    if (query.length < 2) { setClientSuggestions([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, email')
      .ilike('full_name', `%${query}%`)
      .limit(6)
    setClientSuggestions(data ?? [])
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
        email: data.emailVersion,
        whatsapp: data.whatsappVersion,
        readingId: data.readingId,
        orderId: data.orderId,
      })
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Generation failed',
      })
    }
  }

  async function handleSaveDraft() {
    // Save current form state as draft (order + reading skeleton)
    const supabase = createClient()
    if (state.savedReadingId) {
      await supabase
        .from('readings')
        .update({ reader_notes: state.readerNotes, updated_at: new Date().toISOString() })
        .eq('id', state.savedReadingId)
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
    await supabase
      .from('orders')
      .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', state.savedOrderId)
    dispatch({ type: 'SET', field: 'status', value: 'sent' })
  }

  const selectedTonePreset = tonePresets.find((p) => p.id === state.tonePresetId)

  return (
    <div className="flex flex-col xl:flex-row gap-0 h-full">
      {/* ── Left: Input panel ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-8 xl:max-w-2xl border-r border-slate-200">

        {/* A. Order Info */}
        <Section title="A. Order Info">
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
                        set('clientId', c.id)
                        set('clientName', c.full_name)
                        set('clientEmail', c.email ?? '')
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
                onChange={(e) => set('priceTotal', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </FieldRow>

          <FieldRow>
            <div>
              <Label htmlFor="reading-tier">Reading tier</Label>
              <Select
                id="reading-tier"
                value={state.readingTier}
                onChange={(e) => dispatch({ type: 'SET_TIER', tier: e.target.value as ReadingTier })}
              >
                <option value="mini">Mini Written (~3,000 chars)</option>
                <option value="core">Core Written (~6,000 chars)</option>
                <option value="premium">Premium Written (~12,000 chars)</option>
                <option value="celtic_cross">Celtic Cross (~5,000 chars)</option>
              </Select>
            </div>
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
                <option>Custom</option>
              </Select>
            </div>
          </FieldRow>

          <FieldRow>
            <div>
              <Label htmlFor="delivery-format">Delivery format</Label>
              <Select
                id="delivery-format"
                value={state.deliveryFormat}
                onChange={(e) => set('deliveryFormat', e.target.value as typeof state.deliveryFormat)}
              >
                <option value="written">Written</option>
                <option value="voice_note">Voice Note</option>
                <option value="video">Video</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="delivery-channel">Delivery channel</Label>
              <Select
                id="delivery-channel"
                value={state.deliveryChannel}
                onChange={(e) => set('deliveryChannel', e.target.value as typeof state.deliveryChannel)}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="account">Account</option>
              </Select>
            </div>
          </FieldRow>

          <FieldRow>
            <div>
              <Label htmlFor="due-at">Due date & time</Label>
              <Input
                id="due-at"
                type="datetime-local"
                value={state.dueAt}
                onChange={(e) => set('dueAt', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={state.status}
                onChange={(e) => set('status', e.target.value as typeof state.status)}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_review">Awaiting Review</option>
                <option value="sent">Sent</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </FieldRow>

          <div className="flex items-center gap-4">
            <Toggle
              checked={state.isRush}
              onChange={(v) => set('isRush', v)}
              label="Rush order"
            />
          </div>
        </Section>

        {/* B. Reading Setup */}
        <Section title="B. Reading Setup">
          <TonePresetSelect
            presets={tonePresets}
            value={state.tonePresetId}
            onChange={(id) => set('tonePresetId', id)}
          />
          <div>
            <Label htmlFor="reading-length">
              Reading length (characters){' '}
              <span className="font-normal text-slate-400">— auto-set by tier, overridable</span>
            </Label>
            <Input
              id="reading-length"
              type="number"
              min="500"
              max="20000"
              step="500"
              value={state.readingLength}
              onChange={(e) => set('readingLength', parseInt(e.target.value, 10))}
            />
          </div>
        </Section>

        {/* C & D. Card Entry */}
        <Section title="C. Card Entry">
          <CardEntry
            cards={state.cards}
            suitFilter={state.suitFilter}
            bottomCard={state.bottomCard}
            onCardsChange={(cards) => dispatch({ type: 'SET_CARDS', cards })}
            onSuitFilterChange={(suit) => set('suitFilter', suit)}
            onBottomCardChange={(card) => dispatch({ type: 'SET_BOTTOM_CARD', card })}
          />
        </Section>

        {/* E. Personalisation */}
        <Section title="E. Personalisation">
          <FieldRow>
            <div>
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={state.birthday}
                onChange={(e) => set('birthday', e.target.value)}
              />
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
            <Label htmlFor="relationship-status">Relationship status</Label>
            <Input
              id="relationship-status"
              value={state.relationshipStatus}
              onChange={(e) => set('relationshipStatus', e.target.value)}
              placeholder="Single, partnered, complicated…"
            />
          </div>

          <div>
            <Label htmlFor="other-person">Other person's name</Label>
            <Input
              id="other-person"
              value={state.otherPersonName}
              onChange={(e) => set('otherPersonName', e.target.value)}
              placeholder="For love readings (optional)"
            />
          </div>

          <Toggle
            checked={state.isReturningClient}
            onChange={(v) => set('isReturningClient', v)}
            label="Returning client"
          />
        </Section>

        {/* F. Reading Focus */}
        <Section title="F. Reading Focus">
          <div>
            <Label htmlFor="specific-question">Specific question</Label>
            <Input
              id="specific-question"
              value={state.specificQuestion}
              onChange={(e) => set('specificQuestion', e.target.value)}
              placeholder="This will be answered directly in the reading (optional)"
            />
          </div>
          <div>
            <Label htmlFor="main-focus">Main focus / additional context</Label>
            <Textarea
              id="main-focus"
              value={state.mainFocus}
              onChange={(e) => set('mainFocus', e.target.value)}
              placeholder="Context from the client, things to weave in…"
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="reader-notes">
              Internal reader notes{' '}
              <span className="font-normal text-slate-400">(not sent to AI — saved to DB only)</span>
            </Label>
            <Textarea
              id="reader-notes"
              value={state.readerNotes}
              onChange={(e) => set('readerNotes', e.target.value)}
              placeholder="Private notes about this reading…"
              rows={3}
            />
          </div>
        </Section>

        {/* G. Spirit Led Add-Ons */}
        <Section title="G. Spirit Led Add-Ons">
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
          emailVersion={state.emailVersion}
          whatsappVersion={state.whatsappVersion}
          isGenerating={state.isGenerating}
          generationError={state.generationError}
          onGenerate={handleGenerate}
          onRegenerate={handleGenerate}
          onSaveDraft={handleSaveDraft}
          onMarkReady={handleMarkReady}
          onMarkSent={handleMarkSent}
          readingId={state.savedReadingId}
        />
      </div>
    </div>
  )
}
