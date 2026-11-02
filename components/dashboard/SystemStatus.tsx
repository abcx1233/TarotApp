'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

type Level = 'ok' | 'warn' | 'error'
interface Check {
  id: string
  label: string
  level: Level
  detail: string
}
interface Health {
  status: Level
  checks: Check[]
  checkedAt: string
}

const ICON = {
  ok: <CheckCircle2 size={15} className="shrink-0 text-green-600" aria-hidden="true" />,
  warn: <AlertTriangle size={15} className="shrink-0 text-amber-600" aria-hidden="true" />,
  error: <XCircle size={15} className="shrink-0 text-red-600" aria-hidden="true" />,
}
const SUMMARY: Record<Level, string> = {
  ok: 'All systems working',
  warn: 'Some things need attention',
  error: 'Something is broken',
}

export function SystemStatus() {
  const [health, setHealth] = useState<Health | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as Health
      setHealth(data)
      setFailed(false)
      // Open by default only when something is wrong.
      setOpen((prev) => prev || data.status !== 'ok')
    } catch {
      setFailed(true)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!health && !failed) return null

  const level: Level = failed ? 'error' : health!.status
  return (
    <section aria-label="System status" className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {ICON[level]}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex-1 text-left text-sm font-medium text-slate-800"
        >
          {failed ? 'Could not check system status' : SUMMARY[level]}
        </button>
        {health && (
          <span className="hidden text-xs text-slate-400 sm:inline">
            Checked {formatDistanceToNow(new Date(health.checkedAt), { addSuffix: true })}
          </span>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          aria-label="Re-check system status"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin')} />
        </button>
      </div>
      {open && health && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {health.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
              {ICON[c.level]}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{c.label}</p>
                <p className="text-xs text-slate-500">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
