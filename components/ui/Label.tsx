import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn('block text-xs font-medium text-slate-700 mb-1', className)}
        {...props}
      >
        {children}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
    )
  }
)

Label.displayName = 'Label'
