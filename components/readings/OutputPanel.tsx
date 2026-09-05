'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInDays } from 'date-fns'
import {
  Copy, Check, RefreshCw, Loader2, MessageCircle, Mail, Sparkles,
  Upload, CheckCircle2, AlertCircle, Clock, Moon, ChevronRight, HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { AuditBand, AuditCheckStatus, AuditResult } from '@/lib/ai/audit/types'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

const TIER_LABELS: Record<string, string> = {
  mini: 'Mini',
  core: 'Core',
  premium: 'Premium',
  celtic_cross: 'Celtic Cross',
}

const STATUS_MESSAGES = [
  'Tuning into the energy…',
  'Reading the cards…',
  'Channelling the reading…',
  'Weaving the narrative…',
  'Almost ready…',
]

/**
 * Score bands and per-check statuses both reuse Badge's existing soft-fill
 * variants rather than introducing another palette. 'n-a' takes the plain
 * `default` badge — the documented ringless slate chip for "no status applies".
 */
const AUDIT_BAND_VARIANT: Record<AuditBand, 'success' | 'warning' | 'danger'> = {
  green: 'success',
  amber: 'warning',
  red: 'danger',
}

const CHECK_STATUS_VARIANT: Record<AuditCheckStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  pass: 'success',
  fail: 'danger',
  skipped: 'warning',
  'n-a': 'default',
}

const CHECK_STATUS_LABEL: Record<AuditCheckStatus, string> = {
  pass: 'Pass',
  fail: 'Fail',
  skipped: 'Not checked',
  'n-a': 'N/A',
}

/**
 * Collapsible audit checklist.
 *
 * Opens by default whenever there is something to look at — anything below the
 * green band, or an audit that could not finish. A clean reading stays folded
 * away so the panel is no busier than it was before.
 */
