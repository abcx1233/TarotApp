'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNow, isSameDay } from 'date-fns'
import { Activity, FilePlus2, Send, Sparkles, Trash2, UserPlus, Moon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface ActivityEvent {
  id: string
  at: string
  icon: LucideIcon
  text: string
  href?: string
}

const TIER: Record<string, string> = { mini: 'Mini', core: 'Core', premium: 'Premium', celtic_cross: 'Celtic Cross' }
const LIMIT = 40

type Row = Record<string, unknown>
const asRows = (d: unknown) => (Array.isArray(d) ? (d as Row[]) : [])
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * A read-only feed built from the timestamps already stored on each record
 * (created, sent, trashed, approved). It shows what happened and when, but not who
 * did it, and edits aren't recorded separately — a real audit trail would need
 * database triggers.
 */
export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const [orders, readings, clients, daily] = await Promise.all([
          supabase
            .from('orders')
            .select('id, reading_tier, created_at, sent_at, deleted_at, client:clients(full_name)')
            .order('updated_at', { ascending: false })
            .limit(LIMIT),
          supabase
            .from('readings')
            .select('id, created_at, order:orders(client:clients(full_name))')
            .order('created_at', { ascending: false })
            .limit(LIMIT),
          supabase.from('clients').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(LIMIT),
          supabase
            .from('daily_messages')
            .select('id, message_date, card_name, approved_at')
            .not('approved_at', 'is', null)
            .order('approved_at', { ascending: false })
            .limit(LIMIT),
        ])
        if (orders.error || readings.error || clients.error) throw new Error('load failed')

        const out: ActivityEvent[] = []
        const nameOf = (c: unknown): string => {
          const one = Array.isArray(c) ? c[0] : c
          return str((one as Row | undefined)?.full_name) || 'a client'
        }
        for (const o of asRows(orders.data)) {
          const who = nameOf(o.client)
          const tier = TIER[str(o.reading_tier)] ?? str(o.reading_tier)
          const href = `/dashboard/readings/new?orderId=${str(o.id)}`
          if (o.created_at) out.push({ id: `oc-${o.id}`, at: str(o.created_at), icon: FilePlus2, text: `New ${tier} order for ${who}`, href })
          if (o.sent_at) out.push({ id: `os-${o.id}`, at: str(o.sent_at), icon: Send, text: `Sent ${tier} reading to ${who}`, href })
          if (o.deleted_at) out.push({ id: `od-${o.id}`, at: str(o.deleted_at), icon: Trash2, text: `Moved ${who}'s order to Trash`, href: '/dashboard/trash' })
        }
        for (const r of asRows(readings.data)) {
          const order = Array.isArray(r.order) ? r.order[0] : r.order
          out.push({
            id: `r-${r.id}`,
            at: str(r.created_at),
            icon: Sparkles,
            text: `Reading generated for ${nameOf((order as Row | undefined)?.client)}`,
            href: `/dashboard/readings/new?readingId=${str(r.id)}`,
          })
        }
        for (const c of asRows(clients.data)) {
          out.push({ id: `c-${c.id}`, at: str(c.created_at), icon: UserPlus, text: `Client added: ${str(c.full_name)}`, href: `/dashboard/clients?id=${str(c.id)}` })
        }
        for (const d of asRows(daily.data)) {
          out.push({
            id: `d-${d.id}`,
            at: str(d.approved_at),
            icon: Moon,
            text: `Daily message approved for ${format(new Date(`${str(d.message_date)}T12:00:00`), 'd MMM')} (${str(d.card_name)})`,
            href: '/dashboard/daily-message/calendar',
          })
        }
        out.sort((a, b) => (a.at < b.at ? 1 : -1))
        setEvents(out.slice(0, 80))
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const days = useMemo(() => {
    const groups: { day: Date; items: ActivityEvent[] }[] = []
    for (const e of events) {
      const d = new Date(e.at)
      const last = groups[groups.length - 1]
      if (last && isSameDay(last.day, d)) last.items.push(e)
      else groups.push({ day: d, items: [e] })
    }
    return groups
  }, [events])

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <PageHeader title="Activity" description="Recent orders, readings, clients and daily messages, newest first." />

      {loading ? (
        <SkeletonRows rows={6} />
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Activity} title="Couldn't load activity" description="Try refreshing the page." />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Activity} title="Nothing has happened yet" description="Orders, readings and approvals will show up here." />
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(({ day, items }) => (
            <section key={day.toISOString()}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {format(day, 'EEEE d MMMM')}
              </h2>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {items.map((e) => {
                  const Icon = e.icon
                  const row = (
                    <>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{e.text}</span>
                      <time dateTime={e.at} title={format(new Date(e.at), 'd MMM yyyy, HH:mm')} className="shrink-0 text-xs text-slate-400">
                        {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                      </time>
                    </>
                  )
                  return (
                    <li key={e.id}>
                      {e.href ? (
                        <Link href={e.href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
