export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type AccountType = 'CASH' | 'BANK' | 'E_WALLET';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id?: string;
  destination_account_id?: string;
  amount: number;
  type: TransactionType;
  transaction_date: string;
  description?: string;
  created_at: string;
  // Relasi (joined query)
  accounts?: Pick<Account, 'id' | 'name' | 'type'>;
  categories?: Pick<Category, 'id' | 'name' | 'color'>;
  destination_account?: Pick<Account, 'id' | 'name' | 'type'>;
}

export interface SavingGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Return type untuk semua Server Actions
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
