'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, isToday, differenceInDays } from 'date-fns'
import { ExternalLink, Zap, Trash2, RotateCcw, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Archive, ListOrdered } from 'lucide-react'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderTimeline } from './OrderTimeline'
import { clsx } from 'clsx'
import type { Order } from '@/types'

const TIER_LABELS: Record<string, string> = {
  mini: 'Mini',
  core: 'Core',
  premium: 'Premium',
  celtic_cross: 'Celtic Cross',
}

function ExpiryIndicator({ expiresAt }: { expiresAt: string | null | undefined }) {
  if (!expiresAt) return null
  const days = differenceInDays(new Date(expiresAt), new Date())
  const label = days < 0 ? 'Expired' : `${days}d`
  const colour =
    days < 0 ? 'text-slate-400' :
    days < 7 ? 'text-red-500' :
    days < 15 ? 'text-amber-500' : 'text-green-600'
  return (
    <span className={`text-xs font-medium ${colour}`} title={`Link expires ${format(new Date(expiresAt), 'd MMM yyyy')}`}>
      {label}
    </span>
  )
}

interface OrdersTableProps {
  orders: Order[]
  onUpdateStatus: (orderId: string, status: string) => void
  onDuplicate: (orderId: string) => void
  onArchive: (orderId: string) => void
  onTrash: (orderId: string) => void
  onExtendLink?: () => void
  onBulkArchive?: (ids: string[]) => void
  onBulkTrash?: (ids: string[]) => void
}

type SortKey = 'order' | 'client' | 'tier' | 'price' | 'due' | 'status'

function sortValue(o: Order, key: SortKey): string | number {
  switch (key) {
    case 'order': return o.id.slice(-6)
    case 'client': return (o.client?.full_name ?? '').toLowerCase()
    case 'tier': return o.reading_tier
    case 'price': return o.price_total
    case 'due': return o.due_at ? new Date(o.due_at).getTime() : Number.POSITIVE_INFINITY
    case 'status': return o.status
  }
}

