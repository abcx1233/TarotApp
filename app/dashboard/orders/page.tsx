'use client'

import { useEffect, useState, useCallback } from 'react'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { OrderFilters, type OrderFiltersState } from '@/components/orders/OrderFilters'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import { isToday } from 'date-fns'

const INITIAL_FILTERS: OrderFiltersState = {
  search: '',
  status: '',
  tier: '',
  topic: '',
  dueToday: false,
  rushOnly: false,
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<OrderFiltersState>(INITIAL_FILTERS)

  const fetchOrders = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('orders')
      .select('*, client:clients(full_name, email)')
      .order('is_rush', { ascending: false })
      .order('due_at', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200)

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.tier) query = query.eq('reading_tier', filters.tier)
    if (filters.topic) query = query.eq('topic', filters.topic)
    if (filters.rushOnly) query = query.eq('is_rush', true)

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

  async function handleUpdateStatus(orderId: string, status: string) {
    const supabase = createClient()
    await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    fetchOrders()
  }

  async function handleArchive(orderId: string) {
    handleUpdateStatus(orderId, 'archived')
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500">{orders.length} orders</p>
      </div>

      <OrderFilters filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <OrdersTable
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
        />
      )}
    </div>
  )
}
