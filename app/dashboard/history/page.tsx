'use client'

import { useEffect, useRef, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/Badge'
import { Copy, Check, RotateCcw, Clock, Trash2 } from 'lucide-react'
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

function ExpiryIndicator({ expiresAt }: { expiresAt: string | null | undefined }) {
  if (!expiresAt) return null
  const days = differenceInDays(new Date(expiresAt), new Date())
  const label = days < 0 ? 'Link expired' : `Link valid ${days}d`
  const colour =
    days < 0 ? 'text-slate-400' :
    days < 7 ? 'text-red-500' :
    days < 15 ? 'text-amber-500' : 'text-green-600'
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colour}`}>
      <Clock size={11} />
      {label}
    </span>
  )
}

interface UndoData {
  reading: Reading
  orderId: string | null
  prevOrderStatus: string | null
}

export default function HistoryPage() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [undoData, setUndoData] = useState<UndoData | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('readings')
      .select('*, order:orders(reading_tier, topic, status, delivery_format, client_id), client:clients(full_name, email)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100)
    setReadings((data ?? []) as Reading[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleExtendLink(readingId: string) {
    const res = await fetch('/api/readings/extend-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readingId }),
    })
    if (res.ok) {
      const { signedUrl, expiresAt } = await res.json()
      setReadings((prev) =>
        prev.map((r) =>
          r.id === readingId
            ? { ...r, media_signed_url: signedUrl, media_url_expires_at: expiresAt }
            : r
        )
      )
    }
  }

  async function handleTrashReading(reading: Reading) {
    const supabase = createClient()

    const orderId = reading.order_id
    const prevOrderStatus = reading.order?.status ?? null

    // Update order status if needed
    if (orderId && (prevOrderStatus === 'awaiting_review' || prevOrderStatus === 'in_progress')) {
      await supabase
        .from('orders')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', orderId)
    }

    // Trash the reading
    await supabase
      .from('readings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', reading.id)

    // Remove from list immediately
    setReadings((prev) => prev.filter((r) => r.id !== reading.id))

    // Clear previous undo timeout
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)

    // Show undo toast for 5 seconds
    setUndoData({ reading, orderId, prevOrderStatus })
    undoTimeoutRef.current = setTimeout(() => setUndoData(null), 5000)

    // Update sidebar badge
    window.dispatchEvent(new CustomEvent('trash-count-changed'))
  }

  async function handleUndo() {
    if (!undoData) return
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
      undoTimeoutRef.current = null
    }

    const supabase = createClient()

    // Restore the reading
    await supabase
      .from('readings')
      .update({ deleted_at: null })
      .eq('id', undoData.reading.id)

    // Restore order status if it was changed
    if (
      undoData.orderId &&
      undoData.prevOrderStatus &&
      ['awaiting_review', 'in_progress'].includes(undoData.prevOrderStatus)
    ) {
      await supabase
        .from('orders')
        .update({ status: undoData.prevOrderStatus, updated_at: new Date().toISOString() })
        .eq('id', undoData.orderId)
    }

    // Re-insert reading into list at sorted position
    setReadings((prev) => {
      const next = [...prev, undoData.reading]
      return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    })

    setUndoData(null)
    window.dispatchEvent(new CustomEvent('trash-count-changed'))
  }

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
                      {reading.client?.full_name ?? <span className="text-slate-400">No client</span>}
                    </p>
                    <StatusBadge status={reading.order?.status ?? 'pending'} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {TIER_LABELS[reading.order?.reading_tier ?? ''] ?? '—'} · {reading.order?.topic} ·{' '}
                    {format(new Date(reading.created_at), 'd MMM yyyy')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {reading.media_signed_url && (
                    <ExpiryIndicator expiresAt={reading.media_url_expires_at} />
                  )}
                  {reading.media_file_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-brand-600"
                      onClick={(e) => { e.stopPropagation(); handleExtendLink(reading.id) }}
                      title="Extend the signed URL by 30 days"
                    >
                      <RotateCcw size={11} />
                      Extend link
                    </Button>
                  )}
                  {reading.generated_reading && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <CopyButton text={reading.generated_reading} />
                    </span>
                  )}
                  <Link
                    href={`/dashboard/readings/new?readingId=${reading.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="sm" className="text-xs">
                      <RotateCcw size={11} />
                      Reopen
                    </Button>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleTrashReading(reading) }}
                    className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                    title="Move to Trash"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {expanded === reading.id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {reading.media_signed_url && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Media Link
                      </p>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-600 truncate">{reading.media_signed_url}</p>
                        <ExpiryIndicator expiresAt={reading.media_url_expires_at} />
                      </div>
                    </div>
                  )}
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
                        Private Notes
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

      {/* Undo toast */}
      {undoData && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl z-50">
          <span>Reading moved to Trash</span>
          <button
            type="button"
            onClick={handleUndo}
            className="font-semibold text-brand-400 hover:text-brand-300 transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
