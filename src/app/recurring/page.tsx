import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import RecurringManager from '@/components/client/recurring-manager';

export const revalidate = 0;

export default async function RecurringPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const [recurringRes, accountsRes, categoriesRes] = await Promise.all([
    supabase
      .from('recurring_transactions')
      .select('*, accounts(id, name), categories(id, name)')
      .eq('profile', profile)
      .eq('is_active', true)
      .order('next_due', { ascending: true }),
    supabase.from('accounts').select('id, name, balance').eq('profile', profile).eq('is_active', true).order('name'),
    supabase.from('categories').select('id, name, type').order('name'),
  ]);

  return (
    <RecurringManager
      recurrings={recurringRes.data || []}
      accounts={accountsRes.data || []}
      categories={categoriesRes.data || []}
      profile={profile}
    />
  );
}
