'use client'

import { useState } from 'react'
import { Copy, Check, RefreshCw, Loader2, FileDown, Mail, MessageCircle, ScrollText } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'

interface OutputPanelProps {
  generatedReading: string | null
  emailVersion: string | null
  whatsappVersion: string | null
  isGenerating: boolean
  generationError: string | null
  onGenerate: () => void
  onRegenerate: () => void
  onSaveDraft: () => void
  onMarkReady: () => void
  onMarkSent: () => void
  readingId: string | null
}

const OUTPUT_TABS = [
  { id: 'full', label: 'Full Reading' },
  { id: 'email', label: 'Email' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'pdf', label: 'PDF' },
]

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {label || (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}

function ReadingTextArea({ content, placeholder }: { content: string | null; placeholder: string }) {
  if (!content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <ScrollText size={32} className="text-slate-300" />
        <p className="text-sm text-slate-400">{placeholder}</p>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div className="absolute top-2 right-2">
        <CopyButton text={content} />
      </div>
      <div className="h-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 pt-8 scrollbar-thin">
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{content}</p>
      </div>
    </div>
  )
}

export function OutputPanel({
  generatedReading,
  emailVersion,
  whatsappVersion,
  isGenerating,
  generationError,
  onGenerate,
  onRegenerate,
  onSaveDraft,
  onMarkReady,
  onMarkSent,
  readingId,
}: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState('full')

  const hasOutput = !!(generatedReading || emailVersion || whatsappVersion)

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Tab bar */}
      <Tabs tabs={OUTPUT_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Content area */}
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
        ) : (
          <>
            {activeTab === 'full' && (
              <ReadingTextArea
                content={generatedReading}
                placeholder="Generate a reading to see the full text here."
              />
            )}
            {activeTab === 'email' && (
              <div className="h-full space-y-2">
                {emailVersion && (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <Mail size={14} className="text-slate-500 shrink-0" />
                    <p className="text-xs text-slate-500 truncate">
                      {emailVersion.split('\n')[0]?.replace(/^Subject:\s*/i, '')}
                    </p>
                  </div>
                )}
                <ReadingTextArea
                  content={emailVersion}
                  placeholder="The email version will appear here after generating."
                />
              </div>
            )}
            {activeTab === 'whatsapp' && (
              <div className="h-full space-y-2">
                {whatsappVersion && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MessageCircle size={12} />
                    <span>{whatsappVersion.length} characters</span>
                  </div>
                )}
                <ReadingTextArea
                  content={whatsappVersion}
                  placeholder="The WhatsApp version will appear here after generating."
                />
              </div>
            )}
            {activeTab === 'pdf' && (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <FileDown size={32} className="text-slate-300" />
                <p className="text-sm font-medium text-slate-500">PDF Export</p>
                <p className="text-xs text-slate-400">
                  PDF generation coming soon. Your reading is saved and available for copy.
                </p>
                {hasOutput && (
                  <Button variant="outline" size="sm" disabled>
                    <FileDown size={13} />
                    Export PDF (coming soon)
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Error message */}
      {generationError && !isGenerating && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-600">{generationError}</p>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="border-t border-slate-200 pt-3">
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
              <Button
                variant="outline"
                size="sm"
                onClick={onRegenerate}
                disabled={isGenerating}
              >
                <RefreshCw size={13} />
                Regenerate
              </Button>
              <Button variant="ghost" size="sm" onClick={onSaveDraft}>
                Save Draft
              </Button>
            </>
          )}
        </div>

        {hasOutput && (
          <div className="mt-2 flex flex-wrap gap-2">
            {generatedReading && <CopyButton text={generatedReading} label="Copy full" />}
            {emailVersion && <CopyButton text={emailVersion} label="Copy email" />}
            {whatsappVersion && <CopyButton text={whatsappVersion} label="Copy WhatsApp" />}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="sm" onClick={onMarkReady}>
                Mark Ready
              </Button>
              <Button size="sm" onClick={onMarkSent} disabled={!readingId}>
                Mark Sent
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
