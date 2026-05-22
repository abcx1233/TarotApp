'use client'

import { useCallback } from 'react'
import { X, Plus, RotateCcw } from 'lucide-react'
import { CardAutocomplete } from './CardAutocomplete'
import { SuitFilter } from './SuitFilter'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { clsx } from 'clsx'
import type { CardEntryForm, CardOrientation } from '@/types'
import type { TarotCard } from '@/types'

interface CardEntryProps {
  cards: CardEntryForm[]
  suitFilter: string
  bottomCard: { name: string; orientation: CardOrientation }
  onCardsChange: (cards: CardEntryForm[]) => void
  onSuitFilterChange: (suit: string) => void
  onBottomCardChange: (card: { name: string; orientation: CardOrientation }) => void
}

interface CardRowProps {
  card: CardEntryForm
  index: number
  suitFilter: string
  onUpdate: (id: string, updates: Partial<CardEntryForm>) => void
  onRemove: (id: string) => void
  onEnter: () => void
  isLast: boolean
}

function OrientationToggle({
  value,
  onChange,
}: {
  value: CardOrientation
  onChange: (v: CardOrientation) => void
}) {
  return (
    <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange('upright')}
        className={clsx(
          'px-2.5 py-1.5 text-xs font-medium transition-colors',
          value === 'upright'
            ? 'bg-brand-600 text-white'
            : 'bg-white text-slate-600 hover:bg-slate-50'
        )}
      >
        ↑ Up
      </button>
      <button
        type="button"
        onClick={() => onChange('reversed')}
        className={clsx(
          'px-2.5 py-1.5 text-xs font-medium transition-colors border-l border-slate-300',
          value === 'reversed'
            ? 'bg-red-500 text-white'
            : 'bg-white text-slate-600 hover:bg-slate-50'
        )}
      >
        ↓ Rev
      </button>
    </div>
  )
}

function CardRow({ card, index, suitFilter, onUpdate, onRemove, onEnter }: CardRowProps) {
  return (
    <div className="flex items-center gap-2 group animate-fade-in">
      <span className="w-5 shrink-0 text-right text-xs text-slate-400 font-mono">
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        <CardAutocomplete
          id={`card-${card.id}`}
          value={card.name}
          onChange={(name, tarotCard) =>
            onUpdate(card.id, { name, ...(tarotCard ? { suit: tarotCard.suit } : {}) })
          }
          suitFilter={suitFilter}
          placeholder="Card name…"
          onEnter={onEnter}
        />
      </div>

      <OrientationToggle
        value={card.orientation}
        onChange={(orientation) => onUpdate(card.id, { orientation })}
      />

      <button
        type="button"
        onClick={() => onRemove(card.id)}
        className="shrink-0 rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        aria-label="Remove card"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function CardEntry({
  cards,
  suitFilter,
  bottomCard,
  onCardsChange,
  onSuitFilterChange,
  onBottomCardChange,
}: CardEntryProps) {
  const addCard = useCallback(() => {
    const newCard: CardEntryForm = {
      id: crypto.randomUUID(),
      name: '',
      orientation: 'upright',
      positionLabel: '',
    }
    onCardsChange([...cards, newCard])
  }, [cards, onCardsChange])

  const updateCard = useCallback(
    (id: string, updates: Partial<CardEntryForm>) => {
      onCardsChange(cards.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    },
    [cards, onCardsChange]
  )

  const removeCard = useCallback(
    (id: string) => {
      if (cards.length <= 1) return
      onCardsChange(cards.filter((c) => c.id !== id))
    },
    [cards, onCardsChange]
  )

  return (
    <div className="space-y-4">
      {/* Suit filter */}
      <div>
        <Label>Filter by suit</Label>
        <SuitFilter value={suitFilter} onChange={onSuitFilterChange} />
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2">
        <span className="w-5" />
        <span className="flex-1 text-xs font-medium text-slate-500">Card name</span>
        <span className="w-[90px] text-xs font-medium text-slate-500">Orientation</span>
        <span className="w-7" />
      </div>

      {/* Card rows */}
      <div className="space-y-2">
        {cards.map((card, i) => (
          <CardRow
            key={card.id}
            card={card}
            index={i}
            suitFilter={suitFilter}
            onUpdate={updateCard}
            onRemove={removeCard}
            onEnter={addCard}
            isLast={i === cards.length - 1}
          />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addCard}>
        <Plus size={14} />
        Add card
      </Button>

      {/* Bottom of deck */}
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <Label className="mb-2 text-slate-600 font-semibold flex items-center gap-1.5">
          <RotateCcw size={13} />
          Bottom of Deck Card
        </Label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <CardAutocomplete
              id="bottom-card"
              value={bottomCard.name}
              onChange={(name) => onBottomCardChange({ ...bottomCard, name })}
              suitFilter={suitFilter}
              placeholder="Bottom of deck card…"
            />
          </div>
          <OrientationToggle
            value={bottomCard.orientation}
            onChange={(orientation) => onBottomCardChange({ ...bottomCard, orientation })}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          This card's energy weaves through the entire reading as an undercurrent.
        </p>
      </div>
    </div>
  )
}
