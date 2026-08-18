import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import * as supabaseServer from '@/lib/supabase-server';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}));

describe('GET /api/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns accounts and categories list on success', async () => {
    const mockAccounts = [
      { id: 'acc-1', name: 'Cash', balance: 500000, type: 'CASH' },
      { id: 'acc-2', name: 'BCA', balance: 10000000, type: 'BANK' },
    ];

    const mockCategories = [
      { id: 'cat-1', name: 'Makanan', type: 'EXPENSE' },
      { id: 'cat-2', name: 'Gaji', type: 'INCOME' },
    ];

    const mockFrom = vi.fn((table: string) => {
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
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

    const data = await response.json();
    expect(data.accounts).toHaveLength(2);
    expect(data.categories).toHaveLength(2);
    expect(data.accounts[0].name).toBe('Cash');
  });

  it('returns 500 status when database query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
          }),
        }),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const response = await GET();
    expect(response.status).toBe(500);

    const json = await response.json();
    expect(json.error).toBeDefined();
    consoleSpy.mockRestore();
  });
});
