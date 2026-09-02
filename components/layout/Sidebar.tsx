'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Sparkles,
  ListOrdered,
  Users,
  Clock,
  FileText,
  Settings,
  LogOut,
  Trash2,
  Moon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/readings/new', label: 'New Reading', icon: Sparkles },
  { href: '/dashboard/daily-message', label: 'Daily Card Message', icon: Moon },
  { href: '/dashboard/orders', label: 'Orders', icon: ListOrdered },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/history', label: 'History', icon: Clock },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText },
]

const BOTTOM_ITEMS = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

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

  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        'flex items-center justify-center lg:justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
        isActive
          ? 'bg-white/10 text-white'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      )}
    >
      <Icon size={17} className="shrink-0" />
      <span className="hidden lg:flex flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="hidden lg:inline rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
          {badge}
        </span>
      )}
    </Link>
  )
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
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
    <div className="flex h-full flex-col bg-navy px-3 py-4">
      {/* Brand */}
      <div className="mb-6 px-3 hidden lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Deep Blue Divination
        </p>
        <h1 className="mt-0.5 text-base font-semibold text-white">Reader Console</h1>
      </div>
      <div className="mb-6 lg:hidden flex justify-center">
        <div className="h-7 w-7 rounded-md bg-white/10" />
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} onClick={onClose} />
        ))}
        <NavItem
          href="/dashboard/trash"
          label="Trash"
          icon={Trash2}
          onClick={onClose}
          badge={trashCount}
        />
      </nav>

      {/* Bottom nav */}
      <div className="mt-auto flex flex-col gap-0.5">
        <div className="mb-1 h-px bg-white/10" />
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} onClick={onClose} />
        ))}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center lg:justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white min-h-[44px]"
        >
          <LogOut size={17} className="shrink-0" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </div>
  )
}
