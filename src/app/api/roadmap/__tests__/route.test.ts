import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import * as supabaseServer from '@/lib/supabase-server';
import { cookies } from 'next/headers';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}));

describe('GET /api/roadmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns showRoadmap: false for profile other than yoga', async () => {
    vi.mocked(cookies).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue({ value: 'silva' }),
      set: vi.fn(),
    } as any);

    const res = await GET();
    const json = await res.json();
    expect(json.showRoadmap).toBe(false);
  });

  it('calculates blueprint milestones for profile yoga', async () => {
    vi.mocked(cookies).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue({ value: 'yoga' }),
      set: vi.fn(),
    } as any);

    const mockAccounts = [{ balance: '6500000' }];
    const mockTransactions = [
      {
        description: 'Gaji Juli',
        amount: '6000000',
        type: 'INCOME',
        transaction_date: '2026-07-25',
      },
    ];

    const mockFrom = vi.fn((table: string) => {
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockTransactions, error: null }),
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

    const res = await GET();
    const json = await res.json();
    expect(json.showRoadmap).toBe(true);
    expect(json.milestones).toBeDefined();
    expect(json.milestones.length).toBeGreaterThan(0);
    expect(json.currentBalance).toBe(6500000);
  });
});
