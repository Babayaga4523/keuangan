import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as subscribePost } from '../subscribe/route';
import { POST as unsubscribePost } from '../unsubscribe/route';
import * as supabaseServer from '@/lib/supabase-server';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}));

describe('Push Notification Endpoints', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-key' };
  });

  describe('POST /api/push/subscribe', () => {
    it('returns 400 when subscription data is missing or empty', async () => {
      const req = new Request('http://localhost:3000/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await subscribePost(req);
      expect(res.status).toBe(400);
    });

    it('successfully saves push subscription with profile', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const req = new Request('http://localhost:3000/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        }),
      });

      const res = await subscribePost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: 'silva',
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        }),
        { onConflict: 'endpoint,profile' }
      );
    });
  });

  describe('POST /api/push/unsubscribe', () => {
    it('returns 400 if endpoint is missing', async () => {
      const req = new Request('http://localhost:3000/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await unsubscribePost(req);
      expect(res.status).toBe(400);
    });

    it('deletes subscription by endpoint', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const req = new Request('http://localhost:3000/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/test' }),
      });

      const res = await unsubscribePost(req);
      expect(res.status).toBe(200);
      expect(mockFrom).toHaveBeenCalledWith('push_subscriptions');
    });
  });
});
