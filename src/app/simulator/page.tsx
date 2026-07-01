import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import SimulatorManager from '@/components/client/simulator-manager';

export const revalidate = 0;

export default async function SimulatorPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  // Fetch accounts & active recurring rules
  const [accountsRes, recurringRes] = await Promise.all([
    supabase.from('accounts').select('id, name, balance').eq('profile', profile).eq('is_active', true),
    supabase.from('recurring_transactions').select('*, accounts(name), categories(name)').eq('profile', profile).eq('is_active', true)
  ]);

  const accounts = accountsRes.data || [];
  const recurringList = recurringRes.data || [];

  // Calculate live total balance
  const liveTotalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);

  // Group recurring transactions by type (income vs expense)
  const defaultMonthlyIncomes = recurringList
    .filter(r => r.type === 'INCOME')
    .map(r => ({
      id: r.id,
      name: r.description || r.categories?.name || 'Pemasukan Rutin',
      amount: parseFloat(r.amount)
    }));

  const defaultMonthlyExpenses = recurringList
    .filter(r => r.type === 'EXPENSE')
    .map(r => ({
      id: r.id,
      name: r.description || r.categories?.name || 'Pengeluaran Rutin',
      amount: parseFloat(r.amount)
    }));

  return (
    <SimulatorManager
      liveTotalBalance={liveTotalBalance}
      defaultMonthlyIncomes={defaultMonthlyIncomes}
      defaultMonthlyExpenses={defaultMonthlyExpenses}
      profile={profile}
    />
  );
}
