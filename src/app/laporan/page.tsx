import { createServerClient } from '@/lib/supabase-server';
import ReportManager, { type Transaction } from '@/components/client/report-manager';

export const revalidate = 0; // Ensure reports are always live

export default async function LaporanPage() {
  const supabase = createServerClient();

  // Fetch transactions, accounts, and categories in parallel
  const [txRes, accRes, catRes] = await Promise.all([
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
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('accounts').select('id, name').order('name'),
    supabase.from('categories').select('id, name, type').order('name')
  ]);

  const transactions = (txRes.data || []) as unknown as Transaction[];
  const accounts = accRes.data || [];
  const categories = catRes.data || [];

  return (
    <ReportManager 
      transactions={transactions} 
      accounts={accounts} 
      categories={categories} 
    />
  );
}
