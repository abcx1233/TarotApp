import { createClient } from '@/lib/supabase/server'
import { ReadingForm } from '@/components/readings/ReadingForm'
import { TONE_PRESETS as FALLBACK_PRESETS } from '@/lib/ai/prompts/tone-presets'
import type { TonePreset } from '@/types'

export const metadata = {
  title: 'New Reading — Reader Console',
}

async function getTonePresets(): Promise<TonePreset[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tone_presets')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data || data.length === 0) {
    // Fall back to hardcoded presets if DB not seeded yet
    return FALLBACK_PRESETS.map((p, i) => ({
      id: `fallback-${i}`,
      name: p.name,
      description: p.description,
      prompt_text: p.promptText,
      is_default: i === 0,
      default_for_tier: p.defaultForTiers,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  }

  return data as TonePreset[]
}

export default async function NewReadingPage() {
  const tonePresets = await getTonePresets()

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 shrink-0">
        <h1 className="text-base font-semibold text-slate-900">New Reading</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Fill in the details, enter the cards, then generate.
        </p>
      </div>

      {/* Full-height form */}
      <div className="flex-1 min-h-0">
        <ReadingForm initialTonePresets={tonePresets} />
      </div>
    </div>
  )
}
