'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './supabase-server';
import { cookies } from 'next/headers';
import { getJakartaDate } from '@/utils/date';
import {
  TransactionSchema,
  TransferSchema,
  SavingGoalFundSchema,
  SavingGoalCreateSchema,
  UpdateTransactionSchema,
  BudgetSchema,
  RecurringSchema,
  AccountThresholdSchema,
  AccountCreateSchema,
} from './schemas';
import type { ActionResult } from '@/types/finance';

// Helper: revalidate semua halaman yang terdampak
function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/transaksi');
  revalidatePath('/laporan');
  revalidatePath('/tabungan');
  revalidatePath('/parameter');
  revalidatePath('/simulator');
}

// ───────────────────────────────────────────────
// ACTION 1: Tambah Transaksi (INCOME / EXPENSE)
// Menggunakan fn_create_transaction PostgreSQL function
// ───────────────────────────────────────────────
export async function actionCreateTransaction(data: {
  accountId: string;
  categoryId?: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description?: string;
  date: string;
  receiptUrl?: string;
  tags?: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = TransactionSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { accountId, categoryId, amount, type, description, date, receiptUrl, tags } = parsed.data;
  const supabase = createServerClient();

  const { data: txId, error } = await supabase.rpc('fn_create_transaction', {
    p_account_id:  accountId,
    p_category_id: categoryId ?? null,
    p_amount:      amount,
    p_type:        type,
    p_description: description ?? null,
    p_date:        date,
  });

  if (error) return { success: false, error: error.message };

  if (receiptUrl || tags) {
    await supabase
      .from('transactions')
      .update({ receipt_url: receiptUrl || null, tags: tags || null })
      .eq('id', txId);
  }

  revalidateAll();
  return { success: true, data: { id: txId as string } };
}

// ───────────────────────────────────────────────
// ACTION 2: Transfer Antar Rekening
// Menggunakan fn_create_transfer — atomic, deadlock-safe
// ───────────────────────────────────────────────
export async function actionCreateTransfer(data: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  date: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = TransferSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { fromAccountId, toAccountId, amount, description, date } = parsed.data;
  const supabase = createServerClient();

  const { data: txId, error } = await supabase.rpc('fn_create_transfer', {
    p_from_account_id: fromAccountId,
    p_to_account_id:   toAccountId,
    p_amount:          amount,
    p_description:     description ?? null,
    p_date:            date,
  });

  if (error) return { success: false, error: error.message };

  revalidateAll();
  return { success: true, data: { id: txId as string } };
}

// ───────────────────────────────────────────────
// ACTION 3: Hapus Transaksi (rollback saldo otomatis)
// Menggunakan fn_delete_transaction
// ───────────────────────────────────────────────
export async function actionDeleteTransaction(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID transaksi diperlukan' };

  const supabase = createServerClient();
  const { error } = await supabase.rpc('fn_delete_transaction', { p_tx_id: id });

  if (error) return { success: false, error: error.message };

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 4: Setor ke Saving Goal (dari rekening)
// Menggunakan fn_fund_saving_goal — potong saldo akun
// ───────────────────────────────────────────────
export async function actionFundSavingGoal(data: {
  accountId: string;
  goalId: string;
  amount: number;
  description?: string;
}): Promise<ActionResult> {
  const parsed = SavingGoalFundSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { accountId, goalId, amount, description } = parsed.data;
  const supabase = createServerClient();

  const { error } = await supabase.rpc('fn_fund_saving_goal', {
    p_account_id:  accountId,
    p_goal_id:     goalId,
    p_amount:      amount,
    p_description: description ?? null,
  });

  if (error) return { success: false, error: error.message };

  // Update status is_completed jika target sudah 100% tercapai
  const { data: goal } = await supabase
    .from('saving_goals')
    .select('current_amount, target_amount')
    .eq('id', goalId)
    .single();

  if (goal && parseFloat(String(goal.current_amount)) >= parseFloat(String(goal.target_amount))) {
    await supabase
      .from('saving_goals')
      .update({ is_completed: true })
      .eq('id', goalId);
  }

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 5: Buat Target Tabungan Baru
// ───────────────────────────────────────────────
export async function actionCreateSavingGoal(data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = SavingGoalCreateSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { name, targetAmount, currentAmount, deadline } = parsed.data;
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const { data: goal, error } = await supabase
    .from('saving_goals')
    .insert([{
      name,
      target_amount: targetAmount,
      current_amount: currentAmount || 0,
      deadline: deadline || null,
      profile
    }])
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  revalidateAll();
  return { success: true, data: { id: goal.id } };
}

// ───────────────────────────────────────────────
// ACTION 6: Update Progres Saving Goal (manual)
// ───────────────────────────────────────────────
export async function actionUpdateSavingGoal(
  id: string,
  currentAmount: number
): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID target tabungan diperlukan' };
  if (currentAmount < 0) return { success: false, error: 'Jumlah tidak boleh negatif' };

  const supabase = createServerClient();

  // Fetch target to check is_completed
  const { data: goalData, error: fetchErr } = await supabase
    .from('saving_goals')
    .select('target_amount')
    .eq('id', id)
    .single();

  if (fetchErr || !goalData) return { success: false, error: 'Target tabungan tidak ditemukan' };

  const isCompleted = currentAmount >= parseFloat(String(goalData.target_amount));

  const { error } = await supabase
    .from('saving_goals')
    .update({ current_amount: currentAmount, is_completed: isCompleted })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 7: Hapus Target Tabungan
// ───────────────────────────────────────────────
export async function actionDeleteSavingGoal(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID target tabungan diperlukan' };

  const supabase = createServerClient();
  const { error } = await supabase
    .from('saving_goals')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 8: Edit Transaksi (dengan rollback saldo)
// ───────────────────────────────────────────────
export async function actionUpdateTransaction(data: {
  id: string;
  amount: number;
  categoryId?: string;
  description?: string;
  date: string;
  receiptUrl?: string;
  tags?: string;
}): Promise<ActionResult> {
  const parsed = UpdateTransactionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, amount, categoryId, description, date, receiptUrl, tags } = parsed.data;
  const supabase = createServerClient();

  const { error } = await supabase.rpc('fn_update_transaction', {
    p_tx_id:       id,
    p_amount:      amount,
    p_category_id: categoryId ?? null,
    p_description: description ?? null,
    p_date:        date,
  });

  if (error) return { success: false, error: error.message };

  // Update receipt_url & tags jika ada perubahan
  await supabase
    .from('transactions')
    .update({ receipt_url: receiptUrl || null, tags: tags || null })
    .eq('id', id);

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 9: Set / Upsert Budget Bulanan
// ───────────────────────────────────────────────
export async function actionUpsertBudget(data: {
  categoryId: string;
  amount: number;
  month: number;
  year: number;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = BudgetSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { categoryId, amount, month, year } = parsed.data;
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const { data: budget, error } = await supabase
    .from('budgets')
    .upsert(
      { category_id: categoryId, amount, month, year, profile },
      { onConflict: 'category_id,month,year,profile' }
    )
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath('/budget');
  revalidatePath('/dashboard');
  return { success: true, data: { id: budget.id } };
}

// ───────────────────────────────────────────────
// ACTION 10: Hapus Budget
// ───────────────────────────────────────────────
export async function actionDeleteBudget(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID budget diperlukan' };
  const supabase = createServerClient();

  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/budget');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 11: Buat Recurring Transaction
// ───────────────────────────────────────────────
export async function actionCreateRecurring(data: {
  accountId: string;
  categoryId?: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dayOfMonth?: number;
  nextDue: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = RecurringSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { accountId, categoryId, amount, type, description, frequency, dayOfMonth, nextDue } = parsed.data;
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const { data: rec, error } = await supabase
    .from('recurring_transactions')
    .insert([{
      account_id:   accountId,
      category_id:  categoryId ?? null,
      amount,
      type,
      description:  description ?? null,
      frequency,
      day_of_month: dayOfMonth ?? null,
      next_due:     nextDue,
      profile,
    }])
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath('/recurring');
  revalidatePath('/dashboard');
  return { success: true, data: { id: rec.id } };
}

// ───────────────────────────────────────────────
// ACTION 12: Nonaktifkan / Hapus Recurring
// ───────────────────────────────────────────────
export async function actionDeleteRecurring(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID recurring diperlukan' };
  const supabase = createServerClient();

  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/recurring');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 13: Eksekusi Recurring (buat transaksi nyata)
// ───────────────────────────────────────────────
export async function actionExecuteRecurring(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID recurring diperlukan' };
  const supabase = createServerClient();

  // Ambil data recurring
  const { data: rec, error: fetchErr } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !rec) return { success: false, error: 'Recurring tidak ditemukan' };

  // Buat transaksi nyata
  const { error: txErr } = await supabase.rpc('fn_create_transaction', {
    p_account_id:  rec.account_id,
    p_category_id: rec.category_id,
    p_amount:      rec.amount,
    p_type:        rec.type,
    p_description: rec.description ?? `[Auto] ${rec.description || 'Recurring'}`,
    p_date:        getJakartaDate().dateString,
  });

  if (txErr) return { success: false, error: txErr.message };

  // Hitung next_due berikutnya
  const currentDue = new Date(rec.next_due);
  let nextDue: Date;
  if (rec.frequency === 'DAILY') {
    nextDue = new Date(currentDue.setDate(currentDue.getDate() + 1));
  } else if (rec.frequency === 'WEEKLY') {
    nextDue = new Date(currentDue.setDate(currentDue.getDate() + 7));
  } else {
    nextDue = new Date(currentDue.setMonth(currentDue.getMonth() + 1));
  }

  // Update next_due
  await supabase
    .from('recurring_transactions')
    .update({ next_due: nextDue.toISOString().split('T')[0] })
    .eq('id', id);

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 14: Set Threshold Notifikasi Saldo
// ───────────────────────────────────────────────
export async function actionUpdateAccountThreshold(data: {
  accountId: string;
  threshold: number;
}): Promise<ActionResult> {
  const parsed = AccountThresholdSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { accountId, threshold } = parsed.data;
  const supabase = createServerClient();

  const { error } = await supabase
    .from('accounts')
    .update({ low_balance_threshold: threshold })
    .eq('id', accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 14b: Update Saldo Rekening Langsung
// ───────────────────────────────────────────────
export async function actionUpdateAccountBalance(data: {
  accountId: string;
  balance: number;
}): Promise<ActionResult> {
  if (data.balance < 0) {
    return { success: false, error: 'Saldo tidak boleh negatif' };
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('accounts')
    .update({ balance: data.balance })
    .eq('id', data.accountId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 15: Ambil Data Perbandingan Silva vs Yoga
// ───────────────────────────────────────────────
export async function actionGetComparisonData(): Promise<ActionResult<{
  silva: { totalBalance: number; income: number; expense: number };
  yoga: { totalBalance: number; income: number; expense: number };
}>> {
  const supabase = createServerClient();
  const { startOfMonthString: startOfMonth, endOfMonthString: endOfMonth } = getJakartaDate();

  // Fetch all accounts and current month transactions for both profiles
  const [accountsRes, txRes] = await Promise.all([
    supabase.from('accounts').select('profile, balance'),
    supabase.from('transactions').select('profile, amount, type')
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth)
  ]);

  if (accountsRes.error) return { success: false, error: accountsRes.error.message };
  if (txRes.error) return { success: false, error: txRes.error.message };

  const res = {
    silva: { totalBalance: 0, income: 0, expense: 0 },
    yoga: { totalBalance: 0, income: 0, expense: 0 }
  };

  // Sum balances
  (accountsRes.data || []).forEach(acc => {
    const bal = parseFloat(acc.balance || '0');
    if (acc.profile === 'yoga') res.yoga.totalBalance += bal;
    else res.silva.totalBalance += bal;
  });

  // Sum monthly flow
  (txRes.data || []).forEach(tx => {
    const amt = parseFloat(tx.amount || '0');
    const isYoga = tx.profile === 'yoga';
    if (tx.type === 'INCOME') {
      if (isYoga) res.yoga.income += amt;
      else res.silva.income += amt;
    } else if (tx.type === 'EXPENSE') {
      if (isYoga) res.yoga.expense += amt;
      else res.silva.expense += amt;
    }
  });

  return { success: true, data: res };
}

// ───────────────────────────────────────────────
// ACTION 16: Buat Rekening Baru dari UI
// ───────────────────────────────────────────────
export async function actionCreateAccount(data: {
  name: string;
  type: 'CASH' | 'BANK' | 'E_WALLET';
  balance: number;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = AccountCreateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { name, type, balance } = parsed.data;
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const { data: acc, error } = await supabase
    .from('accounts')
    .insert([{ name, type, balance, profile }])
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  revalidateAll();
  return { success: true, data: { id: acc.id } };
}

// ───────────────────────────────────────────────
// ACTION 17: Import Mutasi dari CSV (Bulk Insert)
// ───────────────────────────────────────────────
export async function actionImportCSV(transactionsList: {
  accountId: string;
  categoryId?: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  date: string;
}[]): Promise<ActionResult> {
  const supabase = createServerClient();

  // Jalankan bulk inserts secara sekuensial lewat RPC agar saldo tetap ter-update
  for (const tx of transactionsList) {
    const { error } = await supabase.rpc('fn_create_transaction', {
      p_account_id:  tx.accountId,
      p_category_id: tx.categoryId ?? null,
      p_amount:      tx.amount,
      p_type:        tx.type,
      p_description: `[CSV Import] ${tx.description}`,
      p_date:        tx.date,
    });
    if (error) return { success: false, error: `Gagal mengimpor transaksi: ${error.message}` };
  }

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 18: Hapus Rekening (Soft Delete)
// ───────────────────────────────────────────────
export async function actionDeleteAccount(accountId: string): Promise<ActionResult> {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', accountId)
    .eq('profile', profile);

  if (error) return { success: false, error: error.message };

  revalidateAll();
  return { success: true, data: undefined };
}

// ───────────────────────────────────────────────
// ACTION 19: Salin Anggaran dari Bulan Sebelumnya
// ───────────────────────────────────────────────
export async function actionCopyPreviousMonthBudget(data: {
  currentMonth: number;
  currentYear: number;
}): Promise<ActionResult<{ copiedCount: number }>> {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  const { currentMonth, currentYear } = data;
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }

  // Fetch previous month budgets
  const { data: prevBudgets, error: fetchErr } = await supabase
    .from('budgets')
    .select('category_id, amount')
    .eq('profile', profile)
    .eq('month', prevMonth)
    .eq('year', prevYear);

  if (fetchErr) return { success: false, error: fetchErr.message };

  if (!prevBudgets || prevBudgets.length === 0) {
    return { success: false, error: 'Tidak ditemukan anggaran pada bulan sebelumnya untuk disalin.' };
  }

  const upsertRows = prevBudgets.map(b => ({
    profile,
    category_id: b.category_id,
    amount: b.amount,
    month: currentMonth,
    year: currentYear
  }));

  const { error: upsertErr } = await supabase
    .from('budgets')
    .upsert(upsertRows, { onConflict: 'profile,category_id,month,year' });

  if (upsertErr) return { success: false, error: upsertErr.message };

  revalidateAll();
  return { success: true, data: { copiedCount: upsertRows.length } };
}

// ───────────────────────────────────────────────
// ACTION 20: Simpan Parameter Keuangan Pengguna
// ───────────────────────────────────────────────
export interface CustomExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export interface UserParametersData {
  monthlySalary: number;
  monthlySavingsGoal: number;
  operatingAccountId?: string;
  savingsAccountId?: string;
  expenses: {
    parentAllowance: number;
    motorService: number;
    motorFuel: number;
    bpjsHealth: number;
    internetBill: number;
    pocketMoney: number;
    otherExpenses: number;
    customExpenses?: CustomExpenseItem[];
  };
}

export async function actionSaveUserParameters(params: UserParametersData): Promise<ActionResult> {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  // Get current simulator config state if exists
  const { data: existing } = await supabase
    .from('simulator_configs')
    .select('state')
    .eq('profile', profile)
    .maybeSingle();

  const currentState = existing?.state || {};
  const newState = {
    ...currentState,
    userParameters: params,
    updatedAt: new Date().toISOString()
  };

  const { error } = await supabase
    .from('simulator_configs')
    .upsert({
      profile,
      state: newState,
      updated_at: new Date().toISOString()
    }, { onConflict: 'profile' });

  if (error) {
    console.error('[actionSaveUserParameters] Supabase upsert error:', JSON.stringify(error));
    return { success: false, error: error.message };
  }

  revalidateAll();
  return { success: true, data: undefined };
}

