import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import * as supabaseServer from '@/lib/supabase-server';
import * as actions from '@/lib/actions';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/actions', () => ({
  actionExecuteRecurring: vi.fn(),
}));

describe('POST /api/bills/mark-paid', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' };
  });

  it('returns 400 when billId or nextDue is missing', async () => {
    const req = new Request('http://localhost:3000/api/bills/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ billId: 'bill-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when bill is not found', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const req = new Request('http://localhost:3000/api/bills/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ billId: 'bill-404', nextDue: '2026-07-20' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user profile is not authorized', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { profile: 'other_user', notify_profiles: [], next_due: '2026-07-20' },
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const req = new Request('http://localhost:3000/api/bills/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ billId: 'bill-1', nextDue: '2026-07-20' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('handles idempotency if bill is already paid for that date', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { profile: 'silva', notify_profiles: [], next_due: '2026-08-20' },
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const req = new Request('http://localhost:3000/api/bills/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ billId: 'bill-1', nextDue: '2026-07-20' }), // Older nextDue
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.code).toBe('ALREADY_PAID');
    expect(actions.actionExecuteRecurring).not.toHaveBeenCalled();
  });

  it('executes recurring bill successfully on authorized matching nextDue', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { profile: 'silva', notify_profiles: [], next_due: '2026-07-20' },
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    vi.mocked(actions.actionExecuteRecurring).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const req = new Request('http://localhost:3000/api/bills/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ billId: 'bill-1', nextDue: '2026-07-20' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(actions.actionExecuteRecurring).toHaveBeenCalledWith('bill-1');
  });
});
