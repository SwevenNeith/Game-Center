import { createClient } from '@supabase/supabase-js'

function normalizeSupabaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim().replace(/\/+$/, '')
  return value.replace(/\/rest\/v1$/i, '')
}

export const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
