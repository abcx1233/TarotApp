import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400',
          'transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          'resize-y min-h-[80px]',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'
