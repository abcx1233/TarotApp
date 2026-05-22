'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Star, Instagram, Plus, Trash2, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { Client, Reading, ClientNote } from '@/types'

interface ClientProfileProps {
  client: Client
  readings: Reading[]
  notes: ClientNote[]
  onUpdate: (client: Client) => void
  onTrash?: (clientId: string) => void
  onNotesChange?: (clientId: string, noteCount: number) => void
}

export function ClientProfile({ client, readings, notes: initialNotes, onUpdate, onTrash, onNotesChange }: ClientProfileProps) {
  const [notes, setNotes] = useState<ClientNote[]>(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmTrash, setConfirmTrash] = useState(false)

  const tierLabels: Record<string, string> = {
    mini: 'Mini', core: 'Core', premium: 'Premium', celtic_cross: 'Celtic Cross',
  }

  async function handleAddNote() {
    if (!newNote.trim() || saving) return
    setSaving(true)
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('client_notes')
      .insert({ client_id: client.id, note: newNote.trim(), tag: 'private' })
      .select()
      .single()

    if (!error && data) {
      const updated = [data as ClientNote, ...notes]
      setNotes(updated)
      setNewNote('')
      onNotesChange?.(client.id, updated.length)
    }
    setSaving(false)
  }

  async function handleDeleteNote(noteId: string) {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('client_notes').delete().eq('id', noteId)
    if (!error) {
      const updated = notes.filter((n) => n.id !== noteId)
      setNotes(updated)
      onNotesChange?.(client.id, updated.length)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{client.full_name}</h2>
            {client.is_returning && (
              <Star size={14} className="text-amber-400 fill-amber-400" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {client.email && <span>{client.email}</span>}
            {client.phone && <span>{client.phone}</span>}
            {client.star_sign && <span>{client.star_sign}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/readings/new?clientId=${client.id}&clientName=${encodeURIComponent(client.full_name)}&email=${encodeURIComponent(client.email ?? '')}`}>
            <Button size="sm">
              <Plus size={13} />
              New reading
            </Button>
          </Link>
          {onTrash && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-red-500"
              onClick={() => setConfirmTrash(true)}
              title="Move to Trash"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Trash confirmation */}
      {confirmTrash && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              Move <strong>{client.full_name}</strong> to Trash? They can be restored within 30 days.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => onTrash?.(client.id)}>
              <Trash2 size={13} />
              Move to Trash
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmTrash(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-slate-900">{readings.length}</p>
          <p className="text-xs text-slate-500">Readings</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-slate-900">£{client.total_spent.toFixed(0)}</p>
          <p className="text-xs text-slate-500">Total spent</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-slate-900">{client.is_returning ? '★' : '✦'}</p>
          <p className="text-xs text-slate-500">{client.is_returning ? 'Returning' : 'New'}</p>
        </div>
      </div>

      {/* Social & Contact */}
      {(client.instagram_handle || client.birthday) && (
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          {client.instagram_handle && (
            <div className="flex items-center gap-1.5">
              <Instagram size={13} />
              <span>{client.instagram_handle}</span>
            </div>
          )}
          {client.birthday && (
            <div className="flex items-center gap-1.5">
              <span>🎂</span>
              <span>{format(new Date(client.birthday), 'd MMMM yyyy')}</span>
            </div>
          )}
        </div>
      )}

      {/* General notes */}
      {client.general_notes && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">General notes</p>
          <p className="text-sm text-amber-800 whitespace-pre-wrap">{client.general_notes}</p>
        </div>
      )}

      {/* Reading history */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Reading history
        </h3>
        {readings.length === 0 ? (
          <p className="text-sm text-slate-400">No readings yet.</p>
        ) : (
          <div className="space-y-2">
            {readings.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {tierLabels[r.order?.reading_tier ?? ''] ?? 'Reading'} — {r.order?.topic}
                  </p>
                  <p className="text-xs text-slate-400">
                    {format(new Date(r.created_at), 'd MMM yyyy')}
                  </p>
                </div>
                <Link href={`/dashboard/history?readingId=${r.id}`}>
                  <Button variant="ghost" size="sm" className="text-xs">View</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Private Notes */}
      <div>
        <div className="mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Private Notes {notes.length > 0 && `(${notes.length})`}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            For your eyes only — never sent to clients or included in readings
          </p>
        </div>

        {/* Add note form */}
        <div className="mt-3 space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add context about this client to inform future readings…"
            rows={3}
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={!newNote.trim() || saving}
          >
            {saving ? 'Saving…' : 'Save note'}
          </Button>
        </div>

        {/* Notes timeline */}
        <div className="mt-4 space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-slate-400">
              No notes yet — add context about this client to inform future readings.
            </p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group relative rounded-lg border border-slate-200 bg-white px-3 py-2.5"
              >
                <p className="text-sm text-slate-800 whitespace-pre-wrap pr-6">{note.note}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {format(new Date(note.created_at), 'd MMM yyyy')}
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(note.id)}
                  className="absolute right-2.5 top-2.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete note"
                >
                  <X size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
