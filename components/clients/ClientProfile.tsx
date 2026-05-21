'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Star, Instagram, MessageCircle, Plus, Edit2 } from 'lucide-react'
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
}

export function ClientProfile({ client, readings, notes: initialNotes, onUpdate }: ClientProfileProps) {
  const [notes, setNotes] = useState<ClientNote[]>(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  async function handleAddNote() {
    if (!newNote.trim()) return
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('client_notes')
      .insert({ client_id: client.id, note: newNote.trim() })
      .select()
      .single()

    if (!error && data) {
      setNotes((prev) => [data as ClientNote, ...prev])
      setNewNote('')
      setAddingNote(false)
    }
  }

  const tierLabels: Record<string, string> = {
    mini: 'Mini', core: 'Core', premium: 'Premium', celtic_cross: 'Celtic Cross',
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
        <Link href={`/dashboard/readings/new?clientId=${client.id}&clientName=${encodeURIComponent(client.full_name)}&email=${encodeURIComponent(client.email ?? '')}`}>
          <Button size="sm">
            <Plus size={13} />
            New reading
          </Button>
        </Link>
      </div>

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

      {/* Client notes */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Notes</h3>
          <button
            type="button"
            onClick={() => setAddingNote(!addingNote)}
            className="text-xs text-brand-600 hover:underline"
          >
            + Add note
          </button>
        </div>

        {addingNote && (
          <div className="mb-3 space-y-2 animate-fade-in">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note about this client…"
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNote}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingNote(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.note}</p>
              <p className="mt-1 text-xs text-slate-400">
                {format(new Date(note.created_at), 'd MMM yyyy')}
                {note.tag && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                    {note.tag}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
