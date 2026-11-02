'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Sun, User, ListOrdered, CornerDownLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { ALL_NAV } from '@/lib/nav'
import { useTheme } from '@/contexts/ThemeContext'

interface PaletteItem {
  id: string
  section: 'Actions' | 'Pages' | 'Clients' | 'Orders'
  label: string
  hint?: string
  icon: LucideIcon
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter()
  const { resolved, setPreference } = useTheme()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [clientHits, setClientHits] = useState<PaletteItem[]>([])
  const [orderHits, setOrderHits] = useState<PaletteItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const go = useCallback(
    (href: string) => {
      onClose()
      router.push(href)
    },
    [onClose, router]
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setClientHits([])
      setOrderHits([])
      // wait for the dialog to mount
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Live search of clients and orders (RLS applies — this runs as the signed-in user).
  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < 2) {
      setClientHits([])
      setOrderHits([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient()
        const like = `%${q.replace(/[%,()]/g, ' ')}%`
        const [{ data: clients }, { data: orders }] = await Promise.all([
          supabase
            .from('clients')
            .select('id, full_name, email')
            .is('deleted_at', null)
            .or(`full_name.ilike.${like},email.ilike.${like}`)
            .limit(5),
          supabase
            .from('orders')
            .select('id, status, reading_tier, client:clients!inner(full_name)')
            .is('deleted_at', null)
            .ilike('client.full_name', like)
            .limit(5),
        ])
        if (cancelled) return
        setClientHits(
          (clients ?? []).map((c) => ({
            id: `client-${c.id}`,
            section: 'Clients' as const,
            label: c.full_name,
            hint: c.email ?? undefined,
            icon: User,
            run: () => go(`/dashboard/clients?id=${c.id}`),
          }))
        )
        setOrderHits(
          (orders ?? []).map((o) => {
            const client = Array.isArray(o.client) ? o.client[0] : o.client
            return {
              id: `order-${o.id}`,
              section: 'Orders' as const,
              label: `${client?.full_name ?? 'Order'} · ${String(o.reading_tier).replace('_', ' ')}`,
              hint: String(o.status).replace('_', ' '),
              icon: ListOrdered,
              run: () => go(`/dashboard/readings/new?orderId=${o.id}`),
            }
          })
        )
      } catch {
        if (!cancelled) {
          setClientHits([])
          setOrderHits([])
        }
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open, go])

  const staticItems = useMemo<PaletteItem[]>(
    () => [
      {
        id: 'action-new-reading',
        section: 'Actions',
        label: 'New reading',
        hint: 'N',
        icon: Plus,
        run: () => go('/dashboard/readings/new'),
      },
      {
        id: 'action-theme',
        section: 'Actions',
        label: resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: Sun,
        run: () => {
          setPreference(resolved === 'dark' ? 'light' : 'dark')
          onClose()
        },
      },
      ...ALL_NAV.map((n) => ({
        id: `page-${n.href}`,
        section: 'Pages' as const,
        label: n.label,
        hint: n.shortcut ? `G then ${n.shortcut.toUpperCase()}` : undefined,
        icon: n.icon,
        run: () => go(n.href),
      })),
    ],
    [go, onClose, resolved, setPreference]
  )

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? staticItems.filter((i) => i.label.toLowerCase().includes(q)) : staticItems
    return [...filtered, ...clientHits, ...orderHits]
  }, [query, staticItems, clientHits, orderHits])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(items.length - 1, 0)))
  }, [items.length])

  if (!open) return null

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (items.length ? (a + 1) % items.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[active]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  let lastSection = ''
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
            placeholder="Search clients, orders, pages and actions…"
            className="h-12 w-full border-0 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0"
          />
          <kbd className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">No results</li>}
          {items.map((item, i) => {
            const header = item.section !== lastSection
            lastSection = item.section
            const Icon = item.icon
            return (
              <li key={item.id} role="presentation">
                {header && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {item.section}
                  </p>
                )}
                <div
                  id={`palette-${item.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => item.run()}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm',
                    i === active ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
                  )}
                >
                  <Icon size={15} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-xs capitalize text-slate-400">{item.hint}</span>}
                  {i === active && <CornerDownLeft size={12} className="shrink-0 text-slate-400" aria-hidden="true" />}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
