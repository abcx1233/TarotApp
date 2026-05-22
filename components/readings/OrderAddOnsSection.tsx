'use client'

import { Toggle } from '@/components/ui/Toggle'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'

interface OrderAddOnsSectionProps {
  includeExtraQuestion: boolean
  extraQuestionText: string
  includeFollowUp: boolean
  isRush: boolean
  onToggleExtraQuestion: (v: boolean) => void
  onExtraQuestionTextChange: (v: string) => void
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

export function OrderAddOnsSection({
  includeExtraQuestion,
  extraQuestionText,
  includeFollowUp,
  isRush,
  onToggleExtraQuestion,
  onExtraQuestionTextChange,
  onToggleFollowUp,
  onToggleRush,
}: OrderAddOnsSectionProps) {
  return (
    <div className="space-y-3">
      <AddonRow
        title="Extra Question"
        description="Address an additional specific question within the reading"
        price="6"
        checked={includeExtraQuestion}
        onChange={onToggleExtraQuestion}
      >
        <div>
          <Label htmlFor="extra-question-text">What is the extra question?</Label>
          <Textarea
            id="extra-question-text"
            value={extraQuestionText}
            onChange={(e) => onExtraQuestionTextChange(e.target.value)}
            placeholder="Enter the client's additional question..."
            rows={2}
          />
        </div>
      </AddonRow>

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
