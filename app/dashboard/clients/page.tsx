'use client'

import { useEffect, useState } from 'react'
import { ClientList } from '@/components/clients/ClientList'
import { ClientProfile } from '@/components/clients/ClientProfile'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import type { Client, Reading, ClientNote } from '@/types'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selected, setSelected] = useState<Client | null>(null)
  const [readings, setReadings] = useState<Reading[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseClient()
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('full_name', { ascending: true })
      setClients((data ?? []) as Client[])
      setLoading(false)
    }
    load()
  }, [])

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

  return (
    <div className="flex h-full">
      {/* Left: Client list */}
      <div className="w-64 shrink-0 border-r border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h1 className="text-sm font-semibold text-slate-900">Clients</h1>
          <Button size="sm" variant="ghost" className="text-xs">
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
    </div>
  )
}
