'use client'

import { useState } from 'react'
import { Search, Star, FileText } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { clsx } from 'clsx'
import type { Client } from '@/types'

interface ClientListProps {
  clients: Client[]
  selectedId: string | null
  onSelect: (client: Client) => void
  noteClientIds?: Set<string>
}

export function ClientList({ clients, selectedId, onSelect, noteClientIds }: ClientListProps) {
  const [search, setSearch] = useState('')

  const filtered = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-200">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No clients found.</p>
        )}
        {filtered.map((client) => (
          <button
            key={client.id}
            onClick={() => onSelect(client)}
            className={clsx(
              'w-full px-4 py-3 text-left transition-colors hover:bg-slate-50',
              selectedId === client.id && 'bg-brand-50 border-r-2 border-brand-500'
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm font-medium text-slate-900 truncate">{client.full_name}</p>
              <div className="flex items-center gap-1 shrink-0">
                {noteClientIds?.has(client.id) && (
                  <span title="Has private notes">
                    <FileText size={11} className="text-slate-400" />
                  </span>
                )}
                {client.is_returning && (
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                )}
              </div>
            </div>
            {client.email && (
              <p className="text-xs text-slate-400 truncate">{client.email}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">
              £{client.total_spent.toFixed(2)} total
            </p>
          </button>
        ))}
      </div>

      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400">
        {filtered.length} client{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
