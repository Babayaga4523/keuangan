import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import * as supabaseServer from '@/lib/supabase-server';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}));

describe('GET /api/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates predictions and returns anomalies payload', async () => {
    const mockCategories = [
      { id: 'cat-1', name: 'Makanan' },
      { id: 'cat-2', name: 'Transportasi' },
    ];

    const mockTransactions = [
      { amount: '50000', category_id: 'cat-1', transaction_date: '2026-07-01' },
      { amount: '75000', category_id: 'cat-1', transaction_date: '2026-07-08' },
      { amount: '60000', category_id: 'cat-1', transaction_date: '2026-07-15' },
      { amount: '250000', category_id: 'cat-1', transaction_date: '2026-07-22' },
    ];

    const mockAccounts = [
      { id: 'acc-1', name: 'BCA Utama', balance: '10000000' },
    ];

    const mockRecurring = [
      { amount: '5000000', account_id: 'acc-1' },
    ];

    const mockFrom = vi.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
        };
      }
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({ data: [{ amount: '500000' }], error: null }),
                  // when called with 1 gte for anomaly
                  then: (resolve: any) => resolve({ data: mockTransactions, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
            }),
          }),
        };
      }
      if (table === 'recurring_transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({ data: mockRecurring, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty('anomalies');
    expect(json).toHaveProperty('prediction');
    expect(json.prediction).toHaveProperty('projectedEndBalance');
    expect(json.prediction).toHaveProperty('status');
  });

  it('handles errors gracefully and returns 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(supabaseServer.createServerClient).mockImplementation(() => {
      throw new Error('Supabase unreachable');
    });

    const response = await GET();
    expect(response.status).toBe(500);

    const json = await response.json();
    expect(json.error).toBe('Supabase unreachable');
    consoleSpy.mockRestore();
  });
});
