'use client'

import { Menu } from 'lucide-react'

interface TopBarProps {
  onMenuClick: () => void
  title?: string
}

export function TopBar({ onMenuClick, title }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4 lg:px-6 shrink-0">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>
      {title && (
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      )}
    </header>
  )
}
