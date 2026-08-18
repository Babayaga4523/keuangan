import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actionSaveSimulatorConfig } from '../simulator';
import * as supabaseServer from '@/lib/supabase-server';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}));

describe('Simulator Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully saves simulator configuration state', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const testState = {
      dreamCost: 500000000,
      monthlySavings: 10000000,
      expectedReturn: 8,
    };

    const result = await actionSaveSimulatorConfig(testState, 'acc-123');

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('simulator_configs');
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        profile: 'silva',
        selected_account_id: 'acc-123',
        state: testState,
      },
      { onConflict: 'profile' }
    );
  });

  it('handles database error when saving config', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockUpsert = vi.fn().mockResolvedValue({ error: { message: 'Database failure' } });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const result = await actionSaveSimulatorConfig({}, null);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Database failure');
    }
    consoleSpy.mockRestore();
  });
});
