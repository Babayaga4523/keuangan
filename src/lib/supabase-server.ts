// src/lib/supabase-server.ts
// Dipakai di: Server Actions, Route Handlers
// Menggunakan Service Role Key — TIDAK BOLEH dipakai di client components
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbqzbfuoisswuluzlodj.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicXpiZnVvaXNzd3VsdXpsb2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc0NjIzOSwiZXhwIjoyMDk4MzIyMjM5fQ.olgU6LbFklnspohRSJVGueo_yv3hhs-8PVPtstU0SOE';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicXpiZnVvaXNzd3VsdXpsb2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDYyMzksImV4cCI6MjA5ODMyMjIzOX0.VecCAWnnyWufssmFAHXvmI5tq5ujEv1x4A6NwCmwJEc';

  return createClient(url, serviceRoleKey || anonKey, {
    auth: { persistSession: false },
  });
}
