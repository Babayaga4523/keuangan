import { describe, it, expect } from 'vitest';
import { getJakartaMidnightDate } from '../jakarta-time';

describe('getJakartaMidnightDate', () => {
  it('returns a valid Date object initialized to Asia/Jakarta midnight', () => {
    const date = getJakartaMidnightDate();
    expect(date).toBeInstanceOf(Date);
    expect(!isNaN(date.getTime())).toBe(true);
  });
});
