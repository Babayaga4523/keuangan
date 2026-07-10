// src/lib/supabase-server.ts
// Dipakai di: Server Actions, Route Handlers
// Menggunakan Service Role Key — TIDAK BOLEH dipakai di client components
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbqzbfuoisswuluzlodj.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_f3t6efvY2PT_JPRp-qPBZw_-wWqPAeC';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_secret_f3t6efvY2PT_JPRp-qPBZw_-wWqPAeC';

  return createClient(url, serviceRoleKey || anonKey, {
    auth: { persistSession: false },
  });
}
