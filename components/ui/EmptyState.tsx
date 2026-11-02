import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const buttonClass =
    'mt-4 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700'
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={20} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>}
      {action?.href && (
        <Link href={action.href} className={buttonClass}>
          {action.label}
        </Link>
      )}
      {action?.onClick && !action.href && (
        <button type="button" onClick={action.onClick} className={buttonClass}>
          {action.label}
        </button>
      )}
    </div>
  )
}
