import {
  LayoutDashboard,
  Sparkles,
  ListOrdered,
  Users,
  Clock,
  FileText,
  Settings,
  Trash2,
  Moon,
  Activity,
  type LucideIcon,
} from 'lucide-react'

export interface NavDef {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  /** Second key of the "g then <key>" go-to shortcut. */
  shortcut?: string
}

// Grouped like the Supabase dashboard: a hairline between groups when the rail is
// collapsed, and a small section label once it expands.
export const NAV_GROUPS: { label: string; items: NavDef[] }[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true, shortcut: 'd' }],
  },
  {
    label: 'Create',
    items: [
      { href: '/dashboard/readings/new', label: 'New Reading', icon: Sparkles, shortcut: 'n' },
      { href: '/dashboard/daily-message', label: 'Daily Card Message', icon: Moon, shortcut: 'm' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/dashboard/orders', label: 'Orders', icon: ListOrdered, shortcut: 'o' },
      { href: '/dashboard/clients', label: 'Clients', icon: Users, shortcut: 'c' },
      { href: '/dashboard/history', label: 'History', icon: Clock, shortcut: 'h' },
      { href: '/dashboard/activity', label: 'Activity', icon: Activity, shortcut: 'a' },
      { href: '/dashboard/templates', label: 'Templates', icon: FileText, shortcut: 't' },
    ],
  },
]

export const TRASH_ITEM: NavDef = { href: '/dashboard/trash', label: 'Trash', icon: Trash2, shortcut: 'x' }
export const BOTTOM_ITEMS: NavDef[] = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, shortcut: 's' },
]

export const ALL_NAV: NavDef[] = [...NAV_GROUPS.flatMap((g) => g.items), TRASH_ITEM, ...BOTTOM_ITEMS]

/** Breadcrumb trail for a dashboard path, e.g. /dashboard/readings/new → Dashboard › New Reading. */
export function breadcrumbsFor(pathname: string): { label: string; href?: string }[] {
  if (pathname === '/dashboard') return [{ label: 'Dashboard' }]
  const crumbs: { label: string; href?: string }[] = [{ label: 'Dashboard', href: '/dashboard' }]
  const match = [...ALL_NAV]
    .filter((n) => n.href !== '/dashboard' && pathname.startsWith(n.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  if (match) {
    const rest = pathname.slice(match.href.length).split('/').filter(Boolean)
    crumbs.push({ label: match.label, href: rest.length ? match.href : undefined })
    if (rest.length) crumbs.push({ label: rest[0] === 'calendar' ? 'Calendar' : 'Details' })
  } else if (pathname.startsWith('/dashboard/readings')) {
    crumbs.push({ label: 'Readings' })
  }
  return crumbs
}
