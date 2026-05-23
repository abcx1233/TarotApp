'use client'

import { useEffect, useState } from 'react'
import { ClientList } from '@/components/clients/ClientList'
import { ClientProfile } from '@/components/clients/ClientProfile'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Plus, X } from 'lucide-react'
import type { Client, Reading, ClientNote } from '@/types'

const STAR_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const BLANK_NEW_CLIENT = {
  full_name: '',
  email: '',
  phone: '',
  star_sign: '',
  instagram_handle: '',
  general_notes: '',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selected, setSelected] = useState<Client | null>(null)
  const [readings, setReadings] = useState<Reading[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [noteClientIds, setNoteClientIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [showNewClientPanel, setShowNewClientPanel] = useState(false)
  const [newClientForm, setNewClientForm] = useState(BLANK_NEW_CLIENT)
  const [newClientNameError, setNewClientNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseClient()
      const [{ data: clientData }, { data: noteData }] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .is('deleted_at', null)
          .order('full_name', { ascending: true }),
        supabase
          .from('client_notes')
          .select('client_id'),
      ])
      setClients((clientData ?? []) as Client[])
      setNoteClientIds(new Set((noteData ?? []).map((n: { client_id: string }) => n.client_id).filter(Boolean)))
      setLoading(false)
    }
    load()
  }, [])

  async function handleTrashClient(clientId: string) {
    const supabase = createSupabaseClient()
    await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', clientId)
    setClients((prev) => prev.filter((c) => c.id !== clientId))
    setSelected(null)
    setReadings([])
    setNotes([])
  }

  async function handleSelect(client: Client) {
    setSelected(client)
    const supabase = createSupabaseClient()

    const [{ data: r }, { data: n }] = await Promise.all([
      supabase
        .from('readings')
        .select('*, order:orders(reading_tier, topic, status)')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false }),
    ])

    setReadings((r ?? []) as Reading[])
    setNotes((n ?? []) as ClientNote[])
  }

  function handleNotesChange(clientId: string, noteCount: number) {
    setNoteClientIds((prev) => {
      const next = new Set(prev)
      if (noteCount > 0) next.add(clientId)
      else next.delete(clientId)
      return next
    })
  }

  function openNewClientPanel() {
    setNewClientForm(BLANK_NEW_CLIENT)
    setNewClientNameError('')
    setShowNewClientPanel(true)
  }

  function closeNewClientPanel() {
    setShowNewClientPanel(false)
    setNewClientNameError('')
  }

  async function handleSaveNewClient() {
    if (!newClientForm.full_name.trim()) {
      setNewClientNameError('Full name is required')
      return
    }
    setNewClientNameError('')
    setSaving(true)
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from('clients')
        .insert({
          full_name: newClientForm.full_name.trim(),
          email: newClientForm.email.trim() || null,
          phone: newClientForm.phone.trim() || null,
          star_sign: newClientForm.star_sign || null,
          instagram_handle: newClientForm.instagram_handle.trim() || null,
          general_notes: newClientForm.general_notes.trim() || null,
          total_spent: 0,
          is_returning: false,
          is_test: false,
        })
        .select()
        .single()

      if (error) throw error

      const newClient = data as Client
      setClients((prev) =>
        [...prev, newClient].sort((a, b) => a.full_name.localeCompare(b.full_name))
      )
      closeNewClientPanel()
      await handleSelect(newClient)
      showToast('Client added ✓')
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: Client list */}
      <div className="w-64 shrink-0 border-r border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h1 className="text-sm font-semibold text-slate-900">Clients</h1>
          <Button size="sm" variant="ghost" className="text-xs" onClick={openNewClientPanel}>
            <Plus size={13} />
            New
          </Button>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <ClientList
            clients={clients}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            noteClientIds={noteClientIds}
          />
        )}
      </div>

      {/* Right: Client profile */}
      <div className="flex-1 min-w-0 overflow-hidden bg-slate-50">
        {selected ? (
          <ClientProfile
            client={selected}
            readings={readings}
            notes={notes}
            onUpdate={(updated) => {
              setSelected(updated)
              setClients((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
              )
            }}
            onTrash={handleTrashClient}
            onNotesChange={handleNotesChange}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-slate-400">Select a client to view their profile</p>
              <p className="mt-1 text-xs text-slate-400">{clients.length} clients total</p>
            </div>
          </div>
        )}
      </div>

      {/* New Client slide-over */}
      {showNewClientPanel && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20"
            onClick={closeNewClientPanel}
          />
          {/* Panel */}
          <div className="relative z-50 flex w-80 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">New Client</h2>
              <button
                type="button"
                onClick={closeNewClientPanel}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <Label htmlFor="nc-full-name">Full name *</Label>
                <Input
                  id="nc-full-name"
                  value={newClientForm.full_name}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                  error={newClientNameError}
                />
                {newClientNameError && (
                  <p className="mt-1 text-xs text-red-600">{newClientNameError}</p>
                )}
              </div>

              <div>
                <Label htmlFor="nc-email">Email</Label>
                <Input
                  id="nc-email"
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>

              <div>
                <Label htmlFor="nc-phone">Phone</Label>
                <Input
                  id="nc-phone"
                  type="tel"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+44 7700 000000"
                />
              </div>

              <div>
                <Label htmlFor="nc-star-sign">Star sign</Label>
                <Select
                  id="nc-star-sign"
                  value={newClientForm.star_sign}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, star_sign: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {STAR_SIGNS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="nc-instagram">Instagram handle</Label>
                <Input
                  id="nc-instagram"
                  value={newClientForm.instagram_handle}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, instagram_handle: e.target.value }))}
                  placeholder="@username"
                />
              </div>

              <div>
                <Label htmlFor="nc-notes">General notes</Label>
                <Textarea
                  id="nc-notes"
                  value={newClientForm.general_notes}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, general_notes: e.target.value }))}
                  placeholder="Any notes about this client…"
                  rows={4}
                />
              </div>
            </div>

            <div className="shrink-0 flex gap-2 border-t border-slate-200 p-4">
              <Button variant="outline" size="sm" onClick={closeNewClientPanel} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveNewClient} disabled={saving} className="flex-1">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
