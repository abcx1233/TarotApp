import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        padding && 'p-5',
        className
      )}
    >
      {children}
    </div>
  )
}

interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  accent?: boolean
}

export function KPICard({ label, value, sub, icon, accent }: KPICardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border bg-white p-5 shadow-sm',
        accent ? 'border-brand-200 bg-brand-50' : 'border-slate-200'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p
            className={clsx(
              'mt-1.5 text-2xl font-bold',
              accent ? 'text-brand-700' : 'text-slate-900'
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        {icon && (
          <div
            className={clsx(
              'rounded-lg p-2',
              accent ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
