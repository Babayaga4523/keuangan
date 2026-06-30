import { createServerClient } from '@/lib/supabase-server';
import TransactionManager, { 
  type Transaction, 
  type Account, 
  type Category 
} from '@/components/client/transaction-manager';
import { cookies } from 'next/headers';

export const revalidate = 0; // Live data

export default async function TransaksiPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

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
      .eq('profile', profile)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('accounts').select('*').eq('profile', profile).order('name'),
    supabase.from('categories').select('*').order('name')
  ]);

  const transactions = (txRes.data || []) as unknown as Transaction[];
  const accounts = (accRes.data || []) as unknown as Account[];
  const categories = (catRes.data || []) as unknown as Category[];

  return (
    <TransactionManager 
      initialTransactions={transactions} 
      accounts={accounts} 
      categories={categories}
      profile={profile}
    />
  );
}
