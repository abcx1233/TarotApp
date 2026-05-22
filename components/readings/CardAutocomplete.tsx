'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { searchCards } from '@/data/tarot-cards'
import type { TarotCard } from '@/types'
import { clsx } from 'clsx'

interface CardAutocompleteProps {
  value: string
  onChange: (value: string, card?: TarotCard) => void
  suitFilter: string
  placeholder?: string
  id?: string
  onEnter?: () => void
}

export function CardAutocomplete({
  value,
  onChange,
  suitFilter,
  placeholder = 'Search card…',
  id,
  onEnter,
}: CardAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const results = searchCards(query, suitFilter).slice(0, 12)

  // Sync internal query when value changes externally
  useEffect(() => {
    setQuery(value)
  }, [value])

  const select = useCallback(
    (card: TarotCard) => {
      setQuery(card.name)
      onChange(card.name, card)
      setOpen(false)
      inputRef.current?.blur()
    },
    [onChange]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpen(true)
        return
      }
      if (e.key === 'Enter') {
        onEnter?.()
        return
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[highlighted]) {
        select(results[highlighted])
      } else {
        onEnter?.()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    onChange(val)
    setHighlighted(0)
    setOpen(true)
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        aria-autocomplete="list"
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={
          open && results[highlighted] ? `${id}-opt-${highlighted}` : undefined
        }
        role="combobox"
        aria-expanded={open}
      />

      {open && query.trim().length > 0 && results.length > 0 && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg animate-slide-down"
        >
          {results.map((card, i) => (
            <li
              key={card.order}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={() => select(card)}
              onMouseEnter={() => setHighlighted(i)}
              className={clsx(
                'flex cursor-pointer items-center justify-between px-3 py-2 text-sm',
                i === highlighted ? 'bg-brand-50 text-brand-800' : 'text-slate-800 hover:bg-slate-50'
              )}
            >
              <span>{card.name}</span>
              <span className="text-xs text-slate-400">{card.suit}</span>
            </li>
          ))}
        </ul>
      )}

      {open && query.length > 1 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
          No cards found
        </div>
      )}
    </div>
  )
}
