'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Toggle } from '@/components/ui/Toggle'
import { Save, ExternalLink, CheckCircle2 } from 'lucide-react'
import type { AppSettings } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .single()

      if (data) setSettings(data as AppSettings)
      setLoading(false)
    }
    load()
  }, [])

  function set(key: keyof AppSettings, value: string | number | null) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    if (settings.id) {
      await supabase
        .from('app_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('id', settings.id)
    } else {
      const { data } = await supabase
        .from('app_settings')
        .insert(settings)
        .select()
        .single()
      if (data) setSettings(data as AppSettings)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleGmailConnect() {
    window.location.href = '/api/auth/gmail'
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <Button onClick={handleSave} loading={saving}>
          {saved ? <CheckCircle2 size={14} className="text-green-400" /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save changes'}
        </Button>
      </div>

      {/* Reader identity */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Reader identity
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reader-name">Reader name</Label>
              <Input
                id="reader-name"
                value={settings.reader_name ?? ''}
                onChange={(e) => set('reader_name', e.target.value)}
                placeholder="e.g. Charlotte"
              />
            </div>
            <div>
              <Label htmlFor="signoff-name">Sign-off name</Label>
              <Input
                id="signoff-name"
                value={settings.signoff_name ?? ''}
                onChange={(e) => set('signoff_name', e.target.value)}
                placeholder="e.g. Charlotte x"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="booking-url">Booking URL</Label>
            <Input
              id="booking-url"
              type="url"
              value={settings.booking_url ?? ''}
              onChange={(e) => set('booking_url', e.target.value)}
              placeholder="https://deepbluedivination.com/book"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="instagram">Instagram handle</Label>
              <Input
                id="instagram"
                value={settings.instagram_handle ?? ''}
                onChange={(e) => set('instagram_handle', e.target.value)}
                placeholder="@deepbluedivination"
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp number</Label>
              <Input
                id="whatsapp"
                type="tel"
                value={settings.whatsapp_number ?? ''}
                onChange={(e) => set('whatsapp_number', e.target.value)}
                placeholder="+44 7700 000000"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Defaults */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Reading defaults
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <Label htmlFor="default-length">Default reading length (characters)</Label>
            <Input
              id="default-length"
              type="number"
              min="500"
              max="20000"
              step="500"
              value={settings.default_reading_length ?? 6000}
              onChange={(e) => set('default_reading_length', parseInt(e.target.value, 10))}
            />
          </div>
          <div>
            <Label htmlFor="default-format">Default delivery format</Label>
            <Select
              id="default-format"
              value={settings.default_delivery_format ?? 'written'}
              onChange={(e) => set('default_delivery_format', e.target.value)}
            >
              <option value="written">Written</option>
              <option value="voice_note">Voice Note</option>
              <option value="video">Video</option>
            </Select>
          </div>
        </div>
      </section>

      {/* AI Config */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          AI configuration
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <Label>Groq model</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded-md bg-slate-100 px-3 py-2 text-sm font-mono text-slate-700">
                {process.env.NEXT_PUBLIC_GROQ_MODEL_DISPLAY ?? 'llama-3.3-70b-versatile'}
              </code>
              <span className="text-xs text-slate-400">(read-only — set via GROQ_MODEL env var)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Gmail integration */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Gmail integration
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <p className="text-sm text-slate-600">
            Connect Gmail to send readings directly from Reader Console.
          </p>
          <Button variant="outline" onClick={handleGmailConnect}>
            <ExternalLink size={13} />
            Connect Gmail account
          </Button>
          <p className="text-xs text-slate-400">
            You'll be redirected to Google to authorise access. After connecting, set{' '}
            <code className="bg-slate-100 px-1 rounded">GMAIL_REFRESH_TOKEN</code> in your
            environment.
          </p>
        </div>
      </section>

      {/* UI */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Interface
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Toggle
            checked={darkMode}
            onChange={setDarkMode}
            label="Dark mode (coming soon)"
            disabled
          />
        </div>
      </section>
    </div>
  )
}
