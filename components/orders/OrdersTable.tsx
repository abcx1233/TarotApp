'use client'

import Link from 'next/link'
import { format, isToday, differenceInDays } from 'date-fns'
import { ExternalLink, Zap, Trash2, RotateCcw } from 'lucide-react'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
}

export function OrdersTable({ orders, onUpdateStatus, onDuplicate, onArchive, onTrash, onExtendLink }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-400">No orders match your filters.</p>
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
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Order
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Client
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Tier / Topic
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Price
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Due
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => {
            const dueDate = order.due_at ? new Date(order.due_at) : null
            const isDueToday = dueDate ? isToday(dueDate) : false
            const isMediaDelivery =
              order.delivery_format === 'voice_note' || order.delivery_format === 'video'
            const hasMedia = !!order.reading?.media_signed_url

            return (
              <tr
                key={order.id}
                className={order.is_rush ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-400"
                      onClick={() => onArchive(order.id)}
                    >
                      Archive
                    </Button>
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