function SortHeader({
  label, sortKey, sort, onSort, className,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' } | null
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort?.key === sortKey
  const Icon = !active ? ChevronsUpDown : sort!.dir === 'asc' ? ChevronUp : ChevronDown
  return (
    <th
      scope="col"
      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={clsx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900"
      >
        {label}
        <Icon size={12} className={active ? 'text-brand-600' : 'text-slate-300'} aria-hidden="true" />
      </button>
    </th>
  )
}

export function OrdersTable({ orders, onUpdateStatus, onDuplicate, onArchive, onTrash, onExtendLink, onBulkArchive, onBulkTrash }: OrdersTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null // third click returns to the default order
    })
  }

  const rows = useMemo(() => {
    if (!sort) return orders
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...orders].sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      return av < bv ? -dir : av > bv ? dir : 0
    })
  }, [orders, sort])

  // Drop selections for rows that are no longer shown (after a filter, trash or refetch).
  const visibleIds = useMemo(() => new Set(orders.map((o) => o.id)), [orders])
  const selectedIds = useMemo(() => Array.from(selected).filter((id) => visibleIds.has(id)), [selected, visibleIds])
  const allSelected = orders.length > 0 && selectedIds.length === orders.length

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)))
  }
  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white">
        <EmptyState
          icon={ListOrdered}
          title="No orders to show"
          description="Nothing matches the current filters, or there are no orders yet."
          action={{ label: 'Start a new reading', href: '/dashboard/readings/new' }}
        />
      </div>
    )
  }

  async function handleExtendLink(readingId: string) {
    const res = await fetch('/api/readings/extend-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readingId }),
    })
    if (res.ok) onExtendLink?.()
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2.5" role="region" aria-label="Bulk actions">
          <p className="text-sm font-medium text-brand-700">{selectedIds.length} selected</p>
          <div className="flex items-center gap-1">
            {onBulkArchive && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { onBulkArchive(selectedIds); setSelected(new Set()) }}>
                <Archive size={12} />
                Archive
              </Button>
            )}
            {onBulkTrash && (
              <Button variant="ghost" size="sm" className="text-xs text-red-600" onClick={() => { onBulkTrash(selectedIds); setSelected(new Set()) }}>
                <Trash2 size={12} />
                Move to Trash
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th scope="col" className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all orders"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
            </th>
            <SortHeader label="Order" sortKey="order" sort={sort} onSort={toggleSort} />
            <SortHeader label="Client" sortKey="client" sort={sort} onSort={toggleSort} />
            <SortHeader label="Tier / Topic" sortKey="tier" sort={sort} onSort={toggleSort} />
            <SortHeader label="Price" sortKey="price" sort={sort} onSort={toggleSort} />
            <SortHeader label="Due" sortKey="due" sort={sort} onSort={toggleSort} />
            <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((order) => {
            const dueDate = order.due_at ? new Date(order.due_at) : null
            const isDueToday = dueDate ? isToday(dueDate) : false
            const isMediaDelivery =
              order.delivery_format === 'voice_note' || order.delivery_format === 'video'
            const hasMedia = !!order.reading?.media_signed_url
            const hasFollowUp = order.order_addons?.some((a) => a.addon_type === 'follow_up') ?? false

            const isOpen = expanded.has(order.id)
            const isSelected = selected.has(order.id)

            return (
              <Fragment key={order.id}>
              <tr
                className={clsx(
                  order.is_rush ? 'bg-red-50/30' : 'hover:bg-slate-50/50',
                  isSelected && 'bg-brand-50/60'
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(order.id)}
                    aria-label={`Select order ${order.id.slice(-6).toUpperCase()}`}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(order.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? 'Hide timeline' : 'Show timeline'}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <ChevronRight size={14} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                    </button>
                    {order.is_rush && (
                      <Zap size={12} className="text-red-500 shrink-0" />
                    )}
                    <span className="font-mono text-xs text-slate-500">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {order.client?.full_name ?? <span className="text-slate-400">No client</span>}
                    </p>
                    {order.client?.email && (
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">
                        {order.client.email}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-800">{TIER_LABELS[order.reading_tier] ?? order.reading_tier}</p>
                  <p className="text-xs text-slate-400">{order.topic}</p>
                </td>
                <td className="px-4 py-3 text-slate-800">
                  £{order.price_total.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {dueDate ? (
                    <span className={isDueToday ? 'text-amber-600 font-medium' : 'text-slate-700'}>
                      {isDueToday ? 'Today' : format(dueDate, 'd MMM')}
                      {' '}
                      <span className="text-xs text-slate-400">
                        {format(dueDate, 'HH:mm')}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={order.status} />
                    {order.is_rush && <Badge variant="rush">RUSH</Badge>}
                    {hasFollowUp && <Badge variant="default">Follow-up</Badge>}
                    {isDueToday && <Badge variant="warning">DUE TODAY</Badge>}
                    {order.is_test && <Badge variant="warning">TEST</Badge>}
                    {isMediaDelivery && hasMedia && (
                      <ExpiryIndicator expiresAt={order.reading?.media_url_expires_at} />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={
                        order.reading?.id
                          ? `/dashboard/readings/new?readingId=${order.reading.id}`
                          : `/dashboard/readings/new?orderId=${order.id}`
                      }
                    >
                      <Button variant="ghost" size="sm" className="text-xs">
                        <ExternalLink size={12} />
                        Open
                      </Button>
                    </Link>
                    {isMediaDelivery && hasMedia && order.reading?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-brand-600"
                        onClick={() => handleExtendLink(order.reading!.id)}
                        title="Extend the signed URL by 30 days"
                      >
                        <RotateCcw size={12} />
                        Extend link
                      </Button>
                    )}
                    {order.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-blue-600"
                        onClick={() => onUpdateStatus(order.id, 'in_progress')}
                      >
                        Start
                      </Button>
                    )}
                    {order.status === 'awaiting_review' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-green-600"
                        onClick={() => onUpdateStatus(order.id, 'sent')}
                      >
                        Mark sent
                      </Button>
                    )}
                    {order.status === 'archived' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-brand-600"
                        // Archiving doesn't record the previous status, so restore to where an
                        // order with a reading would sit, or back to Pending if it has none.
                        onClick={() => onUpdateStatus(order.id, order.reading?.id ? 'awaiting_review' : 'pending')}
                        title="Move back out of the archive"
                      >
                        <RotateCcw size={12} />
                        Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-400"
                        onClick={() => onArchive(order.id)}
                      >
                        Archive
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-400 hover:text-red-600"
                      onClick={() => onTrash(order.id)}
                      title="Move to Trash"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </td>
              </tr>
              {isOpen && (
                <tr className="bg-slate-50/60">
                  <td colSpan={8}>
                    <OrderTimeline order={order} />
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
