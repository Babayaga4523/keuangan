import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  actionCreateTransaction,
  actionCreateTransfer,
  actionDeleteTransaction,
  actionFundSavingGoal,
  actionUpsertBudget,
  actionCreateAccount,
  actionUpdateAccountThreshold,
} from '../actions';
import * as supabaseServer from '../supabase-server';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../supabase-server', () => ({
  createServerClient: vi.fn(),
}));

const validUUID1 = '123e4567-e89b-12d3-a456-426614174000';
const validUUID2 = '987fcdeb-51a2-43f7-9012-345678901234';

describe('Server Actions - Financial Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRpc.mockReset();
    mockFrom.mockReset();

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      rpc: mockRpc,
      from: mockFrom,
    } as any);
  });

  describe('actionCreateTransaction', () => {
    it('returns error when input fails schema validation', async () => {
      const result = await actionCreateTransaction({
        accountId: 'invalid-id',
        amount: -5000,
        type: 'EXPENSE',
        date: '2026-07-01',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('successfully calls fn_create_transaction RPC on valid input', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 'new-tx-id-123',
        error: null,
      });

      const result = await actionCreateTransaction({
        accountId: validUUID1,
        amount: 50000,
        type: 'EXPENSE',
        description: 'Makan Siang',
        date: '2026-07-01',
      });

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('fn_create_transaction', {
        p_account_id: validUUID1,
        p_category_id: null,
        p_amount: 50000,
        p_type: 'EXPENSE',
        p_description: 'Makan Siang',
        p_date: '2026-07-01',
      });
    });

    it('returns error if Supabase RPC fails', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection error' },
      });

      const result = await actionCreateTransaction({
        accountId: validUUID1,
        amount: 50000,
        type: 'EXPENSE',
        date: '2026-07-01',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database connection error');
      }
    });
  });

  describe('actionCreateTransfer', () => {
    it('rejects transfer when source and destination are the same account', async () => {
      const result = await actionCreateTransfer({
        fromAccountId: validUUID1,
        toAccountId: validUUID1,
        amount: 100000,
        date: '2026-07-01',
      });

      expect(result.success).toBe(false);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('calls fn_create_transfer RPC on valid different accounts', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 'transfer-tx-id',
        error: null,
      });

      const result = await actionCreateTransfer({
        fromAccountId: validUUID1,
        toAccountId: validUUID2,
        amount: 250000,
        description: 'Transfer ke tabungan',
        date: '2026-07-01',
      });

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('fn_create_transfer', {
        p_from_account_id: validUUID1,
        p_to_account_id: validUUID2,
        p_amount: 250000,
        p_description: 'Transfer ke tabungan',
        p_date: '2026-07-01',
      });
    });
  });

  describe('actionDeleteTransaction', () => {
    it('returns error when ID is empty', async () => {
      const result = await actionDeleteTransaction('');
      expect(result.success).toBe(false);
    });

    it('calls fn_delete_transaction RPC with transaction ID', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await actionDeleteTransaction('tx-to-delete-123');
      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('fn_delete_transaction', {
        p_tx_id: 'tx-to-delete-123',
      });
    });
  });

  describe('actionFundSavingGoal', () => {
    it('calls fn_fund_saving_goal RPC and updates completion if target reached', async () => {
      mockRpc.mockResolvedValueOnce({ error: null });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_amount: 10000000, target_amount: 10000000 },
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'saving_goals') {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      });

      const result = await actionFundSavingGoal({
        accountId: validUUID1,
        goalId: validUUID2,
        amount: 2000000,
        description: 'Setor tabungan',
      });

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('fn_fund_saving_goal', {
        p_account_id: validUUID1,
        p_goal_id: validUUID2,
        p_amount: 2000000,
        p_description: 'Setor tabungan',
      });
    });
  });

  describe('actionUpsertBudget', () => {
    it('upserts budget to database', async () => {
      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'budget-123' },
            error: null,
          }),
        }),
      });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      const result = await actionUpsertBudget({
        categoryId: validUUID1,
        amount: 1500000,
        month: 7,
        year: 2026,
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('budgets');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          category_id: validUUID1,
          amount: 1500000,
          month: 7,
          year: 2026,
        }),
        { onConflict: 'category_id,month,year,profile' }
      );
    });
  });

  describe('actionCreateAccount', () => {
    it('inserts new account with profile into database', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-acc-id', name: 'Bank BCA' },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert });

      const result = await actionCreateAccount({
        name: 'Bank BCA',
        type: 'BANK',
        balance: 5000000,
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('accounts');
    });
  });

  describe('actionUpdateAccountThreshold', () => {
    it('updates min_balance_alert on accounts table', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockReturnValue({ update: mockUpdate });

      const result = await actionUpdateAccountThreshold({
        accountId: validUUID1,
        threshold: 300000,
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('accounts');
    });
  });
});
