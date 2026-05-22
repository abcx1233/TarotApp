import Link from 'next/link'
import { format, isToday, startOfDay, endOfDay, startOfWeek, differenceInDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { KPICard } from '@/components/ui/Card'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Clock,
  Loader2,
  CheckCircle2,
  PoundSterling,
  Zap,
  Plus,
  ArrowRight,
  Calendar,
  TrendingUp,
} from 'lucide-react'

async function getDashboardData() {
  const supabase = createClient()

  const todayStart = startOfDay(new Date()).toISOString()
  const todayEnd = endOfDay(new Date()).toISOString()
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()

  const [
    { count: pending },
    { count: inProgress },
    { data: sentToday },
    { data: sentThisWeek },
    { count: dueToday },
    { data: oldestPendingRows },
    { data: todayQueue },
    { data: recentReadings },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'in_progress').is('deleted_at', null),
    supabase
      .from('orders')
      .select('price_total')
      .eq('status', 'sent')
      .is('deleted_at', null)
      .gte('sent_at', todayStart)
      .lte('sent_at', todayEnd),
    supabase
      .from('orders')
      .select('price_total')
      .eq('status', 'sent')
      .is('deleted_at', null)
      .gte('sent_at', weekStart),
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress'])
      .is('deleted_at', null)
      .gte('due_at', todayStart)
      .lte('due_at', todayEnd),
    supabase
      .from('orders')
      .select('created_at')
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1),
    supabase
      .from('orders')
      .select('*, client:clients(full_name, email)')
      .in('status', ['pending', 'in_progress'])
      .is('deleted_at', null)
      .order('is_rush', { ascending: false })
      .order('due_at', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('readings')
      .select('*, order:orders(reading_tier, topic, status), client:clients(full_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const revenueToday = (sentToday ?? []).reduce(
    (sum: number, o: { price_total: number }) => sum + (o.price_total ?? 0),
    0
  )
  const revenueThisWeek = (sentThisWeek ?? []).reduce(
    (sum: number, o: { price_total: number }) => sum + (o.price_total ?? 0),
    0
  )
  const oldestPendingDays =
    oldestPendingRows?.[0]?.created_at
      ? differenceInDays(new Date(), new Date(oldestPendingRows[0].created_at))
      : null

  return {
    kpis: {
      pending: pending ?? 0,
      inProgress: inProgress ?? 0,
      sentToday: sentToday?.length ?? 0,
      revenueToday,
      revenueThisWeek,
      dueToday: dueToday ?? 0,
      oldestPendingDays,
    },
    todayQueue: todayQueue ?? [],
    recentReadings: recentReadings ?? [],
  }
}

const TIER_SHORT: Record<string, string> = {
  mini: 'Mini', core: 'Core', premium: 'Premium', celtic_cross: 'Celtic Cross',
}

export default async function DashboardPage() {
  const { kpis, todayQueue, recentReadings } = await getDashboardData()

  const oldestPendingSub =
    kpis.pending > 0 && kpis.oldestPendingDays !== null
      ? kpis.oldestPendingDays === 0
        ? 'oldest from today'
        : `oldest from ${kpis.oldestPendingDays} day${kpis.oldestPendingDays === 1 ? '' : 's'} ago`
      : undefined

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link href="/dashboard/readings/new">
          <Button size="sm">
            <Plus size={14} />
            New Reading
          </Button>
        </Link>
        <Link href="/dashboard/readings/new">
          <Button size="sm" variant="outline">
            <Plus size={14} />
            Add Manual Order
          </Button>
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard
          label="Pending"
          value={kpis.pending}
          icon={<Clock size={18} />}
          sub={oldestPendingSub}
        />
        <KPICard
          label="In Progress"
          value={kpis.inProgress}
          icon={<Loader2 size={18} />}
        />
        <KPICard
          label="Due Today"
          value={kpis.dueToday}
          icon={<Calendar size={18} />}
        />
        <KPICard
          label="Sent today"
          value={kpis.sentToday}
          icon={<CheckCircle2 size={18} />}
        />
        <KPICard
          label="Revenue today"
          value={`£${kpis.revenueToday.toFixed(2)}`}
          icon={<PoundSterling size={18} />}
          accent
        />
        <KPICard
          label="Revenue this week"
          value={`£${kpis.revenueThisWeek.toFixed(2)}`}
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Today's queue */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Today's queue</h2>
          <Link href="/dashboard/orders" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {todayQueue.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">You're all caught up ✨</p>
            <p className="mt-1 text-sm text-slate-400">
              No active orders right now — enjoy the quiet or start a new reading.
            </p>
            <Link href="/dashboard/readings/new" className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                <Plus size={13} />
                New Reading
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Client</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Tier</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Due</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayQueue.map((order: {
                  id: string;
                  is_rush: boolean;
                  is_test: boolean;
                  due_at: string | null;
                  status: string;
                  reading_tier: string;
                  topic: string;
                  client?: { full_name: string; email: string } | null;
                }) => (
                  <tr key={order.id} className={order.is_rush ? 'bg-red-50/40' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {order.is_rush && <Zap size={11} className="text-red-500 shrink-0" />}
                        <span className="font-medium text-slate-800">
                          {order.client?.full_name ?? <span className="text-slate-400">No client</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {TIER_SHORT[order.reading_tier] ?? order.reading_tier}
                      <span className="ml-1.5 text-xs text-slate-400">{order.topic}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.due_at ? (
                        <span className={isToday(new Date(order.due_at)) ? 'text-amber-600 font-medium' : ''}>
                          {isToday(new Date(order.due_at)) ? 'Today ' : ''}
                          {format(new Date(order.due_at), 'HH:mm')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <StatusBadge status={order.status} />
                        {order.is_rush && <Badge variant="rush">RUSH</Badge>}
                        {order.due_at && isToday(new Date(order.due_at)) && (
                          <Badge variant="warning">DUE TODAY</Badge>
                        )}
                        {order.is_test && <Badge variant="warning">TEST</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/readings/new?orderId=${order.id}`}>
                        <Button variant="outline" size="sm" className="text-xs">Open</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent readings */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent readings</h2>
          <Link href="/dashboard/history" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {recentReadings.length === 0 ? (
          <p className="text-sm text-slate-400">No readings generated yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {recentReadings.map((reading: {
              id: string;
              created_at: string;
              client?: { full_name: string } | null;
              order?: { reading_tier: string; topic: string; status: string } | null;
            }) => (
              <div
                key={reading.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-sm font-medium text-slate-900 truncate">
                  {reading.client?.full_name ?? <span className="text-slate-400">No client</span>}
                </p>
                <p className="text-xs text-slate-400">
                  {TIER_SHORT[reading.order?.reading_tier ?? ''] ?? '—'} · {reading.order?.topic}
                </p>
                <div className="flex items-center justify-between mt-auto pt-2">
                  <p className="text-xs text-slate-400">
                    {format(new Date(reading.created_at), 'd MMM')}
                  </p>
                  <StatusBadge status={reading.order?.status ?? 'pending'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
