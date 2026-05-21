import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientProfile } from '@/components/clients/ClientProfile'
import type { Client, Reading, ClientNote } from '@/types'

interface Props {
  params: { id: string }
}

export default async function ClientDetailPage({ params }: Props) {
  const supabase = createClient()

  const [{ data: client }, { data: readings }, { data: notes }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', params.id).single(),
    supabase
      .from('readings')
      .select('*, order:orders(reading_tier, topic, status)')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (!client) notFound()

  return (
    <div className="h-full bg-slate-50">
      <ClientProfile
        client={client as Client}
        readings={(readings ?? []) as Reading[]}
        notes={(notes ?? []) as ClientNote[]}
        onUpdate={() => {}}
      />
    </div>
  )
}
