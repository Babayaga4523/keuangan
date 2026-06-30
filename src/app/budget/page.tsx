import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import BudgetManager from '@/components/client/budget-manager';

export const revalidate = 0;

export default async function BudgetPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [categoriesRes, budgetsRes, txRes] = await Promise.all([
    supabase.from('categories').select('*').eq('type', 'EXPENSE').order('name'),
    supabase.from('budgets').select('*, categories(id, name)')
      .eq('profile', profile).eq('month', month).eq('year', year),
    supabase.from('transactions').select('category_id, amount')
      .eq('profile', profile).eq('type', 'EXPENSE')
      .gte('transaction_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('transaction_date', `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`),
  ]);

  return (
    <BudgetManager
      categories={categoriesRes.data || []}
      budgets={budgetsRes.data || []}
      transactions={txRes.data || []}
      month={month}
      year={year}
      profile={profile}
    />
  );
}
