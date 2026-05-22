'use client'

import { Toggle } from '@/components/ui/Toggle'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { CardAutocomplete } from './CardAutocomplete'

interface AddOnsSectionProps {
  includeOracleCard: boolean
  oracleCardName: string
  includeEnergyCleansing: boolean
  energyCleansingNotes: string
  includeExtraQuestion: boolean
  includeFollowUp: boolean
  isRush: boolean
  onToggleOracleCard: (v: boolean) => void
  onOracleCardNameChange: (v: string) => void
  onToggleEnergyCleansing: (v: boolean) => void
  onEnergyCleansingNotesChange: (v: string) => void
  onToggleExtraQuestion: (v: boolean) => void
  onToggleFollowUp: (v: boolean) => void
  onToggleRush: (v: boolean) => void
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
  energyCleansingNotes,
  includeExtraQuestion,
  includeFollowUp,
  isRush,
  onToggleOracleCard,
  onOracleCardNameChange,
  onToggleEnergyCleansing,
  onEnergyCleansingNotesChange,
  onToggleExtraQuestion,
  onToggleFollowUp,
  onToggleRush,
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
          <Label htmlFor="oracle-card-name">Oracle Card Name</Label>
          <CardAutocomplete
            id="oracle-card-name"
            value={oracleCardName}
            onChange={(v) => onOracleCardNameChange(v)}
            suitFilter="all"
            placeholder="e.g. The River, Inner Child…"
          />
        </div>
      </AddonRow>

      <AddonRow
        title="Energy Cleansing Ritual"
        description="Include a personalised ritual suggestion at the end"
        price="8"
        checked={includeEnergyCleansing}
        onChange={onToggleEnergyCleansing}
      >
        <div>
          <Label htmlFor="cleansing-notes">
            Ritual context{' '}
            <span className="font-normal text-slate-400">(optional — leave blank for auto)</span>
          </Label>
          <Textarea
            id="cleansing-notes"
            value={energyCleansingNotes}
            onChange={(e) => onEnergyCleansingNotesChange(e.target.value)}
            placeholder="Any specific details to inform the ritual suggestion…"
            rows={3}
          />
        </div>
      </AddonRow>

      <AddonRow
        title="Extra Question"
        description="Address an additional specific question within the reading"
        price="6"
        checked={includeExtraQuestion}
        onChange={onToggleExtraQuestion}
      />

      <AddonRow
        title="24-Hour Delivery"
        description="Rush order — prioritised and delivered within 24 hours"
        price="10"
        checked={isRush}
        onChange={onToggleRush}
      />

      <AddonRow
        title="Follow-Up Within 48 Hours"
        description="A brief follow-up response to one clarifying question"
        price="5"
        checked={includeFollowUp}
        onChange={onToggleFollowUp}
      />
    </div>
  )
}
