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
  isSameMonth,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Save,
  CheckCircle2,
  X,
  AlertCircle,
  CalendarCheck,
  Trash2,
  Ban,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { createClient } from '@/lib/supabase/client'
import { todayDateString } from '@/lib/daily-message/dates'
import type { DailyMessage } from '@/types'

function cellClasses(row: DailyMessage | undefined, locked: boolean): string {
  if (row?.skipped) {
    return locked
      ? 'bg-slate-100 text-slate-300 border-dashed border-slate-200'
      : 'bg-slate-100 text-slate-400 border-dashed border-slate-300 hover:bg-slate-200/60'
  }
  if (locked) {
    return row
      ? 'bg-slate-100 text-slate-400 border-slate-200'
      : 'bg-slate-50 text-slate-300 border-transparent'
  }
  if (!row) return 'bg-white text-slate-700 hover:bg-slate-50 border-transparent'
  if (row.approved) return 'bg-green-50 text-green-800 hover:bg-green-100 border-green-200'
  return 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
}

export function CalendarView() {
  const todayStr = useMemo(() => todayDateString(), [])
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [rows, setRows] = useState<Record<string, DailyMessage>>({})
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalText, setModalText] = useState('')
  const [modalError, setModalError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const [isUnskipping, setIsUnskipping] = useState(false)

  const [batchLoading, setBatchLoading] = useState(false)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [approveAllLoading, setApproveAllLoading] = useState(false)
  const [deletePendingLoading, setDeletePendingLoading] = useState(false)
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadMonth = useCallback(async (m: Date) => {
    setLoading(true)
    const supabase = createClient()
    const start = format(startOfMonth(m), 'yyyy-MM-dd')
    const end = format(endOfMonth(m), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('daily_messages')
      .select('*')
      .gte('message_date', start)
      .lte('message_date', end)
      .is('deleted_at', null)

    if (error) {
      console.error('[calendar] Failed to load month:', error)
      setLoadError(`Failed to load ${format(m, 'MMMM yyyy')} — the calendar below may be incomplete or stale.`)
      setLoading(false)
      return
    }

    setLoadError(null)
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
  const selectedLocked = selectedDate ? selectedDate < todayStr : false

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

  function removeRow(dateStr: string) {
    setRows((prev) => {
      const next = { ...prev }
      delete next[dateStr]
      return next
    })
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
      if (data.skippedWrite || !data.dailyMessage) {
        setModalError('This date was deleted or skipped elsewhere while generating — the result was not saved.')
        await loadMonth(month)
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
      if (data.skippedWrite || !data.dailyMessage) {
        setModalError('This date was deleted or skipped elsewhere while regenerating — the result was not saved.')
        await loadMonth(month)
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

  async function handleDelete() {
    if (!selectedDate || !selectedRow) return

    const isTodayApproved = selectedDate === todayStr && selectedRow.approved
    const confirmMessage = isTodayApproved
      ? "This is today's approved message — deleting it means nothing will be ready to send today. Delete anyway?"
      : `Delete the message for ${format(new Date(`${selectedDate}T00:00:00`), 'd MMMM yyyy')}?`
    if (!window.confirm(confirmMessage)) return

    setModalError(null)
    setIsDeleting(true)
    try {
      const res = await fetch('/api/daily-message/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error || 'Failed to delete.')
        return
      }
      removeRow(selectedDate)
      closeModal()
    } catch {
      setModalError('Failed to delete. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSkip() {
    if (!selectedDate) return
    setModalError(null)
    setIsSkipping(true)
    try {
      const res = await fetch('/api/daily-message/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error || 'Failed to skip this day.')
        return
      }
      applyRowUpdate(data.dailyMessage)
    } catch {
      setModalError('Failed to skip this day. Please try again.')
    } finally {
      setIsSkipping(false)
    }
  }

  async function handleUnskip() {
    if (!selectedDate) return
    setModalError(null)
    setIsUnskipping(true)
    try {
      const res = await fetch('/api/daily-message/unskip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error || 'Failed to un-skip this day.')
        return
      }
      removeRow(selectedDate)
      closeModal()
    } catch {
      setModalError('Failed to un-skip this day. Please try again.')
    } finally {
      setIsUnskipping(false)
    }
  }

  async function handleGenerateNext30() {
    setBatchMessage(null)
    setBatchLoading(true)
    try {
      const res = await fetch('/api/daily-message/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: todayStr, days: 30 }),
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
      .filter((r) => !r.approved && !r.skipped && r.generated_text?.trim())
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

  async function handleDeleteAllPending() {
    if (!window.confirm('Delete every pending (unapproved) message from today onward? This can be undone from Trash.')) return

    setBatchMessage(null)
    setDeletePendingLoading(true)
    try {
      const res = await fetch('/api/daily-message/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'pending' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBatchMessage(data.error || 'Bulk delete failed.')
        return
      }
      setBatchMessage(`Deleted ${data.deleted} pending message${data.deleted === 1 ? '' : 's'}.`)
      await loadMonth(month)
    } catch {
      setBatchMessage('Bulk delete failed. Please try again.')
    } finally {
      setDeletePendingLoading(false)
    }
  }

  async function handleDeleteAllIncludingApproved() {
    setBatchMessage(null)
    setDeleteAllLoading(true)

    // Check today specifically, regardless of which month is currently
    // displayed — `rows` only holds the visible month, and this action is
    // never scoped to it.
    let todayWarning = ''
    try {
      const supabase = createClient()
      const { data: todayRow } = await supabase
        .from('daily_messages')
        .select('approved')
        .eq('message_date', todayStr)
        .is('deleted_at', null)
        .maybeSingle()

      if (todayRow?.approved) {
        todayWarning =
          "\n\nThis includes TODAY's message, which is already approved and ready to send. Deleting it means nothing will be ready to send today."
      } else if (todayRow) {
        todayWarning = "\n\nThis includes today's message (not yet approved)."
      }
    } catch {
      // If the check itself fails, fall through with the generic warning
      // rather than blocking the action entirely.
    }

    const typed = window.prompt(
      `This deletes every message from today onward, including ones already approved and ready to send. This cannot be undone lightly (though it can be restored from Trash).${todayWarning}\n\nType DELETE to confirm.`
    )
    if (typed?.trim().toUpperCase() !== 'DELETE') {
      setDeleteAllLoading(false)
      return
    }

    try {
      const res = await fetch('/api/daily-message/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBatchMessage(data.error || 'Bulk delete failed.')
        return
      }
      setBatchMessage(`Deleted ${data.deleted} message${data.deleted === 1 ? '' : 's'} (including approved).`)
      await loadMonth(month)
    } catch {
      setBatchMessage('Bulk delete failed. Please try again.')
    } finally {
      setDeleteAllLoading(false)
    }
  }

  const pendingCount = Object.values(rows).filter((r) => !r.approved && !r.skipped && r.generated_text?.trim()).length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-0">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Daily Message Calendar</h1>
            <p className="mt-0.5 text-sm text-slate-500">Generate and approve messages in advance.</p>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
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
            <Button
              onClick={handleDeleteAllPending}
              loading={deletePendingLoading}
              variant="outline"
              size="sm"
            >
              <Trash2 size={14} />
              Delete all pending
            </Button>
            <Button
              onClick={handleDeleteAllIncludingApproved}
              loading={deleteAllLoading}
              variant="danger"
              size="sm"
            >
              <Trash2 size={14} />
              Delete all including approved
            </Button>
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
                const locked = dateStr < todayStr
                const isTodayCell = dateStr === todayStr
                const atRisk = isTodayCell && (!row || (!row.approved && !row.skipped))
                const clickable = !!row || !locked
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={!clickable}
                    onClick={() => openDay(dateStr, row, clickable)}
                    className={`relative flex min-h-[64px] flex-col items-start gap-1 border bg-white p-2 text-left text-xs transition-colors ${
                      clickable ? 'cursor-pointer' : 'cursor-default'
                    } ${cellClasses(row, locked)} ${
                      atRisk
                        ? 'ring-2 ring-inset ring-red-400'
                        : isTodayCell
                          ? 'ring-2 ring-inset ring-brand-400'
                          : 'border-transparent'
                    }`}
                  >
                    {atRisk && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />}
                    <span className={`text-sm font-medium ${isSameMonth(d, month) ? '' : 'text-slate-300'}`}>
                      {format(d, 'd')}
                    </span>
                    {row?.skipped ? (
                      <span className="flex items-center gap-1 text-[10px] leading-tight">
                        <Ban size={10} />
                        Skipped
                      </span>
                    ) : row ? (
                      <span className="line-clamp-2 text-[10px] leading-tight">{row.card_name}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-200" /> Generated</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-200" /> Approved</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white border border-slate-300" /> Empty</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400 bg-slate-100" /> Skipped</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-200" /> Locked (past)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Today needs action</span>
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
                {selectedRow && !selectedRow.skipped && (
                  <p className="text-xs text-slate-500">
                    {selectedRow.card_name}
                    {selectedRow.card_orientation === 'reversed' ? ' (Reversed)' : ''}
                  </p>
                )}
                {selectedLocked && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                    <AlertTriangle size={11} />
                    Past date — locked, read-only
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

              {selectedRow?.skipped ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Ban size={22} className="text-slate-400" />
                  <p className="mt-2 text-sm text-slate-500">This day is marked as skipped.</p>
                  {!selectedLocked && (
                    <Button className="mt-3" size="sm" variant="outline" onClick={handleUnskip} loading={isUnskipping}>
                      Un-skip
                    </Button>
                  )}
                </div>
              ) : selectedLocked ? (
                selectedRow ? (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {selectedRow.final_text ?? selectedRow.generated_text}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-slate-400">No message was generated for this date.</p>
                )
              ) : selectedRow ? (
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
                    <Button variant="danger" size="sm" onClick={handleDelete} loading={isDeleting}>
                      <Trash2 size={13} />
                      Delete
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <p className="text-sm text-slate-500">No message for this day yet.</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button size="sm" onClick={handleGenerateForEmptyDay} loading={isGenerating}>
                      <Sparkles size={13} />
                      Generate for this day
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSkip} loading={isSkipping}>
                      <Ban size={13} />
                      Skip this day
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
