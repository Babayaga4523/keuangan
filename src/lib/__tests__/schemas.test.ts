import { describe, it, expect } from 'vitest';
import {
  TransactionSchema,
  TransferSchema,
  SavingGoalFundSchema,
  SavingGoalCreateSchema,
  UpdateTransactionSchema,
  BudgetSchema,
  RecurringSchema,
  AccountThresholdSchema,
  AccountCreateSchema,
} from '../schemas';

const validUUID1 = '123e4567-e89b-12d3-a456-426614174000';
const validUUID2 = '987fcdeb-51a2-43f7-9012-345678901234';

describe('TransactionSchema', () => {
  it('validates a valid INCOME transaction', () => {
    const validData = {
      accountId: validUUID1,
      categoryId: validUUID2,
      amount: 500000,
      type: 'INCOME',
      description: 'Gaji Bulanan',
      date: '2026-07-01',
    };

    const result = TransactionSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('validates a valid EXPENSE transaction without optional fields', () => {
    const validData = {
      accountId: validUUID1,
      amount: 75000,
      type: 'EXPENSE',
      date: '2026-07-05',
    };

    const result = TransactionSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('fails when amount is zero or negative', () => {
    const invalidZero = {
      accountId: validUUID1,
      amount: 0,
      type: 'EXPENSE',
      date: '2026-07-05',
    };
    expect(TransactionSchema.safeParse(invalidZero).success).toBe(false);

    const invalidNegative = {
      accountId: validUUID1,
      amount: -10000,
      type: 'EXPENSE',
      date: '2026-07-05',
    };
    expect(TransactionSchema.safeParse(invalidNegative).success).toBe(false);
  });

  it('fails with invalid date format', () => {
    const invalidDate = {
      accountId: validUUID1,
      amount: 10000,
      type: 'EXPENSE',
      date: '05/07/2026',
    };
    expect(TransactionSchema.safeParse(invalidDate).success).toBe(false);
  });

  it('fails with invalid UUID accountId', () => {
    const invalidAccount = {
      accountId: 'not-a-uuid',
      amount: 10000,
      type: 'EXPENSE',
      date: '2026-07-05',
    };
    expect(TransactionSchema.safeParse(invalidAccount).success).toBe(false);
  });
});

describe('UpdateTransactionSchema', () => {
  it('validates transaction updates with valid ID and fields', () => {
    const validUpdate = {
      id: validUUID1,
      amount: 120000,
      categoryId: validUUID2,
      description: 'Update catatan belanja',
      date: '2026-07-06',
    };

    const result = UpdateTransactionSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });
});

describe('TransferSchema', () => {
  it('validates transfer between two different accounts', () => {
    const validTransfer = {
      fromAccountId: validUUID1,
      toAccountId: validUUID2,
      amount: 250000,
      description: 'Pindah dana tabungan',
      date: '2026-07-05',
    };

    const result = TransferSchema.safeParse(validTransfer);
    expect(result.success).toBe(true);
  });

  it('rejects transfer when fromAccountId and toAccountId are identical', () => {
    const sameAccountTransfer = {
      fromAccountId: validUUID1,
      toAccountId: validUUID1,
      amount: 100000,
      date: '2026-07-05',
    };

    const result = TransferSchema.safeParse(sameAccountTransfer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('tidak boleh sama');
    }
  });
});

describe('SavingGoalCreateSchema & SavingGoalFundSchema', () => {
  it('validates saving goal creation', () => {
    const validGoal = {
      name: 'Dana Darurat 2026',
      targetAmount: 50000000,
      currentAmount: 10000000,
      deadline: '2026-12-31',
    };

    const result = SavingGoalCreateSchema.safeParse(validGoal);
    expect(result.success).toBe(true);
  });

  it('validates saving goal funding', () => {
    const validFund = {
      accountId: validUUID1,
      goalId: validUUID2,
      amount: 1000000,
      description: 'Setoran bulanan',
    };

    const result = SavingGoalFundSchema.safeParse(validFund);
    expect(result.success).toBe(true);
  });
});

describe('BudgetSchema', () => {
  it('validates budget entry with valid month (1-12) and year', () => {
    const validBudget = {
      categoryId: validUUID1,
      amount: 2000000,
      month: 7,
      year: 2026,
    };

    const result = BudgetSchema.safeParse(validBudget);
    expect(result.success).toBe(true);
  });

  it('rejects invalid month (e.g. 13 or 0)', () => {
    expect(
      BudgetSchema.safeParse({
        categoryId: validUUID1,
        amount: 2000000,
        month: 13,
        year: 2026,
      }).success
    ).toBe(false);
  });
});

describe('RecurringSchema', () => {
  it('validates recurring transaction with DAILY, WEEKLY, or MONTHLY frequency', () => {
    const validRecurring = {
      accountId: validUUID1,
      amount: 150000,
      type: 'EXPENSE',
      description: 'Langganan Internet',
      frequency: 'MONTHLY',
      dayOfMonth: 20,
      nextDue: '2026-08-20',
    };

    const result = RecurringSchema.safeParse(validRecurring);
    expect(result.success).toBe(true);
  });
});

describe('AccountCreateSchema & AccountThresholdSchema', () => {
  it('validates account creation with CASH, BANK, or E_WALLET', () => {
    const validAccount = {
      name: 'Bank BCA',
      type: 'BANK',
      balance: 10000000,
    };

    const result = AccountCreateSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
  });

  it('validates account threshold setter', () => {
    const validThreshold = {
      accountId: validUUID1,
      threshold: 500000,
    };

    const result = AccountThresholdSchema.safeParse(validThreshold);
    expect(result.success).toBe(true);
  });
});
