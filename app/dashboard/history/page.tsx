'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/Badge'
import { Copy, Check, RotateCcw } from 'lucide-react'
import type { Reading } from '@/types'

const TIER_LABELS: Record<string, string> = {
  mini: 'Mini', core: 'Core', premium: 'Premium', celtic_cross: 'Celtic Cross',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function HistoryPage() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      let query = supabase
        .from('readings')
        .select('*, order:orders(reading_tier, topic, status, client_id), client:clients(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(100)

      const { data } = await query
      setReadings((data ?? []) as Reading[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = readings.filter((r) => {
    const name = r.client?.full_name?.toLowerCase() ?? ''
    const matchesSearch = !search || name.includes(search.toLowerCase())
    const matchesTier = !tierFilter || r.order?.reading_tier === tierFilter
    const matchesTopic = !topicFilter || r.order?.topic === topicFilter
    return matchesSearch && matchesTier && matchesTopic
  })

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Reading History</h1>
        <p className="text-sm text-slate-500">{filtered.length} readings</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex-1 min-w-[180px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client name…"
          />
        </div>
        <div className="w-36">
          <Select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
            <option value="">All tiers</option>
            <option value="mini">Mini</option>
            <option value="core">Core</option>
            <option value="premium">Premium</option>
            <option value="celtic_cross">Celtic Cross</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="">All topics</option>
            <option>Love</option>
            <option>Career</option>
            <option>General</option>
            <option>Spiritual Guidance</option>
            <option>Custom</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((reading) => (
            <div
              key={reading.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              {/* Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(expanded === reading.id ? null : reading.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 truncate">
                      {reading.client?.full_name ?? 'Unknown'}
                    </p>
                    <StatusBadge status={reading.order?.status ?? 'pending'} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {TIER_LABELS[reading.order?.reading_tier ?? ''] ?? '—'} · {reading.order?.topic} ·{' '}
                    {format(new Date(reading.created_at), 'd MMM yyyy')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {reading.generated_reading && (
                    <CopyButton text={reading.generated_reading} />
                  )}
                  <Link
                    href={`/dashboard/readings/new`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="sm" className="text-xs">
                      <RotateCcw size={11} />
                      Reopen
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Expanded content */}
              {expanded === reading.id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {reading.generated_reading && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Full Reading
                      </p>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 max-h-64 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {reading.generated_reading}
                        </p>
                      </div>
                    </div>
                  )}

                  {reading.email_version && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Email Version
                      </p>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 max-h-48 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                          {reading.email_version}
                        </p>
                      </div>
                    </div>
                  )}

                  {reading.whatsapp_version && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        WhatsApp Version
                      </p>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 max-h-40 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                          {reading.whatsapp_version}
                        </p>
                      </div>
                    </div>
                  )}

                  {reading.reader_notes && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Internal notes
                      </p>
                      <p className="text-sm text-slate-600">{reading.reader_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">No readings found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
