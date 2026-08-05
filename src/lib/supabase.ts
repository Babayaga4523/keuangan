import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbqzbfuoisswuluzlodj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicXpiZnVvaXNzd3VsdXpsb2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDYyMzksImV4cCI6MjA5ODMyMjIzOX0.VecCAWnnyWufssmFAHXvmI5tq5ujEv1x4A6NwCmwJEc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
