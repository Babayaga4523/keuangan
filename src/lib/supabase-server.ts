// src/lib/supabase-server.ts
// Dipakai di: Server Actions, Route Handlers
// Menggunakan Service Role Key — TIDAK BOLEH dipakai di client components
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, serviceRoleKey || anonKey, {
    auth: { persistSession: false },
  });
}
