import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  actionUpdateTransaction,
  actionCreateRecurring,
  actionDeleteRecurring,
  actionExecuteRecurring,
  actionDeleteBudget,
  actionDeleteAccount,
  actionUpdateAccountBalance,
  actionGetComparisonData,
  actionImportCSV,
} from '../actions';
import * as supabaseServer from '../supabase-server';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../supabase-server', () => ({
  createServerClient: vi.fn(),
}));

const validUUID1 = '123e4567-e89b-12d3-a456-426614174000';
const validUUID2 = '987fcdeb-51a2-43f7-9012-345678901234';

describe('Server Actions - Extended Financial Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockReset();
    mockFrom.mockReset();

    const createChainableEq = (finalResult = { error: null }) => {
      const chain: any = {};
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.then = (resolve: any) => Promise.resolve(finalResult).then(resolve);
      return chain;
    };

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
        }),
      }),
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      rpc: mockRpc,
      from: mockFrom,
    } as any);
  });

  describe('actionUpdateTransaction', () => {
    it('calls fn_update_transaction RPC on valid payload', async () => {
      mockRpc.mockResolvedValueOnce({ error: null });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const result = await actionUpdateTransaction({
        id: validUUID1,
        amount: 85000,
        categoryId: validUUID2,
        description: 'Update makan malam',
        date: '2026-07-08',
      });

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('fn_update_transaction', {
        p_tx_id: validUUID1,
        p_amount: 85000,
        p_category_id: validUUID2,
        p_description: 'Update makan malam',
        p_date: '2026-07-08',
      });
    });
  });

  describe('actionCreateRecurring & actionDeleteRecurring', () => {
    it('creates recurring transaction item', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'rec-123' },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert });

      const result = await actionCreateRecurring({
        accountId: validUUID1,
        categoryId: validUUID2,
        amount: 300000,
        type: 'EXPENSE',
        description: 'Tagihan Listrik',
        frequency: 'MONTHLY',
        dayOfMonth: 15,
        nextDue: '2026-08-15',
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('recurring_transactions');
    });

    it('deletes recurring transaction item', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockReturnValue({ delete: mockDelete });

      const result = await actionDeleteRecurring('rec-123');
      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('recurring_transactions');
    });
  });

  describe('actionExecuteRecurring', () => {
    it('creates actual transaction and updates next_due date', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'rec-1',
              account_id: validUUID1,
              category_id: validUUID2,
              amount: 50000,
              type: 'EXPENSE',
              description: 'Spotify',
              frequency: 'MONTHLY',
              day_of_month: 10,
              next_due: '2026-07-10',
            },
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      mockRpc.mockResolvedValueOnce({ error: null });

      const result = await actionExecuteRecurring('rec-1');
      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('fn_create_transaction', expect.objectContaining({
        p_account_id: validUUID1,
        p_amount: 50000,
      }));
    });
  });

  describe('actionDeleteBudget', () => {
    it('deletes budget by ID', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockReturnValue({ delete: mockDelete });

      const result = await actionDeleteBudget('budget-1');
      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('budgets');
    });
  });

  describe('actionDeleteAccount & actionUpdateAccountBalance', () => {
    it('soft deletes account by setting is_active to false', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockReturnValue({ update: mockUpdate });

      const result = await actionDeleteAccount(validUUID1);
      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('accounts');
    });

    it('updates account balance directly', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockReturnValue({ update: mockUpdate });

      const result = await actionUpdateAccountBalance({
        accountId: validUUID1,
        balance: 1500000,
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('accounts');
    });

    it('rejects negative balance update', async () => {
      const result = await actionUpdateAccountBalance({
        accountId: validUUID1,
        balance: -100,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('tidak boleh negatif');
      }
    });
  });

  describe('actionGetComparisonData', () => {
    it('aggregates balances and flow for silva and yoga', async () => {
      const mockAccounts = [
        { profile: 'silva', balance: '2000000' },
        { profile: 'yoga', balance: '5000000' },
      ];

      const mockTransactions = [
        { profile: 'silva', amount: '1000000', type: 'INCOME' },
        { profile: 'silva', amount: '400000', type: 'EXPENSE' },
        { profile: 'yoga', amount: '6000000', type: 'INCOME' },
        { profile: 'yoga', amount: '1500000', type: 'EXPENSE' },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
          };
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({ data: mockTransactions, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await actionGetComparisonData();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.silva.totalBalance).toBe(2000000);
        expect(result.data.yoga.totalBalance).toBe(5000000);
        expect(result.data.silva.income).toBe(1000000);
        expect(result.data.yoga.income).toBe(6000000);
      }
    });
  });

  describe('actionImportCSV', () => {
    it('executes sequential RPC imports for each transaction in list', async () => {
      mockRpc.mockResolvedValue({ error: null });

      const txList = [
        { accountId: validUUID1, amount: 25000, type: 'EXPENSE' as const, description: 'Kopi', date: '2026-07-01' },
        { accountId: validUUID1, amount: 50000, type: 'EXPENSE' as const, description: 'Makan', date: '2026-07-02' },
      ];

      const result = await actionImportCSV(txList);
      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });
});
