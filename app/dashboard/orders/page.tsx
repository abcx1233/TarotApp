'use client'

import { useEffect, useState, useCallback } from 'react'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { OrderFilters, type OrderFiltersState } from '@/components/orders/OrderFilters'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonRows } from '@/components/ui/Skeleton'
import type { Order } from '@/types'
import { isToday } from 'date-fns'

const INITIAL_FILTERS: OrderFiltersState = {
  search: '',
  status: '',
  tier: '',
  topic: '',
  dueToday: false,
}

export default function OrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<OrderFiltersState>(INITIAL_FILTERS)

  const fetchOrders = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('orders')
      .select('*, client:clients(full_name, email), reading:readings(id, media_signed_url, media_url_expires_at), order_addons(addon_type)')
      .is('deleted_at', null)
      .order('is_rush', { ascending: false })
      .order('due_at', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200)

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.tier) query = query.eq('reading_tier', filters.tier)
    if (filters.topic) query = query.eq('topic', filters.topic)

    const { data } = await query
    let results = (data ?? []) as Order[]

    // Client-side filters
    if (filters.search) {
      const q = filters.search.toLowerCase()
      results = results.filter(
        (o) =>
          o.client?.full_name?.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      )
    }
    if (filters.dueToday) {
      results = results.filter((o) => o.due_at && isToday(new Date(o.due_at)))
    }

    setOrders(results)
    setLoading(false)
  }, [filters])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  async function handleUpdateStatus(orderId: string, status: string, opts?: { silent?: boolean }) {
    const supabase = createClient()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('orders')
      // Marking sent must also stamp sent_at, the same as the reading page's
      // Mark Sent (ReadingForm.handleMarkSent) — the Dashboard's Sent today /
      // Revenue figures filter on sent_at, so without it the order is never counted.
      .update(status === 'sent' ? { status, sent_at: now, updated_at: now } : { status, updated_at: now })
      .eq('id', orderId)
    if (error) {
      toast({ message: 'Could not update the order. Please try again.', tone: 'error' })
      return false
    }
    if (!opts?.silent) toast({ message: status === 'sent' ? 'Marked as sent' : 'Order updated', tone: 'success' })
    fetchOrders()
    return true
  }

  function notifyTrashChanged() {
    window.dispatchEvent(new Event('trash-count-changed'))
  }

  /** Soft-delete or restore a set of orders. Returns true on success. */
  async function setDeleted(ids: string[], deleted: boolean) {
    const supabase = createClient()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('orders')
      .update({ deleted_at: deleted ? now : null, updated_at: now })
      .in('id', ids)
    if (error) {
      toast({ message: deleted ? 'Could not move to Trash.' : 'Could not restore.', tone: 'error' })
      return false
    }
    notifyTrashChanged()
    fetchOrders()
    return true
  }

  /** Set status on several orders, remembering each one's previous status for Undo. */
  async function setStatusMany(ids: string[], status: string) {
    const previous = new Map(orders.filter((o) => ids.includes(o.id)).map((o) => [o.id, o.status]))
    const supabase = createClient()
    const now = new Date().toISOString()
    const { error } = await supabase.from('orders').update({ status, updated_at: now }).in('id', ids)
    if (error) {
      toast({ message: 'Could not update the orders. Please try again.', tone: 'error' })
      return
    }
    fetchOrders()
    toast({
      message: ids.length === 1 ? 'Order archived' : `${ids.length} orders archived`,
      tone: 'success',
      action: {
        label: 'Undo',
        onClick: async () => {
          const sb = createClient()
          await Promise.all(
            ids.map((id) =>
              sb.from('orders').update({ status: previous.get(id) ?? 'pending', updated_at: new Date().toISOString() }).eq('id', id)
            )
          )
          fetchOrders()
        },
      },
    })
  }

  async function handleArchive(orderId: string) {
    await setStatusMany([orderId], 'archived')
  }

  async function trashWithUndo(ids: string[]) {
    if (!(await setDeleted(ids, true))) return
    toast({
      message: ids.length === 1 ? 'Order moved to Trash' : `${ids.length} orders moved to Trash`,
      tone: 'success',
      action: { label: 'Undo', onClick: () => void setDeleted(ids, false) },
    })
  }

  async function handleTrash(orderId: string) {
    await trashWithUndo([orderId])
  }

  async function handleDuplicate(orderId: string) {
    const supabase = createClient()
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) return

    const { id: _id, created_at: _ca, updated_at: _ua, sent_at: _sa, ...rest } = order
    await supabase.from('orders').insert({ ...rest, status: 'pending', sent_at: null })
    fetchOrders()
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Orders"
        description={`${orders.length} order${orders.length === 1 ? '' : 's'}`}
      />

      <OrderFilters filters={filters} onChange={setFilters} />

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <OrdersTable
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
          onTrash={handleTrash}
          onExtendLink={fetchOrders}
          onBulkArchive={(ids) => void setStatusMany(ids, 'archived')}
          onBulkTrash={(ids) => void trashWithUndo(ids)}
        />
      )}
    </div>
  )
}
