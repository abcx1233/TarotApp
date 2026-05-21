import { createClient } from '@supabase/supabase-js'

function isWebsiteSyncConfigured(): boolean {
  return !!(
    process.env.WEBSITE_SUPABASE_URL &&
    process.env.WEBSITE_SUPABASE_SERVICE_KEY &&
    process.env.WEBSITE_ORDERS_TABLE
  )
}

function getWebsiteSupabase() {
  return createClient(
    process.env.WEBSITE_SUPABASE_URL!,
    process.env.WEBSITE_SUPABASE_SERVICE_KEY!
  )
}

export async function syncOrderStatusToWebsite(
  sourceOrderId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  if (!isWebsiteSyncConfigured()) {
    return { success: true } // Silently skip if not configured
  }

  try {
    const supabase = getWebsiteSupabase()
    const table = process.env.WEBSITE_ORDERS_TABLE!
    const statusColumn = process.env.WEBSITE_STATUS_COLUMN || 'status'
    const sentValue = process.env.WEBSITE_STATUS_SENT_VALUE || 'completed'

    const { error } = await supabase
      .from(table)
      .update({ [statusColumn]: sentValue })
      .eq('stripe_session_id', sourceOrderId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
