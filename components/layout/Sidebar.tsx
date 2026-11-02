'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { NAV_GROUPS, BOTTOM_ITEMS, TRASH_ITEM } from '@/lib/nav'
import { LogOut, PanelLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// The rail is a fixed 56px; on md+ it expands over the page (no layout shift) while
// hovered or while anything inside has keyboard focus. Below md it's the mobile
// drawer, where labels are always visible. `group/sb` is set on the panel root.
const SHOW_ON_EXPAND =
  'md:opacity-0 md:group-hover/sb:opacity-100 md:group-focus-within/sb:opacity-100 md:group-data-[pinned=true]/sb:opacity-100 transition-opacity duration-150 motion-reduce:transition-none'

interface NavItemProps {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  onClick?: () => void
  badge?: number
}

function NavItem({ href, label, icon: Icon, exact, onClick, badge }: NavItemProps) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)
  const hasBadge = badge != null && badge > 0

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        'relative flex h-10 items-center gap-3 rounded-lg px-[11px] text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        isActive
          ? 'bg-white/10 text-white'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      )}
    >
      {isActive && (
        <span aria-hidden="true" className="absolute -left-2 top-2 bottom-2 w-0.5 rounded-r bg-brand-400" />
      )}
      <span className="relative shrink-0">
        <Icon size={18} />
        {/* Collapsed rail: a dot instead of the count */}
        {hasBadge && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-brand-400 md:block md:group-hover/sb:hidden md:group-focus-within/sb:hidden md:group-data-[pinned=true]/sb:hidden"
          />
        )}
      </span>
      <span className={clsx('flex-1 whitespace-nowrap', SHOW_ON_EXPAND)}>{label}</span>
      {hasBadge && (
        <span
          className={clsx(
            'rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300',
            SHOW_ON_EXPAND
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

interface SidebarProps {
  onClose?: () => void
  /** Desktop only: keep the rail expanded instead of expanding on hover. */
  pinned?: boolean
  onTogglePin?: () => void
}

export function Sidebar({ onClose, pinned = false, onTogglePin }: SidebarProps) {
  const router = useRouter()
  const [trashCount, setTrashCount] = useState(0)

  useEffect(() => {
    async function fetchTrashCount() {
      try {
        const supabase = createClient()
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

        const [{ count: c }, { count: o }, { count: r }] = await Promise.all([
          supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .not('deleted_at', 'is', null)
            .gte('deleted_at', cutoff),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .not('deleted_at', 'is', null)
            .gte('deleted_at', cutoff),
          supabase
            .from('readings')
            .select('*', { count: 'exact', head: true })
            .not('deleted_at', 'is', null)
            .gte('deleted_at', cutoff),
        ])

        setTrashCount((c ?? 0) + (o ?? 0) + (r ?? 0))
      } catch {
        // deleted_at column may not exist yet — fail silently
      }
    }

    fetchTrashCount()

    const handler = () => fetchTrashCount()
    window.addEventListener('trash-count-changed', handler)
    return () => window.removeEventListener('trash-count-changed', handler)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      data-pinned={pinned}
      data-sidebar
      className={clsx(
        'group/sb flex h-full w-full flex-col overflow-hidden bg-navy px-2 py-4',
        'md:absolute md:inset-y-0 md:left-0 md:w-14 md:hover:w-56 md:focus-within:w-56',
        'md:transition-[width] md:duration-150 md:ease-out motion-reduce:transition-none',
        'md:hover:shadow-[4px_0_24px_rgba(0,0,0,0.25)] md:focus-within:shadow-[4px_0_24px_rgba(0,0,0,0.25)]',
        'md:data-[pinned=true]:w-56 md:data-[pinned=true]:shadow-none'
      )}
    >
      {/* Brand */}
      <div className="mb-5 flex h-10 items-center gap-3 px-[7px]">
        <div
          aria-hidden="true"
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-brand-600 text-[11px] font-bold text-white"
        >
          RC
        </div>
        <div className={clsx('min-w-0 whitespace-nowrap', SHOW_ON_EXPAND)}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Deep Blue Divination
          </p>
          <h1 className="text-sm font-semibold leading-tight text-white">Reader Console</h1>
        </div>
      </div>

      {/* Main nav */}
      <nav aria-label="Main" className="flex flex-col">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label} className={clsx('flex flex-col gap-0.5', i > 0 && 'mt-2 border-t border-white/10 pt-2')}>
            <p
              className={clsx(
                'h-4 whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500',
                i === 0 && 'hidden',
                SHOW_ON_EXPAND
              )}
            >
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavItem key={item.href} {...item} onClick={onClose} />
            ))}
          </div>
        ))}
        <div className="mt-2 flex flex-col gap-0.5 border-t border-white/10 pt-2">
          <NavItem {...TRASH_ITEM} onClick={onClose} badge={trashCount} />
        </div>
      </nav>

      {/* Bottom nav */}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/10 pt-2">
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} onClick={onClose} />
        ))}
        {onTogglePin && (
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? 'Collapse sidebar' : 'Keep sidebar open'}
            className="hidden h-10 items-center gap-3 rounded-lg px-[11px] text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 md:flex"
          >
            <PanelLeft size={18} className="shrink-0" />
            <span className={clsx('whitespace-nowrap', SHOW_ON_EXPAND)}>
              {pinned ? 'Collapse sidebar' : 'Keep open'}
            </span>
          </button>
        )}
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="flex h-10 items-center gap-3 rounded-lg px-[11px] text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <LogOut size={18} className="shrink-0" />
          <span className={clsx('whitespace-nowrap', SHOW_ON_EXPAND)}>Sign out</span>
        </button>
      </div>
    </div>
  )
}
