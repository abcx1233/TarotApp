'use client'

import { Toggle } from '@/components/ui/Toggle'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'

interface AddOnsSectionProps {
  includeOracleCard: boolean
  oracleCardName: string
  includeEnergyCleansing: boolean
  energyCleansingNotes: string
  onToggleOracleCard: (v: boolean) => void
  onOracleCardNameChange: (v: string) => void
  onToggleEnergyCleansing: (v: boolean) => void
  onEnergyCleansingNotesChange: (v: string) => void
}

export function AddOnsSection({
  includeOracleCard,
  oracleCardName,
  includeEnergyCleansing,
  energyCleansingNotes,
  onToggleOracleCard,
  onOracleCardNameChange,
  onToggleEnergyCleansing,
  onEnergyCleansingNotesChange,
}: AddOnsSectionProps) {
  return (
    <div className="space-y-4">
      {/* Oracle Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Oracle Card</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Weave an oracle card's message naturally into the reading
            </p>
          </div>
          <Toggle
            checked={includeOracleCard}
            onChange={onToggleOracleCard}
          />
        </div>

        {includeOracleCard && (
          <div className="animate-fade-in">
            <Label htmlFor="oracle-card-name">Oracle Card Name</Label>
            <Input
              id="oracle-card-name"
              value={oracleCardName}
              onChange={(e) => onOracleCardNameChange(e.target.value)}
              placeholder="e.g. The River, Inner Child…"
            />
          </div>
        )}
      </div>

      {/* Energy Cleansing Ritual */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Energy Cleansing Ritual</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Include a personalised ritual suggestion at the end
            </p>
          </div>
          <Toggle
            checked={includeEnergyCleansing}
            onChange={onToggleEnergyCleansing}
          />
        </div>

        {includeEnergyCleansing && (
          <div className="animate-fade-in">
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
        )}
      </div>
    </div>
  )
}
