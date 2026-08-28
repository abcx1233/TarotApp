import type { VercelConfig } from '@vercel/config/v1'

// Pinned to fra1 (Frankfurt) to sit close to the Supabase project (eu-west-1).
// The default iad1 region forced a transatlantic round trip on every
// supabase.auth.getUser() call in middleware, which is what caused the
// original 5s timeout — see lib/supabase/middleware.ts.
export const config: VercelConfig = {
  regions: ['fra1'],
}
