'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  getDay,
  isBefore,
  isToday,
  isSameMonth,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Save, CheckCircle2, X, AlertCircle, CalendarCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { createClient } from '@/lib/supabase/client'
import type { DailyMessage } from '@/types'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function statusClasses(row: DailyMessage | undefined, isPast: boolean): string {
  if (!row) return isPast ? 'bg-slate-50 text-slate-300' : 'bg-white text-slate-700 hover:bg-slate-50'
  if (row.approved) return 'bg-green-50 text-green-800 hover:bg-green-100 border-green-200'
  return 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
}

export function CalendarView() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [rows, setRows] = useState<Record<string, DailyMessage>>({})
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalText, setModalText] = useState('')
  const [modalError, setModalError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  const [batchLoading, setBatchLoading] = useState(false)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [approveAllLoading, setApproveAllLoading] = useState(false)

  const loadMonth = useCallback(async (m: Date) => {
    setLoading(true)
    const supabase = createClient()
    const start = format(startOfMonth(m), 'yyyy-MM-dd')
    const end = format(endOfMonth(m), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('daily_messages')
      .select('*')
      .gte('message_date', start)
      .lte('message_date', end)

    const map: Record<string, DailyMessage> = {}
    for (const row of (data ?? []) as DailyMessage[]) {
      map[row.message_date] = row
    }
    setRows(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMonth(month)
  }, [month, loadMonth])

  const gridDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const days = eachDayOfInterval({ start, end })
    // Monday-first leading blanks
    const leading = (getDay(start) + 6) % 7
    return { leading, days }
  }, [month])

  const selectedRow = selectedDate ? rows[selectedDate] : undefined

  function openDay(dateStr: string, row: DailyMessage | undefined, clickable: boolean) {
    if (!clickable) return
    setSelectedDate(dateStr)
    setModalText(row?.final_text ?? row?.generated_text ?? '')
    setModalError(null)
  }

  function closeModal() {
    setSelectedDate(null)
    setModalText('')
    setModalError(null)
  }

  function applyRowUpdate(row: DailyMessage) {
    setRows((prev) => ({ ...prev, [row.message_date]: row }))
  }

  async function handleGenerateForEmptyDay() {
    if (!selectedDate) return
    setModalError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/daily-message/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error || 'Failed to generate.')
        return
      }
      applyRowUpdate(data.dailyMessage)
      setModalText(data.dailyMessage.generated_text ?? '')
    } catch {
      setModalError('Failed to generate. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!selectedDate || !selectedRow) return
    setModalError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/daily-message/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          cardName: selectedRow.card_name,
          orientation: selectedRow.card_orientation,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error || 'Failed to regenerate.')
        return
      }
      applyRowUpdate(data.dailyMessage)
      setModalText(data.dailyMessage.generated_text ?? '')
    } catch {
      setModalError('Failed to regenerate. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSaveEdit() {
    if (!selectedDate || !modalText.trim()) return
    setModalError(null)
    setIsSaving(true)
    try {
      const res = await fetch('/api/daily-message/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, text: modalText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error || 'Failed to save.')
        return
      }
      applyRowUpdate(data.dailyMessage)
    } catch {
      setModalError('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleApprove() {
    if (!selectedDate || !modalText.trim()) return
    setModalError(null)
    setIsApproving(true)
    try {
      const res = await fetch('/api/daily-message/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, finalText: modalText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error || 'Failed to approve.')
        return
      }
      applyRowUpdate(data.dailyMessage)
    } catch {
      setModalError('Failed to approve. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  async function handleGenerateNext30() {
    setBatchMessage(null)
    setBatchLoading(true)
    try {
      const res = await fetch('/api/daily-message/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: todayDateString(), days: 30 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBatchMessage(data.error || 'Batch generation failed.')
        return
      }
      setBatchMessage(`Generated ${data.generated}, skipped ${data.skipped}, failed ${data.failed}.`)
      await loadMonth(month)
    } catch {
      setBatchMessage('Batch generation failed. Please try again.')
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleApproveAllPending() {
    const pendingDates = Object.values(rows)
      .filter((r) => !r.approved && r.generated_text?.trim())
      .map((r) => r.message_date)

    if (pendingDates.length === 0) return
    const confirmed = window.confirm(
      `Approve ${pendingDates.length} pending message${pendingDates.length === 1 ? '' : 's'} for ${format(month, 'MMMM yyyy')} as-is?`
    )
    if (!confirmed) return

    setBatchMessage(null)
    setApproveAllLoading(true)
    try {
      const res = await fetch('/api/daily-message/approve-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: pendingDates }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBatchMessage(data.error || 'Bulk approve failed.')
        return
      }
      setBatchMessage(`Approved ${data.approved}.`)
      await loadMonth(month)
    } catch {
      setBatchMessage('Bulk approve failed. Please try again.')
    } finally {
      setApproveAllLoading(false)
    }
  }

  const pendingCount = Object.values(rows).filter((r) => !r.approved && r.generated_text?.trim()).length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-0">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Daily Message Calendar</h1>
            <p className="mt-0.5 text-sm text-slate-500">Generate and approve messages in advance.</p>
          </div>
        </div>

        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerateNext30} loading={batchLoading} size="sm">
                <Sparkles size={14} />
                Generate next 30 days
              </Button>
              <Button
                onClick={handleApproveAllPending}
                loading={approveAllLoading}
                disabled={pendingCount === 0}
                variant="outline"
                size="sm"
              >
                <CalendarCheck size={14} />
                Approve all pending{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Button>
            </div>
          </div>
          {batchMessage && <p className="mt-2 text-xs text-slate-500">{batchMessage}</p>}
        </Card>

        <Card padding={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-slate-900">{format(month, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-slate-100 p-px">
              {Array.from({ length: gridDays.leading }).map((_, i) => (
                <div key={`blank-${i}`} className="bg-white" />
              ))}
              {gridDays.days.map((d) => {
                const dateStr = format(d, 'yyyy-MM-dd')
                const row = rows[dateStr]
                const past = isBefore(d, new Date(new Date().toDateString())) && !isToday(d)
                const clickable = !!row || !past
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={!clickable}
                    onClick={() => openDay(dateStr, row, clickable)}
                    className={`flex min-h-[64px] flex-col items-start gap-1 border bg-white p-2 text-left text-xs transition-colors ${
                      clickable ? 'cursor-pointer' : 'cursor-default'
                    } ${statusClasses(row, past)} ${isToday(d) ? 'ring-2 ring-inset ring-brand-400' : 'border-transparent'}`}
                  >
                    <span className={`text-sm font-medium ${isSameMonth(d, month) ? '' : 'text-slate-300'}`}>
                      {format(d, 'd')}
                    </span>
                    {row && (
                      <span className="line-clamp-2 text-[10px] leading-tight">
                        {row.card_name}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-200" /> Generated</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-200" /> Approved</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-100" /> Empty</span>
        </div>
      </div>

      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={closeModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">{format(new Date(`${selectedDate}T00:00:00`), 'EEEE d MMMM yyyy')}</p>
                {selectedRow && (
                  <p className="text-xs text-slate-500">
                    {selectedRow.card_name}
                    {selectedRow.card_orientation === 'reversed' ? ' (Reversed)' : ''}
                  </p>
                )}
              </div>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              {modalError && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {selectedRow ? (
                <>
                  {selectedRow.approved && (
                    <span className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 size={12} />
                      Approved
                    </span>
                  )}
                  <Textarea
                    className="min-h-[240px] leading-relaxed"
                    value={modalText}
                    onChange={(e) => setModalText(e.target.value)}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleRegenerate} loading={isGenerating}>
                      <RefreshCw size={13} />
                      Regenerate
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleSaveEdit} loading={isSaving}>
                      <Save size={13} />
                      Save edit
                    </Button>
                    <Button size="sm" onClick={handleApprove} loading={isApproving}>
                      <CheckCircle2 size={13} />
                      Approve
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <p className="text-sm text-slate-500">No message for this day yet.</p>
                  <Button className="mt-3" size="sm" onClick={handleGenerateForEmptyDay} loading={isGenerating}>
                    <Sparkles size={13} />
                    Generate for this day
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
