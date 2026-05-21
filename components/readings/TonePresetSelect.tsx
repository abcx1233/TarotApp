'use client'

import { Label } from '@/components/ui/Label'
import type { TonePreset } from '@/types'
import { clsx } from 'clsx'

interface TonePresetSelectProps {
  presets: TonePreset[]
  value: string
  onChange: (id: string, preset: TonePreset) => void
}

export function TonePresetSelect({ presets, value, onChange }: TonePresetSelectProps) {
  return (
    <div>
      <Label>Tone preset</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id, preset)}
            className={clsx(
              'rounded-lg border p-3 text-left transition-all text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              value === preset.id
                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <p className="font-medium text-slate-900 text-xs">{preset.name}</p>
            {preset.description && (
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{preset.description}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
