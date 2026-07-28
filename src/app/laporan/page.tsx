import { createServerClient } from '@/lib/supabase-server';
import ReportManager, { type Transaction } from '@/components/client/report-manager';
import { cookies } from 'next/headers';
import { actionGetComparisonData } from '@/lib/actions';

export const revalidate = 0; // Ensure reports are always live

export default async function LaporanPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  // Fetch transactions, accounts, categories, and comparison data in parallel
  const [txRes, accRes, catRes, compRes] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
        id,
        amount,
        type,
        transaction_date,
        description,
        accounts:accounts!transactions_account_id_fkey (id, name),
        categories (id, name),
        destination_account:destination_account_id (id, name)
      `)
      .eq('profile', profile)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('accounts').select('id, name, is_active').eq('profile', profile).order('name'),
    supabase.from('categories').select('id, name, type').order('name'),
    actionGetComparisonData()
  ]);

  const transactions = (txRes.data || []) as unknown as Transaction[];
  const accounts = accRes.data || [];
  const categories = catRes.data || [];
  const comparisonData = compRes.success ? compRes.data : {
    silva: { totalBalance: 0, income: 0, expense: 0 },
    yoga: { totalBalance: 0, income: 0, expense: 0 }
  };

  return (
    <ReportManager 
      transactions={transactions} 
      accounts={accounts} 
      categories={categories} 
      comparisonData={comparisonData}
      profile={profile}
    />
  );
}
