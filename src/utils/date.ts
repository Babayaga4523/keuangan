/**
 * Helper to get the current date info adjusted to the Asia/Jakarta timezone.
 */
export function getJakartaDate(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const getVal = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const yearStr = getVal('year');
  const monthStr = getVal('month');
  const dayStr = getVal('day');
  
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '07', 10);
  const day = parseInt(dayStr || '05', 10);
  
  return {
    year,
    month,
    day,
    dateString: `${yearStr}-${monthStr}-${dayStr}`, // YYYY-MM-DD
    startOfMonthString: `${yearStr}-${monthStr}-01`, // YYYY-MM-01
    endOfMonthString: `${yearStr}-${monthStr}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}` // YYYY-MM-DD (last day of month)
  };
}

/**
 * Get full Indonesian text representing day and date in Asia/Jakarta timezone.
 * E.g., "Senin, 6 Juli 2026"
 */
export function getJakartaFullDateString(date: Date = new Date()): string {
  const datePart = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  }).format(date);
  
  const timePart = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false
  }).format(date);

  return `${datePart} pukul ${timePart.replace(/\./g, ':')} WIB`;
}
