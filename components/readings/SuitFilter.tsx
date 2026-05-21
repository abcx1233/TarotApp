'use client'

import { clsx } from 'clsx'

const SUITS = [
  { value: 'all', label: 'All Cards' },
  { value: 'Major Arcana', label: 'Major Arcana' },
  { value: 'Cups', label: 'Cups' },
  { value: 'Pentacles', label: 'Pentacles' },
  { value: 'Wands', label: 'Wands' },
  { value: 'Swords', label: 'Swords' },
]

interface SuitFilterProps {
  value: string
  onChange: (suit: string) => void
}

export function SuitFilter({ value, onChange }: SuitFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUITS.map((suit) => (
        <button
          key={suit.value}
          type="button"
          onClick={() => onChange(suit.value)}
          className={clsx(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            value === suit.value
              ? 'bg-navy text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {suit.label}
        </button>
      ))}
    </div>
  )
}
