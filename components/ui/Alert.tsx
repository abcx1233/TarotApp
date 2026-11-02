import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

type AlertVariant = 'danger' | 'warning' | 'info'

interface AlertProps {
  variant?: AlertVariant
  /** Show the leading icon. Defaults to true. */
  icon?: boolean
  size?: 'sm' | 'md'
  className?: string
  children: React.ReactNode
}

const variantClasses: Record<AlertVariant, string> = {
  danger: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

const icons = { danger: AlertCircle, warning: AlertTriangle, info: Info }

/**
 * Inline banner for errors and things that need attention. Danger and warning are
 * announced to screen readers immediately (role="alert"); info is a polite status.
 */
export function Alert({ variant = 'danger', icon = true, size = 'md', className, children }: AlertProps) {
  const Icon = icons[variant]
  return (
    <div
      role={variant === 'info' ? 'status' : 'alert'}
      className={twMerge(
        clsx(
          'flex items-start gap-2 rounded-lg border',
          size === 'sm' ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-sm',
          variantClasses[variant],
          className
        )
      )}
    >
      {icon && <Icon size={size === 'sm' ? 14 : 16} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
