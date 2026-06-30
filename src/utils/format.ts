/**
 * Format number or string to Rupiah currency format.
 * E.g., 1500000 -> "Rp 1.500.000"
 */
export function formatRupiah(value: number | string): string {
  const numberValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numberValue)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numberValue);
}

/**
 * Format string date or Date object to Indonesian local date.
 * E.g., "2026-06-30" -> "30 Jun 2026"
 */
export function formatDate(dateInput: string | Date): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date).replace(/\./g, '');
}
export function formatDateShort(dateInput: string | Date): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Parse a formatted string number containing thousands separators (dots or commas) to a clean float.
 * E.g., "40.000" -> 40000, "1.500.000" -> 1500000, "12500" -> 12500
 */
export function parseFormattedNumber(val: string): number {
  if (!val) return 0;
  let cleaned = val.trim();
  
  // If it has dot and no comma, check if it's likely thousands separator (e.g. 40.000)
  if (cleaned.includes('.') && !cleaned.includes(',')) {
    const parts = cleaned.split('.');
    // If the last part has exactly 3 digits, treat all dots as thousands separators
    if (parts[parts.length - 1].length === 3) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else {
    // If it uses comma as thousands separator, remove commas
    cleaned = cleaned.replace(/,/g, '');
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
