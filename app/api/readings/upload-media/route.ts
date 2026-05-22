import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { readingId: string; filePath: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { readingId, filePath } = body
  if (!readingId || !filePath) {
    return NextResponse.json({ error: 'readingId and filePath are required' }, { status: 422 })
  }

  const TTL = 30 * 24 * 60 * 60 // 30 days in seconds
  const { data: urlData, error: urlError } = await supabase.storage
    .from('reading-media')
    .createSignedUrl(filePath, TTL)

  if (urlError || !urlData) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  const expiresAt = new Date(Date.now() + TTL * 1000).toISOString()

  await supabase.from('readings').update({
    media_file_path: filePath,
    media_signed_url: urlData.signedUrl,
    media_url_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('id', readingId)

  return NextResponse.json({ signedUrl: urlData.signedUrl, expiresAt })
}