function AuditChecklist({ audit }: { audit: AuditResult }) {
  const [open, setOpen] = useState(audit.band !== 'green' || audit.degraded)
  const failures = audit.checks.filter((c) => c.status === 'fail')
  const notChecked = audit.checks.filter((c) => c.status === 'skipped')

  const summary =
    failures.length > 0
      ? `${failures.length} issue${failures.length === 1 ? '' : 's'}`
      : notChecked.length > 0
        ? 'Incomplete'
        : 'All clear'

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-2.5 text-left hover:bg-slate-100/60"
      >
        <ChevronRight
          className={clsx('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-90')}
        />
        <span className="text-xs font-semibold text-slate-700">Quality audit</span>
        <Badge variant={AUDIT_BAND_VARIANT[audit.band]}>{audit.score}/100</Badge>
        <span className="ml-auto text-[11px] text-slate-500">{summary}</span>
      </button>

      {open && (
        <div className="px-5 pb-3">
          {audit.degraded && (
            <div className="mb-2.5 flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 ring-1 ring-inset ring-slate-200">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              <p className="text-[11px] leading-relaxed text-slate-600">
                This audit did not finish, so {audit.score}/100 is a best case, not a verdict.
                {' '}
                {notChecked.length === 1 ? 'One check' : `${notChecked.length} checks`} could not run
                and {notChecked.length === 1 ? 'was' : 'were'} scored as if passing.
              </p>
            </div>
          )}

          <ul className="space-y-1.5">
            {audit.checks.map((check) => (
              <li
                key={check.id}
                className={clsx(
                  'flex items-start gap-2.5',
                  check.status === 'n-a' && 'opacity-55'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700">{check.label}</p>
                  {check.reason && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{check.reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {check.status === 'fail' && (
                    <span className="text-[11px] font-medium tabular-nums text-red-600">
                      &minus;{check.penalty}
                    </span>
                  )}
                  <Badge variant={CHECK_STATUS_VARIANT[check.status]}>
                    {CHECK_STATUS_LABEL[check.status]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface OutputPanelProps {
  generatedReading: string | null
  isGenerating: boolean
  generationError: string | null
  onGenerate: () => void
  onRegenerate: () => void
  onSaveDraft: () => Promise<void>
  onMarkReady: () => Promise<void>
  onMarkSent: () => Promise<void>
  readingId: string | null
  clientName: string
  clientEmail: string
  clientPhone: string
  readingTier: string
  topic: string
  deliveryFormat: string
  businessName: string
  readingLength: number
  audit: AuditResult | null
  hasAddons?: boolean
}

export function OutputPanel({
  generatedReading,
  isGenerating,
  generationError,
  onGenerate,
  onRegenerate,
  onSaveDraft,
  onMarkReady,
  onMarkSent,
  readingId,
  clientName,
  clientEmail,
  clientPhone,
  readingTier,
  topic,
  deliveryFormat,
  businessName,
  readingLength,
  audit,
  hasAddons = false,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const [saveDraftState, setSaveDraftState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [readyState, setReadyState] = useState<'idle' | 'marking' | 'marked' | 'error'>('idle')
  const [sentState, setSentState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [mediaSignedUrl, setMediaSignedUrl] = useState<string | null>(null)
  const [mediaExpiresAt, setMediaExpiresAt] = useState<string | null>(null)
  const [statusIdx, setStatusIdx] = useState(0)
  const [readingVisible, setReadingVisible] = useState(!!generatedReading)
  const prevGeneratingRef = useRef(isGenerating)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const isVoiceNote = deliveryFormat === 'voice_note'
  const isVideo = deliveryFormat === 'video'
  const hasOutput = !!generatedReading

  // Cycle status messages during generation (FIX 8)
  useEffect(() => {
    if (!isGenerating) { setStatusIdx(0); return }
    const interval = setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length),
      3000
    )
    return () => clearInterval(interval)
  }, [isGenerating])

  // Fade-in when generation completes (FIX 8)
  useEffect(() => {
    if (prevGeneratingRef.current && !isGenerating && generatedReading) {
      setReadingVisible(false)
      const t = setTimeout(() => setReadingVisible(true), 60)
      prevGeneratingRef.current = false
      return () => clearTimeout(t)
    }
    if (generatedReading && !prevGeneratingRef.current) {
      setReadingVisible(true) // restore mode — no animation
    }
    prevGeneratingRef.current = isGenerating
  }, [isGenerating, generatedReading])

  // Character count (FIX 6)
  const charCount = generatedReading?.length ?? 0
  const charTarget = readingLength || 6000
  const charRatio = charTarget > 0 ? charCount / charTarget : 1
  const charCountColor =
    charRatio >= 0.9 ? 'text-green-600' :
    charRatio >= 0.75 ? 'text-amber-600' :
    'text-red-600'
  const charBadgeColor =
    charRatio >= 0.9 ? 'bg-green-100 text-green-700' :
    charRatio >= 0.75 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700'

  async function handleCopy() {
    if (!generatedReading) return
    await navigator.clipboard.writeText(generatedReading)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function buildDeliveryMessage(): string {
    const tierLabel = TIER_LABELS[readingTier] ?? readingTier
    const name = clientName.split(' ')[0] || clientName
    if (isVoiceNote && mediaSignedUrl) {
      return `Hi ${name}, your ${tierLabel} ${topic} reading is ready as a voice note! 🎙️\n\n${mediaSignedUrl}\n\nThis link is valid for 30 days. Let me know if you have any questions 💙\n\n${businessName}`
    }
    return generatedReading ?? ''
  }

  function handleWhatsApp() {
    const message = buildDeliveryMessage()
    if (!clientPhone || !message) return
    const phone = clientPhone.replace(/\D/g, '')
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleEmail() {
    const message = buildDeliveryMessage()
    if (!message) return
    const tierLabel = TIER_LABELS[readingTier] ?? readingTier
    const subject = `Your ${tierLabel} ${topic} Reading from ${businessName}`
    const url = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  async function handleSaveDraftClick() {
    if (saveDraftState === 'saving') return
    setSaveDraftState('saving')
    try {
      await onSaveDraft()
      setSaveDraftState('saved')
      setTimeout(() => setSaveDraftState('idle'), 2000)
    } catch {
      setSaveDraftState('error')
      setTimeout(() => setSaveDraftState('idle'), 3000)
    }
  }

  async function handleMarkReadyClick() {
    if (readyState === 'marking' || readyState === 'marked') return
    setReadyState('marking')
    try {
      await onMarkReady()
      setReadyState('marked')
    } catch {
      setReadyState('error')
      setTimeout(() => setReadyState('idle'), 3000)
    }
  }

  async function handleMarkSentClick() {
    setSentState('sending')
    try {
      await onMarkSent()
      setSentState('sent')
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch {
      setSentState('error')
      setTimeout(() => setSentState('idle'), 3000)
    }
  }

  async function handleFileUpload(file: File) {
    if (!readingId) return
    const MAX_MB = 25
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File too large. Max ${MAX_MB}MB — please compress and try again.`)
      return
    }
    setUploadError(null)
    setUploadState('uploading')
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? ''
    const fileName = `voice-note-${Date.now()}.${ext}`
    const path = `readings/${readingId}/${fileName}`

    const { error: storageError } = await supabase.storage
      .from('reading-media')
      .upload(path, file, { upsert: true })

    if (storageError) { setUploadState('error'); return }

    try {
      const res = await fetch('/api/readings/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, filePath: path }),
      })
      if (!res.ok) throw new Error()
      const { signedUrl, expiresAt } = await res.json()
      setMediaSignedUrl(signedUrl)
      setMediaExpiresAt(expiresAt)
      setUploadState('success')
    } catch {
      setUploadState('error')
    }
  }

  const noPhone = !clientPhone.trim()
  const daysLeft = mediaExpiresAt
    ? differenceInDays(new Date(mediaExpiresAt), new Date())
    : null

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Panel header (FIX 7) ─────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-4 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          {clientName ? `${clientName.split(' ')[0]}'s Reading` : 'New Reading'}
        </h2>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {TIER_LABELS[readingTier] ?? readingTier}
          </span>
          <span className="text-slate-300 text-[11px]">·</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {topic}
          </span>
          {hasOutput && (
            <>
              <span className="text-slate-300 text-[11px]">·</span>
              <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', charBadgeColor)}>
                {charCount.toLocaleString()} chars
              </span>
            </>
          )}
          {audit && (
            <>
              <span className="text-slate-300 text-[11px]">·</span>
              <Badge variant={AUDIT_BAND_VARIANT[audit.band]}>Audit {audit.score}/100</Badge>
              {/* Degraded gets its own chip alongside the score rather than
                  recolouring it — an incomplete audit must not read as clean,
                  and must not mask a genuinely red score either. */}
              {audit.degraded && (
                <Badge variant="default" className="gap-1">
                  <HelpCircle className="h-3 w-3" />
                  Incomplete
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {audit && <AuditChecklist audit={audit} />}

      {/* ── Indeterminate progress bar during generation (FIX 8) ─────── */}
      {isGenerating && (
        <div className="shrink-0 h-1 w-full bg-brand-100 overflow-hidden">
          <div className="h-full w-full bg-brand-400 animate-pulse" />
        </div>
      )}

      {/* ── Main output area ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isGenerating ? (
          // Skeleton loading state (FIX 8)
          <div className="p-6">
            <div className="flex flex-col items-center gap-3 mb-8">
              <Loader2 size={22} className="animate-spin text-brand-400" />
              <p className="text-sm font-medium text-slate-500">
                {STATUS_MESSAGES[statusIdx]}
              </p>
            </div>
            <div className="space-y-3 animate-pulse">
              {[100, 96, 100, 88, 100, 74, 100, 92, 100, 68, 100, 84, 100, 60].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded-full bg-slate-200"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>
        ) : generationError ? (
          // Error state
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle size={20} className="text-red-600" />
            </div>
            <p className="text-sm font-semibold text-red-700">Generation failed</p>
            <p className="text-xs text-red-600 max-w-xs">{generationError}</p>
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw size={13} />
              Try again
            </Button>
          </div>
        ) : generatedReading ? (
          // Reading text (FIX 2 — typography)
          <div
            className={clsx(
              'px-6 pt-5 pb-6 transition-opacity duration-500',
              readingVisible ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div className="max-w-[680px] mx-auto">
              {generatedReading.split(/\n\n+/).map((para, i) => (
                <p
                  key={i}
                  className="text-[15px] leading-[1.8] text-slate-800 mb-6 last:mb-0"
                >
                  {para.split('\n').map((line, j) => (
                    <Fragment key={j}>
                      {j > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </p>
              ))}
            </div>
          </div>
        ) : (
          // Empty state placeholder (FIX 9)
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full min-h-[300px]">
            <div className="rounded-full bg-slate-100 p-4">
              <Moon size={26} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Ready when you are</p>
              <p className="mt-1.5 text-xs text-slate-400 max-w-[240px] leading-relaxed">
                Fill in the details and cards on the left, then hit Generate Reading to create the reading.
              </p>
            </div>
            {/* Generate button in empty state — wide screens only (FIX 13) */}
            <button
              type="button"
              onClick={onGenerate}
              className="hidden lg:flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 mt-1"
            >
              <Sparkles size={15} />
              Generate Reading
            </button>
          </div>
        )}
      </div>

      {/* ── Character count ───────────────────────────────────────────── */}
      {hasOutput && (
        <div className="shrink-0 flex items-center px-6 py-2 border-t border-slate-100">
          <span className={clsx('text-xs', charCountColor)}>
            {hasAddons && charCount > charTarget
              ? `${charCount.toLocaleString()} characters (${charTarget.toLocaleString()} reading + ${(charCount - charTarget).toLocaleString()} add-ons)`
              : `${charCount.toLocaleString()} / ${charTarget.toLocaleString()} characters`}
          </span>
        </div>
      )}

      {/* ── Voice note upload ─────────────────────────────────────────── */}
      {isVoiceNote && hasOutput && (
        <div className="shrink-0 mx-5 mb-3 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Voice Note Upload</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload the recorded file to generate a shareable link
            </p>
          </div>
          {!readingId ? (
            <p className="text-xs text-amber-600">Save as draft first to enable file upload</p>
          ) : uploadState === 'idle' && !mediaSignedUrl ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) { setUploadError(null); handleFileUpload(file) }
                  e.target.value = ''
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} />
                Choose file
              </Button>
              {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
            </>
          ) : uploadState === 'uploading' ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-brand-500" />
              <span className="text-sm text-slate-600">Uploading…</span>
            </div>
          ) : uploadState === 'error' ? (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle size={14} />
              <span className="text-sm">Upload failed — </span>
              <button
                type="button"
                className="text-sm underline underline-offset-2"
                onClick={() => { setUploadState('idle'); setUploadError(null) }}
              >
                try again
              </button>
            </div>
          ) : mediaSignedUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-green-600 text-sm">
                <CheckCircle2 size={14} /> File uploaded
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-500 truncate">{mediaSignedUrl}</p>
              </div>
              {daysLeft !== null && (
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className={
                    daysLeft < 0 ? 'text-slate-400' : daysLeft < 7 ? 'text-red-500' :
                    daysLeft < 15 ? 'text-amber-500' : 'text-green-600'
                  } />
                  <span className={`text-xs ${
                    daysLeft < 0 ? 'text-slate-400' : daysLeft < 7 ? 'text-red-500' :
                    daysLeft < 15 ? 'text-amber-500' : 'text-green-600'
                  }`}>
                    {daysLeft < 0 ? 'Link expired' : `Link valid for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}`}
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Video coming soon ─────────────────────────────────────────── */}
      {isVideo && hasOutput && (
        <div className="shrink-0 mx-5 mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Video readings coming soon</p>
          <p className="text-xs text-slate-500 mt-1.5">
            Generate the reading above as your script, record your video, then share it with your client manually.
          </p>
        </div>
      )}

      {/* ── Action bar (FIX 3) ───────────────────────────────────────── */}
      {hasOutput && (
        <div className="shrink-0 border-t border-slate-200 px-5 py-4 space-y-3">
          {/* Row 1: utility — Regenerate | Save Draft */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isGenerating}>
              <RefreshCw size={13} />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveDraftClick}
              disabled={saveDraftState === 'saving'}
            >
              {saveDraftState === 'saving' ? 'Saving…'
                : saveDraftState === 'saved' ? 'Saved ✓'
                : saveDraftState === 'error' ? 'Failed — retry'
                : 'Save Draft'}
            </Button>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100" />

          {/* Row 2: Copy | WA | Email (left) + Mark Ready | Mark Sent (right) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Share group */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>

              {isVideo || (isVoiceNote && !mediaSignedUrl) || noPhone ? (
                <span
                  title={
                    isVideo ? 'Video delivery coming soon'
                    : noPhone ? 'Add a phone number to use this'
                    : 'Upload the voice note file first'
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
                >
                  <MessageCircle size={13} /> WhatsApp
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                >
                  <MessageCircle size={13} /> WhatsApp
                </button>
              )}

              {isVideo || (isVoiceNote && !mediaSignedUrl) ? (
                <span
                  title={isVideo ? 'Video delivery coming soon' : 'Upload the voice note file first'}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
                >
                  <Mail size={13} /> Email
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleEmail}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Mail size={13} /> Email
                </button>
              )}
            </div>

            {/* Status group — pushed right */}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMarkReadyClick}
                disabled={readyState === 'marking' || readyState === 'marked'}
              >
                {readyState === 'marking' ? 'Marking…'
                  : readyState === 'marked' ? 'Ready ✓'
                  : readyState === 'error' ? 'Error — retry'
                  : 'Mark Ready'}
              </Button>
              <Button
                size="sm"
                onClick={handleMarkSentClick}
                disabled={!readingId || sentState === 'sending'}
              >
                {sentState === 'sending' ? 'Sending…'
                  : sentState === 'sent' ? 'Marked sent ✓'
                  : sentState === 'error' ? 'Error — retry'
                  : 'Mark Sent'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
