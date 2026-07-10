export const getJakartaMidnightDate = (): Date => {
  // en-CA formats to standard YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const jakartaDateStr = formatter.format(new Date()); // e.g., "2026-07-10"
  return new Date(`${jakartaDateStr}T00:00:00+07:00`); // Instant absolut WIB
};
