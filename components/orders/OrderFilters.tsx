'use client'

import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Search } from 'lucide-react'

export interface OrderFiltersState {
  search: string
  status: string
  tier: string
  topic: string
  dueToday: boolean
  rushOnly: boolean
}

interface OrderFiltersProps {
  filters: OrderFiltersState
  onChange: (filters: OrderFiltersState) => void
}

export function OrderFilters({ filters, onChange }: OrderFiltersProps) {
  function set(key: keyof OrderFiltersState, value: string | boolean) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Search client or ID…"
          className="pl-8"
        />
      </div>

      {/* Status */}
      <div className="w-40">
        <Select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="awaiting_review">Awaiting Review</option>
          <option value="sent">Sent</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      {/* Tier */}
      <div className="w-36">
        <Select value={filters.tier} onChange={(e) => set('tier', e.target.value)}>
          <option value="">All tiers</option>
          <option value="mini">Mini</option>
          <option value="core">Core</option>
          <option value="premium">Premium</option>
          <option value="celtic_cross">Celtic Cross</option>
        </Select>
      </div>

      {/* Topic */}
      <div className="w-40">
        <Select value={filters.topic} onChange={(e) => set('topic', e.target.value)}>
          <option value="">All topics</option>
          <option>Love</option>
          <option>Career</option>
          <option>General</option>
          <option>Spiritual Guidance</option>
          <option>Custom</option>
        </Select>
      </div>

      <Toggle
        checked={filters.dueToday}
        onChange={(v) => set('dueToday', v)}
        label="Due today"
      />

      <Toggle
        checked={filters.rushOnly}
        onChange={(v) => set('rushOnly', v)}
        label="Rush only"
      />
    </div>
  )
}
