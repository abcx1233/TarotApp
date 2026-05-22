'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, RefreshCw, Loader2, MessageCircle, Mail, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/Button'

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
  clientEmail: string
  clientPhone: string
  readingTier: string
  topic: string
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
  clientEmail,
  clientPhone,
  readingTier,
  topic,
  businessName,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const [saveDraftState, setSaveDraftState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sentState, setSentState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const router = useRouter()

  async function handleCopy() {
    if (!generatedReading) return
    await navigator.clipboard.writeText(generatedReading)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleWhatsApp() {
    if (!clientPhone || !generatedReading) return
    const phone = clientPhone.replace(/\D/g, '')
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(generatedReading)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleEmail() {
    if (!generatedReading) return
    const tierLabel = TIER_LABELS[readingTier] ?? readingTier
    const subject = `Your ${tierLabel} ${topic} Reading from ${businessName}`
    const url = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(generatedReading)}`
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

  const hasOutput = !!generatedReading
  const noPhone = !clientPhone.trim()

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
            {noPhone ? (
              <span
                title="Add a phone number to use this"
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
            <button
              type="button"
              onClick={handleEmail}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Mail size={13} />
              Email
            </button>

            {/* Status actions */}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="sm" onClick={onMarkReady}>
                Mark Ready
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
