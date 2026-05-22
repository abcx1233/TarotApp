'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Save } from 'lucide-react'
import type { ReadingTemplate } from '@/types'

function TemplateEditor({
  template,
  onSave,
}: {
  template: ReadingTemplate
  onSave: (t: ReadingTemplate) => void
}) {
  const [draft, setDraft] = useState(template)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set(key: keyof ReadingTemplate, value: string | boolean) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reading_templates')
      .upsert({ ...draft, updated_at: new Date().toISOString() })
      .select()
      .single()

    setSaving(false)
    if (!error && data) {
      onSave(data as ReadingTemplate)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            className="font-semibold text-sm border-0 px-0 focus:ring-0 text-slate-900"
            placeholder="Template name"
          />
        </div>
        <Button size="sm" onClick={handleSave} loading={saving}>
          <Save size={13} />
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`signoff-${draft.id}`}>Sign-off text</Label>
          <Textarea
            id={`signoff-${draft.id}`}
            value={draft.signoff_text ?? ''}
            onChange={(e) => set('signoff_text', e.target.value)}
            placeholder={"With love and starlight ✨\n\n[Your name]\nDeep Blue Divination"}
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor={`disclaimer-${draft.id}`}>Disclaimer text</Label>
          <Textarea
            id={`disclaimer-${draft.id}`}
            value={draft.disclaimer_text ?? ''}
            onChange={(e) => set('disclaimer_text', e.target.value)}
            placeholder="This reading is for spiritual guidance and entertainment purposes only. It is not a substitute for professional advice. Please seek guidance from qualified professionals for matters of health, finance, or law."
            rows={4}
          />
        </div>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ReadingTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('reading_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true })

      setTemplates((data ?? []) as ReadingTemplate[])
      setLoading(false)
    }
    load()
  }, [])

  function handleSave(updated: ReadingTemplate) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Templates</h1>
      </div>

      <p className="text-sm text-slate-500">
        Customise the sign-off and disclaimer that are automatically appended to every generated reading.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <TemplateEditor key={t.id} template={t} onSave={handleSave} />
          ))}
          {templates.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              No templates yet. Add one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
