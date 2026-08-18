import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import * as supabaseServer from '@/lib/supabase-server';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

describe('GET /api/cron/bill-reminder', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      CRON_SECRET: 'test-cron-secret',
      VAPID_PUBLIC_KEY: 'test-public-key',
      VAPID_PRIVATE_KEY: 'test-private-key',
      VAPID_SUBJECT: 'mailto:test@keuangan.id',
    };
  });

  it('rejects request without valid Bearer token', async () => {
    const req = new Request('http://localhost:3000/api/cron/bill-reminder', {
      headers: { authorization: 'Bearer wrong-secret' },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('handles active bills and processes notifications for matching offsets', async () => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

    const mockBills = [
      {
        id: 'bill-1',
        description: 'Tagihan Listrik',
        amount: '250000',
        next_due: todayStr, // Due today (offset 0)
        is_active: true,
        reminder_offsets: [0],
        profile: 'silva',
        notify_profiles: ['silva'],
      },
    ];

    const mockFrom = vi.fn((table: string) => {
      if (table === 'recurring_transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockBills, error: null }),
          }),
        };
      }
      if (table === 'bill_reminder_logs') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return {
          select: vi.fn().mockReturnValue(chain),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  endpoint: 'https://push.example.com',
                  p256dh: 'p256dh-key',
                  auth: 'auth-key',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });

    vi.mocked(supabaseServer.createServerClient).mockReturnValue({
      from: mockFrom,
    } as any);

    const req = new Request('http://localhost:3000/api/cron/bill-reminder', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
