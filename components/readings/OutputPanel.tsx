'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, differenceInDays } from 'date-fns'
import {
  Copy, Check, RefreshCw, Loader2, MessageCircle, Mail, ScrollText,
  Upload, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

const TIER_LABELS: Record<string, string> = {
  mini: 'Mini',
  core: 'Core',
  premium: 'Premium',
  celtic_cross: 'Celtic Cross',
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
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const [saveDraftState, setSaveDraftState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [readyState, setReadyState] = useState<'idle' | 'marking' | 'marked' | 'error'>('idle')
  const [sentState, setSentState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [mediaSignedUrl, setMediaSignedUrl] = useState<string | null>(null)
  const [mediaExpiresAt, setMediaExpiresAt] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const isVoiceNote = deliveryFormat === 'voice_note'
  const isVideo = deliveryFormat === 'video'

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
      setUploadError(`This file is too large. Please compress your voice note and try again. Maximum size is ${MAX_MB}MB.`)
      return
    }
    setUploadError(null)
    setUploadState('uploading')
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? ''
    const fileName = `voice-note-${Date.now()}.${ext}`
    const path = `readings/${readingId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('reading-media')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setUploadState('error')
      return
    }

    // Generate signed URL server-side to store in DB
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

  const hasOutput = !!generatedReading
  const noPhone = !clientPhone.trim()

  const daysLeft = mediaExpiresAt
    ? differenceInDays(new Date(mediaExpiresAt), new Date())
    : null

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Reading output area */}
      <div className="flex-1 min-h-0">
        {isGenerating ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8">
            <Loader2 size={28} className="animate-spin text-brand-500" />
            <p className="text-sm font-medium text-slate-600">Generating reading…</p>
            <p className="text-xs text-slate-400">This usually takes 10–30 seconds</p>
          </div>
        ) : generationError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-semibold text-red-700">Generation failed</p>
            <p className="text-xs text-red-600">{generationError}</p>
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw size={13} />
              Try again
            </Button>
          </div>
        ) : generatedReading ? (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 scrollbar-thin">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{generatedReading}</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
            <ScrollText size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400">Generate a reading to see the full text here.</p>
          </div>
        )}
      </div>

      {/* Video: coming soon notice */}
      {isVideo && hasOutput && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Video readings coming soon</p>
          <p className="text-xs text-slate-500 mt-1.5">
            Generate the reading above as your script, record your video, then share it with your client manually.
          </p>
        </div>
      )}

      {/* Voice note: file upload */}
      {isVoiceNote && hasOutput && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
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
                  if (file) {
                    setUploadError(null)
                    handleFileUpload(file)
                  }
                  e.target.value = ''
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} />
                Choose file
              </Button>
              {uploadError && (
                <p className="text-xs text-red-600">{uploadError}</p>
              )}
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
                <CheckCircle2 size={14} />
                File uploaded
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-500 truncate">{mediaSignedUrl}</p>
              </div>
              {daysLeft !== null && (
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className={
                    daysLeft < 0 ? 'text-slate-400' :
                    daysLeft < 7 ? 'text-red-500' :
                    daysLeft < 15 ? 'text-amber-500' : 'text-green-600'
                  } />
                  <span className={`text-xs ${
                    daysLeft < 0 ? 'text-slate-400' :
                    daysLeft < 7 ? 'text-red-500' :
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

      {/* Sticky action bar */}
      <div className="border-t border-slate-200 pt-3 space-y-3">
        {/* Primary action */}
        <div className="flex flex-wrap gap-2">
          {!hasOutput ? (
            <Button
              onClick={onGenerate}
              loading={isGenerating}
              disabled={isGenerating}
              className="flex-1"
              size="lg"
            >
              {!isGenerating && <ScrollText size={16} />}
              Generate Reading
            </Button>
          ) : (
            <>
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
                {saveDraftState === 'saving'
                  ? 'Saving…'
                  : saveDraftState === 'saved'
                  ? 'Draft saved ✓'
                  : saveDraftState === 'error'
                  ? 'Save failed — retry'
                  : 'Save Draft'}
              </Button>
            </>
          )}
        </div>

        {/* Share buttons */}
        {hasOutput && (
          <div className="flex flex-wrap gap-2 items-center">
            {/* Copy */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>

            {/* WhatsApp */}
            {isVideo ? (
              <span
                title="Video delivery coming soon"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
              >
                <MessageCircle size={13} />
                WhatsApp
              </span>
            ) : noPhone ? (
              <span
                title="Add a phone number to use this"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
              >
                <MessageCircle size={13} />
                WhatsApp
              </span>
            ) : isVoiceNote && !mediaSignedUrl ? (
              <span
                title="Upload the voice note file first"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
              >
                <MessageCircle size={13} />
                WhatsApp
              </span>
            ) : (
              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
              >
                <MessageCircle size={13} />
                WhatsApp
              </button>
            )}

            {/* Email */}
            {isVideo ? (
              <span
                title="Video delivery coming soon"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
              >
                <Mail size={13} />
                Email
              </span>
            ) : isVoiceNote && !mediaSignedUrl ? (
              <span
                title="Upload the voice note file first"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
              >
                <Mail size={13} />
                Email
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEmail}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Mail size={13} />
                Email
              </button>
            )}

            {/* Status actions */}
            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMarkReadyClick}
                disabled={readyState === 'marking' || readyState === 'marked'}
              >
                {readyState === 'marking'
                  ? 'Marking…'
                  : readyState === 'marked'
                  ? 'Marked ready ✓'
                  : readyState === 'error'
                  ? 'Error — retry'
                  : 'Mark Ready'}
              </Button>
              <Button
                size="sm"
                onClick={handleMarkSentClick}
                disabled={!readingId || sentState === 'sending'}
              >
                {sentState === 'sending'
                  ? 'Sending…'
                  : sentState === 'sent'
                  ? 'Reading marked as sent ✓'
                  : sentState === 'error'
                  ? 'Error — retry'
                  : 'Mark Sent'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
