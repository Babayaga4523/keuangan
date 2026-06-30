'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './supabase-server';
import { cookies } from 'next/headers';
import { TransactionSchema, TransferSchema, SavingGoalFundSchema, SavingGoalCreateSchema } from './schemas';
import type { ActionResult } from '@/types/finance';

// Helper: revalidate semua halaman yang terdampak
function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/transaksi');
  revalidatePath('/laporan');
  revalidatePath('/tabungan');
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
}): Promise<ActionResult<{ id: string }>> {
  const parsed = TransactionSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { accountId, categoryId, amount, type, description, date } = parsed.data;
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
