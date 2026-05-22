'use client'

import { useEffect, useState, useCallback } from 'react'
import { differenceInDays, format } from 'date-fns'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import type { Client, Order, Reading } from '@/types'

const RETENTION_DAYS = 30

type TrashedClient = Client
type TrashedOrder = Order & { client?: { full_name: string } | null }
type TrashedReading = Reading & {
  client?: { full_name: string } | null
  order?: { reading_tier: string; topic: string } | null
}

const TIER_SHORT: Record<string, string> = {
  mini: 'Mini',
  core: 'Core',
  premium: 'Premium',
  celtic_cross: 'Celtic Cross',
}

function daysRemaining(deletedAt: string): number {
  return Math.max(0, RETENTION_DAYS - differenceInDays(new Date(), new Date(deletedAt)))
}

function DaysTag({ deletedAt }: { deletedAt: string }) {
  const days = daysRemaining(deletedAt)
  return (
    <span className={`text-xs font-medium ${days <= 7 ? 'text-red-500' : 'text-slate-400'}`}>
      {days}d left
    </span>
  )
}

interface RowActionsProps {
  id: string
  name: string
  table: 'clients' | 'orders' | 'readings'
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  onRestore: (table: 'clients' | 'orders' | 'readings', id: string) => void
  onDeletePermanently: (table: 'clients' | 'orders' | 'readings', id: string) => void
}

function RowActions({ id, name, table, confirmId, setConfirmId, onRestore, onDeletePermanently }: RowActionsProps) {
  if (confirmId === id) {
    return (
      <div className="flex flex-col gap-2 items-end">
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle size={12} className="shrink-0" />
          <span>Delete <strong>{name}</strong> permanently?</span>
        </div>
        <div className="flex gap-1.5">
          <Button variant="danger" size="sm" onClick={() => onDeletePermanently(table, id)}>
            Delete permanently
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-brand-600"
        onClick={() => onRestore(table, id)}
      >
        <RotateCcw size={12} />
        Restore
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-red-400 hover:text-red-600"
        onClick={() => setConfirmId(id)}
      >
        <Trash2 size={12} />
        Delete
      </Button>
    </div>
  )
}

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'orders' | 'readings'>('clients')
  const [clients, setClients] = useState<TrashedClient[]>([])
  const [orders, setOrders] = useState<TrashedOrder[]>([])
  const [readings, setReadings] = useState<TrashedReading[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: c }, { data: o }, { data: r }] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .not('deleted_at', 'is', null)
        .gte('deleted_at', cutoff)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, client:clients(full_name)')
        .not('deleted_at', 'is', null)
        .gte('deleted_at', cutoff)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('readings')
        .select('*, client:clients(full_name), order:orders(reading_tier, topic)')
        .not('deleted_at', 'is', null)
        .gte('deleted_at', cutoff)
        .order('deleted_at', { ascending: false }),
    ])

    setClients((c ?? []) as TrashedClient[])
    setOrders((o ?? []) as TrashedOrder[])
    setReadings((r ?? []) as TrashedReading[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function handleRestore(table: 'clients' | 'orders' | 'readings', id: string) {
    const supabase = createClient()
    await supabase
      .from(table)
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
    loadAll()
  }

  async function handleDeletePermanently(table: 'clients' | 'orders' | 'readings', id: string) {
    const supabase = createClient()
    await supabase.from(table).delete().eq('id', id)
    setConfirmId(null)
    loadAll()
  }

  const tabs = [
    { id: 'clients', label: `Clients${clients.length > 0 ? ` (${clients.length})` : ''}` },
    { id: 'orders', label: `Orders${orders.length > 0 ? ` (${orders.length})` : ''}` },
    { id: 'readings', label: `Readings${readings.length > 0 ? ` (${readings.length})` : ''}` },
  ]

  const actionProps = { confirmId, setConfirmId, onRestore: handleRestore, onDeletePermanently: handleDeletePermanently }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Trash</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Items are permanently deleted after {RETENTION_DAYS} days.
        </p>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => { setActiveTab(id as typeof activeTab); setConfirmId(null) }}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Clients */}
          {activeTab === 'clients' && (
            clients.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                <p className="text-sm text-slate-400">No trashed clients.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Email</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Deleted</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Expires</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{client.full_name}</td>
                        <td className="px-4 py-3 text-slate-500">{client.email ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {format(new Date(client.deleted_at!), 'd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <DaysTag deletedAt={client.deleted_at!} />
                        </td>
                        <td className="px-4 py-3">
                          <RowActions id={client.id} name={client.full_name} table="clients" {...actionProps} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Orders */}
          {activeTab === 'orders' && (
            orders.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                <p className="text-sm text-slate-400">No trashed orders.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Client</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Tier / Topic</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Deleted</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Expires</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {order.client?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {TIER_SHORT[order.reading_tier] ?? order.reading_tier}
                          <span className="ml-1.5 text-xs text-slate-400">{order.topic}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {format(new Date(order.deleted_at!), 'd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <DaysTag deletedAt={order.deleted_at!} />
                        </td>
                        <td className="px-4 py-3">
                          <RowActions
                            id={order.id}
                            name={order.client?.full_name ?? `Order #${order.id.slice(-6).toUpperCase()}`}
                            table="orders"
                            {...actionProps}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Readings */}
          {activeTab === 'readings' && (
            readings.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                <p className="text-sm text-slate-400">No trashed readings.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Client</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Reading</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Deleted</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Expires</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {readings.map((reading) => (
                      <tr key={reading.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {reading.client?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {TIER_SHORT[reading.order?.reading_tier ?? ''] ?? '—'}
                          {reading.order?.topic && (
                            <span className="ml-1.5 text-xs text-slate-400">{reading.order.topic}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {format(new Date(reading.deleted_at!), 'd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <DaysTag deletedAt={reading.deleted_at!} />
                        </td>
                        <td className="px-4 py-3">
                          <RowActions
                            id={reading.id}
                            name={reading.client?.full_name ?? 'Reading'}
                            table="readings"
                            {...actionProps}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
