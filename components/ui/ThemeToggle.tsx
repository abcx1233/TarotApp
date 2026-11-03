'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext'
import { clsx } from 'clsx'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setPreference(value)}
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            preference === value ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
