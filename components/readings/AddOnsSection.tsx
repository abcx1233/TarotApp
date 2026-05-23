'use client'

import { Toggle } from '@/components/ui/Toggle'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'

interface AddOnsSectionProps {
  includeOracleCard: boolean
  oracleCardName: string
  includeEnergyCleansing: boolean
  onToggleOracleCard: (v: boolean) => void
  onOracleCardNameChange: (v: string) => void
  onToggleEnergyCleansing: (v: boolean) => void
}

function AddonRow({
  title,
  description,
  price,
  checked,
  onChange,
  children,
}: {
  title: string
  description: string
  price: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{title}</p>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              +£{price}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      {checked && children && (
        <div className="animate-fade-in">{children}</div>
      )}
    </div>
  )
}

export function AddOnsSection({
  includeOracleCard,
  oracleCardName,
  includeEnergyCleansing,
  onToggleOracleCard,
  onOracleCardNameChange,
  onToggleEnergyCleansing,
}: AddOnsSectionProps) {
  return (
    <div className="space-y-3">
      <AddonRow
        title="Oracle Card"
        description="Weave an oracle card's message naturally into the reading"
        price="10"
        checked={includeOracleCard}
        onChange={onToggleOracleCard}
      >
        <div>
          <Label htmlFor="oracle-card-name">Oracle card name</Label>
          <Input
            id="oracle-card-name"
            type="text"
            value={oracleCardName}
            onChange={(e) => onOracleCardNameChange(e.target.value)}
            placeholder="e.g. The Moon, Awakening, Trust..."
          />
        </div>
      </AddonRow>

      <AddonRow
        title="Energy Cleansing Ritual"
        description="Include a personalised ritual suggestion at the end"
        price="8"
        checked={includeEnergyCleansing}
        onChange={(v) => { console.log('includeEnergyCleansing:', v); onToggleEnergyCleansing(v) }}
      />
    </div>
  )
}
