'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_NAV } from '@/lib/nav'

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

interface Props {
  onOpenPalette: () => void
}

/** Global shortcuts: ⌘/Ctrl+K palette, "g then key" go-to, "n" new reading, "?" help. */
export function KeyboardShortcuts({ onOpenPalette }: Props) {
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const pendingG = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function clearPending() {
      if (pendingG.current) clearTimeout(pendingG.current)
      pendingG.current = null
    }

    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenPalette()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      // A dialog (command palette, help) owns the keyboard while it's open.
      if (e.key !== 'Escape' && document.querySelector('[role="dialog"]')) return

      if (e.key === 'Escape') {
        setHelpOpen(false)
        return
      }
      if (pendingG.current) {
        const target = ALL_NAV.find((n) => n.shortcut === e.key.toLowerCase())
        clearPending()
        if (target) {
          e.preventDefault()
          router.push(target.href)
        }
        return
      }
      if (e.key === 'g') {
        pendingG.current = setTimeout(clearPending, 1200)
      } else if (e.key === 'n') {
        e.preventDefault()
        router.push('/dashboard/readings/new')
      } else if (e.key === '/') {
        e.preventDefault()
        onOpenPalette()
      } else if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearPending()
    }
  }, [router, onOpenPalette])

  if (!helpOpen) return null
  const rows: [string, string][] = [
    ['⌘ K  or  /', 'Open command palette'],
    ['N', 'New reading'],
    ['?', 'Show this help'],
    ...ALL_NAV.filter((n) => n.shortcut).map((n): [string, string] => [`G then ${n.shortcut!.toUpperCase()}`, `Go to ${n.label}`]),
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onMouseDown={() => setHelpOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Keyboard shortcuts</h2>
        <dl className="space-y-1.5">
          {rows.map(([keys, label]) => (
            <div key={keys + label} className="flex items-center justify-between text-sm">
              <dt className="text-slate-600">{label}</dt>
              <dd>
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
