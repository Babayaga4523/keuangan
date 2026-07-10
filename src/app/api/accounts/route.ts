import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    const [accountsRes, categoriesRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, balance, type')
        .eq('profile', profile)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('categories')
        .select('id, name, type')
        .order('name')
    ]);

    if (accountsRes.error) {
      throw accountsRes.error;
    }
    if (categoriesRes.error) {
      throw categoriesRes.error;
    }

    return new Response(
      JSON.stringify({ 
        accounts: accountsRes.data || [], 
        categories: categoriesRes.data || [] 
      }), 
      { status: 200 }
    );
  } catch (err: any) {
    console.error('API Init Data error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
