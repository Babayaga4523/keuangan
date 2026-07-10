// Replicate the exact date calculation from route.ts
const bill_next_due = '2026-07-11';

// getJakartaMidnightDate:
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const jakartaDateStr = formatter.format(new Date()); // e.g. "2026-07-10"
const todayJakarta = new Date(`${jakartaDateStr}T00:00:00+07:00`);

const nextDueJakarta = new Date(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(bill_next_due)) + 'T00:00:00+07:00'
);

const diffDays = Math.round((nextDueJakarta.getTime() - todayJakarta.getTime()) / 86400000);

console.log("jakartaDateStr:", jakartaDateStr);
console.log("todayJakarta absolute time:", todayJakarta.toISOString());
console.log("nextDueJakarta absolute time:", nextDueJakarta.toISOString());
console.log("diffDays:", diffDays);
