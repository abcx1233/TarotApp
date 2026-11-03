'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, ChevronRight } from 'lucide-react'
import { breadcrumbsFor } from '@/lib/nav'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface TopBarProps {
  onMenuClick: () => void
  onOpenPalette: () => void
  title?: string
}

export function TopBar({ onMenuClick, onOpenPalette, title }: TopBarProps) {
  const pathname = usePathname()
  const crumbs = breadcrumbsFor(pathname)

  return (
    <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6 shrink-0">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {title ? (
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      ) : (
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1 text-sm text-slate-500">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight size={13} className="shrink-0 text-slate-300" aria-hidden="true" />}
                {c.href ? (
                  <Link href={c.href} className="truncate hover:text-slate-900">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={i === crumbs.length - 1 ? 'page' : undefined} className="truncate font-medium text-slate-900">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500 hover:border-slate-300 hover:text-slate-700 sm:flex"
          aria-label="Open command palette"
        >
          <Search size={13} aria-hidden="true" />
          Search
          <kbd className="rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-400">⌘K</kbd>
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
}
