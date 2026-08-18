import { describe, it, expect } from 'vitest';
import { getJakartaDate, getJakartaFullDateString } from '../date';

describe('getJakartaDate', () => {
  it('returns valid year, month, day, and formatted date strings', () => {
    const fixedDate = new Date('2026-07-15T12:00:00Z');
    const result = getJakartaDate(fixedDate);

    expect(result).toHaveProperty('year');
    expect(result).toHaveProperty('month');
    expect(result).toHaveProperty('day');
    expect(result).toHaveProperty('dateString');
    expect(result).toHaveProperty('startOfMonthString');
    expect(result).toHaveProperty('endOfMonthString');

    expect(result.dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.startOfMonthString).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('correctly calculates end of month for 31-day and 30-day months', () => {
    // January (31 days)
    const janDate = new Date('2026-01-15T10:00:00Z');
    const janResult = getJakartaDate(janDate);
    expect(janResult.endOfMonthString).toBe('2026-01-31');

    // April (30 days)
    const aprDate = new Date('2026-04-10T10:00:00Z');
    const aprResult = getJakartaDate(aprDate);
    expect(aprResult.endOfMonthString).toBe('2026-04-30');
  });

  it('correctly handles February in non-leap year (2025/2026)', () => {
    const febDate = new Date('2026-02-10T10:00:00Z');
    const febResult = getJakartaDate(febDate);
    expect(febResult.endOfMonthString).toBe('2026-02-28');
  });
});

describe('getJakartaFullDateString', () => {
  it('returns full formatted Indonesian date with WIB indicator', () => {
    const fixedDate = new Date('2026-08-17T03:00:00Z'); // 10:00 WIB
    const result = getJakartaFullDateString(fixedDate);

    expect(result).toContain('Agustus');
    expect(result).toContain('2026');
    expect(result).toContain('WIB');
    expect(result).toContain('pukul');
  });
});
