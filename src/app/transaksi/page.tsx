import { createServerClient } from '@/lib/supabase-server';
import TransactionManager, { 
  type Transaction, 
  type Account, 
  type Category 
} from '@/components/client/transaction-manager';

export const revalidate = 0; // Live data

export default async function TransaksiPage() {
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
    supabase.from('accounts').select('*').order('name'),
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
    />
  );
}
