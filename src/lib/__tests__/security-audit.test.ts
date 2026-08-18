import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getValidatedProfile,
  actionDeleteSavingGoal,
  actionUpdateSavingGoal,
  actionDeleteBudget,
  actionDeleteRecurring,
  actionUpdateAccountBalance,
  actionDeleteAccount,
} from '../actions';
import { GET as cronGet } from '@/app/api/cron/bill-reminder/route';
import {
  TransactionSchema,
  TransferSchema,
  SavingGoalCreateSchema,
  BudgetSchema,
  AccountThresholdSchema,
} from '../schemas';
import * as supabaseServer from '../supabase-server';
import { cookies } from 'next/headers';

vi.mock('../supabase-server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

const validUUID1 = '123e4567-e89b-12d3-a456-426614174000';
const validUUID2 = '987fcdeb-51a2-43f7-9012-345678901234';

describe('Automated Security Audit & Penetration Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('1. Profile Cookie Tampering & SQLi Resistance (Whitelist Protection)', () => {
    it('allows valid profile "silva"', async () => {
      vi.mocked(cookies).mockResolvedValueOnce({
        get: vi.fn().mockReturnValue({ value: 'silva' }),
      } as any);

      const profile = await getValidatedProfile();
      expect(profile).toBe('silva');
    });

    it('allows valid profile "yoga"', async () => {
      vi.mocked(cookies).mockResolvedValueOnce({
        get: vi.fn().mockReturnValue({ value: 'yoga' }),
      } as any);

      const profile = await getValidatedProfile();
      expect(profile).toBe('yoga');
    });

    it('sanitizes and neutralizes malicious cookie injections to safe default', async () => {
      const maliciousPayloads = [
        "admin' OR '1'='1",
        '<script>alert(1)</script>',
        '../../etc/passwd',
        'super_admin',
        'yoga; DROP TABLE users;--',
        "'; SELECT pg_sleep(5);--",
        "' UNION SELECT * FROM accounts--",
        '',
        undefined,
      ];

      for (const payload of maliciousPayloads) {
        vi.mocked(cookies).mockResolvedValueOnce({
          get: vi.fn().mockReturnValue(payload ? { value: payload } : undefined),
        } as any);

        const profile = await getValidatedProfile();
        expect(profile).toBe('silva'); // Must strictly fall back to default profile
      }
    });
  });

  describe('2. IDOR / Broken Object-Level Authorization (BOLA) Defense', () => {
    it('actionDeleteSavingGoal scopes deletion by active profile', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'silva' }),
      } as any);

      const mockEqProfile = vi.fn().mockResolvedValue({ error: null });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqProfile });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const result = await actionDeleteSavingGoal(validUUID1);
      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('saving_goals');
      expect(mockEqId).toHaveBeenCalledWith('id', validUUID1);
      expect(mockEqProfile).toHaveBeenCalledWith('profile', 'silva');
    });

    it('actionUpdateSavingGoal blocks cross-profile modification if record belongs to another profile', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'silva' }),
      } as any);

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const result = await actionUpdateSavingGoal(validUUID1, 1000000);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('tidak memiliki akses');
      }
    });

    it('actionDeleteBudget scopes deletion by active profile', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'yoga' }),
      } as any);

      const mockEqProfile = vi.fn().mockResolvedValue({ error: null });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqProfile });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const result = await actionDeleteBudget(validUUID1);
      expect(result.success).toBe(true);
      expect(mockEqProfile).toHaveBeenCalledWith('profile', 'yoga');
    });

    it('actionUpdateAccountBalance scopes update by active profile', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'silva' }),
      } as any);

      const mockEqProfile = vi.fn().mockResolvedValue({ error: null });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqProfile });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const result = await actionUpdateAccountBalance({
        accountId: validUUID1,
        balance: 2500000,
      });

      expect(result.success).toBe(true);
      expect(mockEqProfile).toHaveBeenCalledWith('profile', 'silva');
    });

    it('actionDeleteAccount scopes soft delete by active profile', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'yoga' }),
      } as any);

      const mockEqProfile = vi.fn().mockResolvedValue({ error: null });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqProfile });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const result = await actionDeleteAccount(validUUID1);
      expect(result.success).toBe(true);
      expect(mockEqProfile).toHaveBeenCalledWith('profile', 'yoga');
    });
  });

  describe('3. Brute Force & Token Dictionary Attack Resistance', () => {
    it('blocks request when CRON_SECRET is not configured on server', async () => {
      delete process.env.CRON_SECRET;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key';

      const req = new Request('http://localhost:3000/api/cron/bill-reminder', {
        headers: { authorization: 'Bearer undefined' },
      });

      const res = await cronGet(req);
      expect(res.status).toBe(500);
    });

    it('rejects a rapid dictionary / brute force sequence of 20 guessed tokens', async () => {
      process.env.CRON_SECRET = 'actual-production-secret-key-999';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key';

      const dictionaryGuesses = [
        'Bearer admin',
        'Bearer password',
        'Bearer 123456',
        'Bearer secret',
        'Bearer cron_secret',
        'Bearer test',
        'Bearer supersecret',
        'Bearer root',
        'Bearer opin_cron',
        'Bearer api_key',
        'Bearer token',
        'Bearer default',
        'Bearer master',
        'Bearer 12345678',
        'Bearer letmein',
        'Bearer qwerty',
        'Bearer secret123',
        'Bearer cron',
        'Bearer null',
        'Bearer undefined',
      ];

      for (const authHeader of dictionaryGuesses) {
        const req = new Request('http://localhost:3000/api/cron/bill-reminder', {
          headers: { authorization: authHeader },
        });
        const res = await cronGet(req);
        expect(res.status).toBe(401);
      }
    });

    it('authorizes successfully only on exact matching Bearer secret', async () => {
      process.env.CRON_SECRET = 'exact-valid-secret-12345';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key';
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-vapid-public-key';
      process.env.VAPID_PRIVATE_KEY = 'test-vapid-private-key';

      const mockFrom = vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockImplementation(() => ({
          lte: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }));

      vi.mocked(supabaseServer.createServerClient).mockReturnValue({
        from: mockFrom,
      } as any);

      const req = new Request('http://localhost:3000/api/cron/bill-reminder', {
        headers: { authorization: 'Bearer exact-valid-secret-12345' },
      });
      const res = await cronGet(req);
      expect(res.status).toBe(200);
    });
  });

  describe('4. Comprehensive SQL Injection & Malformed Input Pentest', () => {
    const sqliPayloads = [
      "1' OR '1'='1",
      "'; DROP TABLE accounts;--",
      "' UNION SELECT username, password FROM users--",
      "1' AND SLEEP(5)--",
      "'; SELECT pg_sleep(5);--",
      "' OR 1=1#",
      "' AND 1=0 UNION ALL SELECT NULL, NULL, NULL--",
      "admin'--",
      "123' OR 'a'='a",
      "<script>alert(1)</script>",
      "../../etc/passwd",
    ];

    it('neutralizes SQLi payloads in TransactionSchema (UUID & numeric types)', () => {
      for (const badPayload of sqliPayloads) {
        // Bad account ID
        const resultId = TransactionSchema.safeParse({
          accountId: badPayload,
          amount: 50000,
          type: 'EXPENSE',
          date: '2026-07-08',
        });
        expect(resultId.success).toBe(false);

        // Bad amount
        const resultAmount = TransactionSchema.safeParse({
          accountId: validUUID1,
          amount: badPayload,
          type: 'EXPENSE',
          date: '2026-07-08',
        });
        expect(resultAmount.success).toBe(false);
      }
    });

    it('neutralizes SQLi payloads in SavingGoalCreateSchema', () => {
      for (const badPayload of sqliPayloads) {
        const result = SavingGoalCreateSchema.safeParse({
          name: '', // Empty name
          targetAmount: badPayload,
          deadline: badPayload,
        });
        expect(result.success).toBe(false);
      }
    });

    it('neutralizes SQLi payloads in BudgetSchema', () => {
      for (const badPayload of sqliPayloads) {
        const result = BudgetSchema.safeParse({
          categoryId: badPayload,
          amount: 100000,
          month: 7,
          year: 2026,
        });
        expect(result.success).toBe(false);
      }
    });

    it('neutralizes SQLi payloads in AccountThresholdSchema', () => {
      for (const badPayload of sqliPayloads) {
        const result = AccountThresholdSchema.safeParse({
          accountId: badPayload,
          threshold: 50000,
        });
        expect(result.success).toBe(false);
      }
    });

    it('rejects financial manipulation: negative numbers, NaN, and extreme overflows', () => {
      const invalidAmounts = [-1, -50000, 0, NaN, Infinity, 1_000_000_000_000];

      for (const amount of invalidAmounts) {
        const result = TransactionSchema.safeParse({
          accountId: validUUID1,
          amount,
          type: 'EXPENSE',
          date: '2026-07-08',
        });
        expect(result.success).toBe(false);
      }
    });

    it('rejects same source and destination account ID in TransferSchema', () => {
      const result = TransferSchema.safeParse({
        fromAccountId: validUUID1,
        toAccountId: validUUID1, // Same account
        amount: 100000,
        date: '2026-07-08',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('tidak boleh sama');
      }
    });

    it('rejects invalid date format / SQLi injection in date parameters', () => {
      const badDates = [
        '08-07-2026',
        '2026/07/08',
        '2026-7-8',
        '2026-07-08; DROP TABLE accounts',
        "2026-07-08' OR '1'='1",
        'today',
      ];

      for (const date of badDates) {
        const result = TransactionSchema.safeParse({
          accountId: validUUID1,
          amount: 50000,
          type: 'EXPENSE',
          date,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('5. Secrets & Environment Configuration Safety', () => {
    it('throws error when environment keys are missing instead of using hardcoded secrets', async () => {
      const actual = await vi.importActual<typeof import('../supabase-server')>('../supabase-server');
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => {
        actual.createServerClient();
      }).toThrowError(/Supabase configuration error/);
    });
  });
});
