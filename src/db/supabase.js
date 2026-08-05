// The Supabase client — talks to the cloud Postgres project defined by
// 01-schema.sql. Only ever imported by auth and (later) the sync engine.
// No screen should import this to read data; that's what Dexie is for.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly at boot rather than silently breaking auth later. A
  // placeholder URL below keeps createClient() from throwing synchronously
  // (an undefined URL crashes the whole app on import) so the rest of the
  // UI is still inspectable before real credentials exist — login itself
  // will correctly fail until .env.local is filled in.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.local.example to .env.local and fill in your project values. Auth will not work until then.')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
