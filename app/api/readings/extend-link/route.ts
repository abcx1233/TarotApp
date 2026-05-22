import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { readingId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { readingId } = body
  if (!readingId) {
    return NextResponse.json({ error: 'readingId is required' }, { status: 422 })
  }

  const { data: reading } = await supabase
    .from('readings')
    .select('media_file_path')
    .eq('id', readingId)
    .single()

  if (!reading?.media_file_path) {
    return NextResponse.json({ error: 'No media file for this reading' }, { status: 400 })
  }

  const TTL = 30 * 24 * 60 * 60
  const { data: urlData, error: urlError } = await supabase.storage
    .from('reading-media')
    .createSignedUrl(reading.media_file_path, TTL)

  if (urlError || !urlData) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  const expiresAt = new Date(Date.now() + TTL * 1000).toISOString()

  await supabase.from('readings').update({
    media_signed_url: urlData.signedUrl,
    media_url_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('id', readingId)

  return NextResponse.json({ signedUrl: urlData.signedUrl, expiresAt })
}
