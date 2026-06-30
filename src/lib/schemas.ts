import { z } from 'zod';

// ───────────────────────────────────────────────
// Schema: Transaksi INCOME / EXPENSE
// ───────────────────────────────────────────────
export const TransactionSchema = z.object({
  accountId:   z.string().uuid('ID akun tidak valid'),
  categoryId:  z.string().uuid('ID kategori tidak valid').optional(),
  amount:      z.coerce.number().positive('Jumlah harus lebih dari 0').max(999_999_999, 'Jumlah terlalu besar'),
  type:        z.enum(['INCOME', 'EXPENSE'], { error: 'Tipe harus INCOME atau EXPENSE' }),
  description: z.string().max(255, 'Deskripsi maksimal 255 karakter').optional(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
});

// ───────────────────────────────────────────────
// Schema: Transfer Antar Rekening
// ───────────────────────────────────────────────
export const TransferSchema = z
  .object({
    fromAccountId: z.string().uuid('ID akun sumber tidak valid'),
    toAccountId:   z.string().uuid('ID akun tujuan tidak valid'),
    amount:        z.coerce.number().positive('Jumlah harus lebih dari 0').max(999_999_999, 'Jumlah terlalu besar'),
    description:   z.string().max(255, 'Deskripsi maksimal 255 karakter').optional(),
    date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: 'Akun sumber dan tujuan tidak boleh sama',
    path: ['toAccountId'],
  });

// ───────────────────────────────────────────────
// Schema: Setor ke Target Tabungan
// ───────────────────────────────────────────────
export const SavingGoalFundSchema = z.object({
  accountId:   z.string().uuid('ID akun tidak valid'),
  goalId:      z.string().uuid('ID target tabungan tidak valid'),
  amount:      z.coerce.number().positive('Jumlah harus lebih dari 0').max(999_999_999, 'Jumlah terlalu besar'),
  description: z.string().max(255).optional(),
});

// ───────────────────────────────────────────────
// Schema: Buat Target Tabungan Baru
// ───────────────────────────────────────────────
export const SavingGoalCreateSchema = z.object({
  name:          z.string().min(1, 'Nama target wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  targetAmount:  z.coerce.number().positive('Jumlah target harus lebih dari 0').max(999_999_999_999),
  currentAmount: z.coerce.number().min(0, 'Jumlah tidak boleh negatif').default(0),
  deadline:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
});

// Inferred types
export type TransactionInput     = z.infer<typeof TransactionSchema>;
export type TransferInput        = z.infer<typeof TransferSchema>;
export type SavingGoalFundInput  = z.infer<typeof SavingGoalFundSchema>;
export type SavingGoalCreateInput = z.infer<typeof SavingGoalCreateSchema>;
