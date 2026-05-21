'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

interface Tab {
  id: string
  label: string
  disabled?: boolean
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-0.5 rounded-lg bg-slate-100 p-1', className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            activeTab === tab.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
