import { describe, it, expect } from 'vitest';
import { formatRupiah, formatDate, formatDateShort, parseFormattedNumber } from '../format';

describe('formatRupiah', () => {
  it('formats positive numbers to Indonesian Rupiah currency format', () => {
    const formatted = formatRupiah(1500000);
    // Replace non-breaking space (char code 160) with standard space for reliable assertion
    const normalized = formatted.replace(/\u00a0/g, ' ');
    expect(normalized).toMatch(/Rp\s?1\.500\.000/);
  });

  it('formats zero correctly', () => {
    const formatted = formatRupiah(0).replace(/\u00a0/g, ' ');
    expect(formatted).toMatch(/Rp\s?0/);
  });

  it('formats string numeric values', () => {
    const formatted = formatRupiah('250000').replace(/\u00a0/g, ' ');
    expect(formatted).toMatch(/Rp\s?250\.000/);
  });

  it('returns "Rp 0" for invalid non-numeric string or NaN', () => {
    expect(formatRupiah('invalid_value')).toBe('Rp 0');
    expect(formatRupiah(NaN)).toBe('Rp 0');
  });

  it('handles negative values appropriately', () => {
    const formatted = formatRupiah(-50000).replace(/\u00a0/g, ' ');
    expect(formatted).toContain('50.000');
  });
});

describe('formatDate', () => {
  it('formats YYYY-MM-DD string to Indonesian short date', () => {
    const res = formatDate('2026-06-30');
    expect(res).toContain('30');
    expect(res).toContain('Jun');
    expect(res).toContain('2026');
  });

  it('formats Date object correctly', () => {
    const date = new Date(2026, 0, 15); // 15 Jan 2026
    const res = formatDate(date);
    expect(res).toContain('15');
    expect(res).toContain('Jan');
    expect(res).toContain('2026');
  });

  it('returns "-" for empty or invalid date input', () => {
    expect(formatDate('')).toBe('-');
    expect(formatDate('invalid-date')).toBe('-');
  });
});

describe('formatDateShort', () => {
  it('formats date into DD/MM/YYYY or 2-digit format', () => {
    const res = formatDateShort('2026-12-05');
    expect(res).toMatch(/05[/.]12[/.]2026/);
  });

  it('returns "-" for invalid date input', () => {
    expect(formatDateShort('')).toBe('-');
    expect(formatDateShort('not-a-date')).toBe('-');
  });
});

describe('parseFormattedNumber', () => {
  it('parses Indonesian thousand dot separators correctly', () => {
    expect(parseFormattedNumber('40.000')).toBe(40000);
    expect(parseFormattedNumber('1.500.000')).toBe(1500000);
    expect(parseFormattedNumber('10.000.000')).toBe(10000000);
  });

  it('parses comma-separated values', () => {
    expect(parseFormattedNumber('1,500,000')).toBe(1500000);
  });

  it('parses raw numbers and trimmed strings', () => {
    expect(parseFormattedNumber('12500')).toBe(12500);
    expect(parseFormattedNumber('  50000  ')).toBe(50000);
  });

  it('returns 0 for empty or invalid strings', () => {
    expect(parseFormattedNumber('')).toBe(0);
    expect(parseFormattedNumber('abc')).toBe(0);
  });
});
