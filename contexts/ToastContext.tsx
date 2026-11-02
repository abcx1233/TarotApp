'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

type ToastTone = 'success' | 'error' | 'info'

export interface ToastInput {
  message: string
  tone?: ToastTone
  /** Optional inline action, e.g. Undo. Runs once, then the toast closes. */
  action?: { label: string; onClick: () => void | Promise<void> }
  /** Milliseconds before auto-dismiss. Defaults to 5s, or 8s when there is an action. */
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
}

interface ToastContextValue {
  toast: (t: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const toneStyles: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-white text-slate-800',
  error: 'border-red-200 bg-white text-slate-800',
  info: 'border-slate-200 bg-white text-slate-800',
}
const toneIcon = {
  success: <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />,
  error: <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />,
  info: <Info size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++
      setItems((prev) => [...prev.slice(-3), { ...t, id }])
      const ms = t.duration ?? (t.action ? 8000 : 5000)
      timers.current.set(id, setTimeout(() => dismiss(id), ms))
    },
    [dismiss]
  )

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((timer) => clearTimeout(timer))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((t) => {
          const tone = t.tone ?? 'info'
          return (
            <div
              key={t.id}
              role={tone === 'error' ? 'alert' : 'status'}
              className={clsx(
                'pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-lg animate-fade-in',
                toneStyles[tone]
              )}
            >
              {toneIcon[tone]}
              <p className="min-w-0 flex-1 break-words">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  onClick={async () => {
                    dismiss(t.id)
                    await t.action!.onClick()
                  }}
                  className="shrink-0 rounded px-1.5 py-0.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
