import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbqzbfuoisswuluzlodj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_secret_f3t6efvY2PT_JPRp-qPBZw_-wWqPAeC';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
