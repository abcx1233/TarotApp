import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

type BadgeVariant =
  | 'default'
  | 'pending'
  | 'in_progress'
  | 'awaiting_review'
  | 'sent'
  | 'archived'
  | 'rush'
  | 'success'
  | 'warning'
  | 'danger'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  awaiting_review: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
  sent: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  archived: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200',
  rush: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  success: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  awaiting_review: 'Awaiting Review',
  sent: 'Sent',
  archived: 'Archived',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const variant = (status as BadgeVariant) || 'default'
  return <Badge variant={variant}>{STATUS_LABELS[status] ?? status}</Badge>
}
