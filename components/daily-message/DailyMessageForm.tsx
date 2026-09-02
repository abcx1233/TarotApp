'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle, Shuffle, Moon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Toggle } from '@/components/ui/Toggle'
import { Badge } from '@/components/ui/Badge'
import { TAROT_CARDS, drawRandomCard } from '@/data/tarot-cards'
import type { DailyMessage, CardOrientation } from '@/types'

interface DailyMessageFormProps {
  initialTodayMessage: DailyMessage | null
  initialHistory: DailyMessage[]
}

function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function DailyMessageForm({ initialTodayMessage, initialHistory }: DailyMessageFormProps) {
  const [cardName, setCardName] = useState(initialTodayMessage?.card_name ?? '')
  const [orientation, setOrientation] = useState<CardOrientation>(
    initialTodayMessage?.card_orientation ?? 'upright'
  )
  const [messageText, setMessageText] = useState(
    initialTodayMessage?.final_text ?? initialTodayMessage?.generated_text ?? ''
  )
  const [approved, setApproved] = useState(initialTodayMessage?.approved ?? false)
  const [history, setHistory] = useState(initialHistory)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvedJustNow, setApprovedJustNow] = useState(false)

  const excludeNames = useMemo(() => history.map((h) => h.card_name), [history])
  const today = useMemo(() => new Date(), [])

  function handleDraw() {
    setError(null)
    const { card, orientation: drawnOrientation } = drawRandomCard(excludeNames)
    setCardName(card.name)
    setOrientation(drawnOrientation)
  }

  async function handleGenerate() {
    if (!cardName.trim()) {
      setError('Pick or draw a card first.')
      return
    }
    setError(null)
    setApprovedJustNow(false)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/daily-message/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardName: cardName.trim(), orientation }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to generate the message.')
        return
      }
      setMessageText(data.dailyMessage.generated_text ?? '')
      setApproved(false)
      updateHistoryWith(data.dailyMessage)
    } catch {
      setError('Failed to generate the message. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleApprove() {
    if (!messageText.trim()) {
      setError('There is no message text to approve.')
      return
    }
    setError(null)
    setIsApproving(true)
    try {
      const res = await fetch('/api/daily-message/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalText: messageText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to approve the message.')
        return
      }
      setApproved(true)
      setApprovedJustNow(true)
      updateHistoryWith(data.dailyMessage)
    } catch {
      setError('Failed to approve the message. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  function updateHistoryWith(row: DailyMessage) {
    setHistory((prev) => {
      const withoutToday = prev.filter((h) => h.message_date !== row.message_date)
      return [row, ...withoutToday]
        .sort((a, b) => (a.message_date < b.message_date ? 1 : -1))
        .slice(0, 7)
    })
  }

  const words = wordCount(messageText)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-0">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Daily Card Message</h1>
          <p className="mt-0.5 text-sm text-slate-500">{format(today, 'EEEE d MMMM yyyy')}</p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Card</h2>
            <button
              type="button"
              onClick={handleDraw}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              <Shuffle size={13} />
              Draw a card
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="card-select">Card</Label>
              <Select
                id="card-select"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              >
                <option value="">Select a card</option>
                {TAROT_CARDS.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <Toggle
                checked={orientation === 'reversed'}
                onChange={(checked) => setOrientation(checked ? 'reversed' : 'upright')}
                label="Reversed"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleGenerate} loading={isGenerating} disabled={!cardName.trim()}>
              {messageText ? <RefreshCw size={15} /> : <Sparkles size={15} />}
              {messageText ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </Card>

        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Message</h2>
            {approved && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <CheckCircle2 size={13} />
                Approved
              </span>
            )}
          </div>

          {messageText ? (
            <>
              <Textarea
                className="mt-3 min-h-[280px] font-normal leading-relaxed"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value)
                  setApproved(false)
                  setApprovedJustNow(false)
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-400">{words} words</p>
                <Button onClick={handleApprove} loading={isApproving} variant="primary">
                  <CheckCircle2 size={15} />
                  Approve &amp; Save
                </Button>
              </div>
              {approvedJustNow && (
                <p className="mt-2 text-xs font-medium text-green-700">
                  Saved — today&apos;s message is live for the Shortcut to fetch.
                </p>
              )}
            </>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-slate-100 p-4">
                <Moon size={26} className="text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No message yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Draw or select a card, then generate today&apos;s message.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Last 7 days</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">No messages yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {history.map((h) => (
                <li key={h.message_date} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {format(new Date(`${h.message_date}T00:00:00`), 'EEE d MMM')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {h.card_name}
                      {h.card_orientation === 'reversed' ? ' (Reversed)' : ''}
                    </p>
                  </div>
                  <Badge variant={h.approved ? 'success' : 'default'}>
                    {h.approved ? 'Approved' : 'Draft'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
