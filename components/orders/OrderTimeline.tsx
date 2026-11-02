import { format } from 'date-fns'
import { Check } from 'lucide-react'
import { clsx } from 'clsx'
import type { Order } from '@/types'

const STEPS = [
  { status: 'pending', label: 'Pending' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'awaiting_review', label: 'Awaiting review' },
  { status: 'sent', label: 'Sent' },
] as const

function fmt(iso: string | null | undefined) {
  return iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : null
}

/**
 * Step timeline for an order. Only created / due / sent / last-updated carry real
 * timestamps in the database; the in-between stages show as reached or not reached
 * based on the current status rather than inventing times for them.
 */
export function OrderTimeline({ order }: { order: Order }) {
  const archived = order.status === 'archived'
  const currentIndex = STEPS.findIndex((s) => s.status === order.status)

  const times: Record<string, string | null> = {
    pending: fmt(order.created_at),
    sent: fmt(order.sent_at),
  }

  return (
    <div className="px-4 py-4">
      <ol className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {STEPS.map((step, i) => {
          const reached = archived ? step.status !== 'sent' || !!order.sent_at : i <= currentIndex
          const current = !archived && i === currentIndex
          return (
            <li key={step.status} className="flex items-start gap-2.5">
              <span
                className={clsx(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-white',
                  reached ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white',
                  current && 'ring-4 ring-brand-100'
                )}
                aria-hidden="true"
              >
                {reached && <Check size={11} strokeWidth={3} />}
              </span>
              <div>
                <p className={clsx('text-sm font-medium', reached ? 'text-slate-900' : 'text-slate-400')}>
                  {step.label}
                  {current && <span className="sr-only"> (current)</span>}
                </p>
                {times[step.status] && <p className="text-xs text-slate-500">{times[step.status]}</p>}
              </div>
            </li>
          )
        })}
      </ol>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-xs text-slate-500">
        {order.due_at && (
          <div className="flex gap-1.5">
            <dt>Due</dt>
            <dd className="font-medium text-slate-700">{fmt(order.due_at)}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt>Last updated</dt>
          <dd className="font-medium text-slate-700">{fmt(order.updated_at)}</dd>
        </div>
        {archived && <p className="font-medium text-slate-600">This order is archived.</p>}
      </dl>
    </div>
  )
}
