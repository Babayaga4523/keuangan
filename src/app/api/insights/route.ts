import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getJakartaDate } from '@/utils/date';

function getStartOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday to get Monday
  const startOfWeek = new Date(d.setDate(diff));
  return startOfWeek.toISOString().split('T')[0];
}

export async function GET() {
  try {
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // ─────────────────────────────────────────────────────────────
    // MODUL A: ANOMALY DETECTOR
    // ─────────────────────────────────────────────────────────────
    
    // 5 weeks ago in milliseconds
    const fiveWeeksAgo = new Date(Date.now() - 5 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch categories and transactions
    const [categoriesRes, transactionsRes] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase.from('transactions')
        .select('amount, category_id, transaction_date')
        .eq('profile', profile)
        .eq('type', 'EXPENSE')
        .gte('transaction_date', fiveWeeksAgo)
    ]);

    const categoriesMap = new Map((categoriesRes.data || []).map(c => [c.id, c.name]));
    const transactions = transactionsRes.data || [];

    const spendingMap: Record<string, Record<string, number>> = {};
    
    transactions.forEach(tx => {
      const catId = tx.category_id;
      if (!catId) return;
      
      const amount = parseFloat(tx.amount || '0');
      const weekStart = getStartOfWeek(tx.transaction_date);
      
      if (!spendingMap[catId]) {
        spendingMap[catId] = {};
      }
      spendingMap[catId][weekStart] = (spendingMap[catId][weekStart] || 0) + amount;
    });

    const anomalies = [];
    const MIN_ABSOLUTE_THRESHOLD = 20000;
    const MIN_DATA_POINTS = 3;
    const Z_THRESHOLD_MEDIUM = 1.2;
    const Z_THRESHOLD_HIGH = 2.0;

    for (const [catId, weeks] of Object.entries(spendingMap)) {
      const weekStarts = Object.keys(weeks).sort();
      if (weekStarts.length < MIN_DATA_POINTS + 1) continue;

      const currentWeekStart = weekStarts[weekStarts.length - 1];
      const currentTotal = weeks[currentWeekStart];
      const historicalTotals = weekStarts.slice(0, -1).map(w => weeks[w]);

      const mean = historicalTotals.reduce((a, b) => a + b, 0) / historicalTotals.length;
      const variance = historicalTotals.reduce((a, b) => a + (b - mean) ** 2, 0) / historicalTotals.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) continue;

      const zScore = (currentTotal - mean) / stdDev;
      const deltaAbsolute = currentTotal - mean;

      if (deltaAbsolute < MIN_ABSOLUTE_THRESHOLD) continue;
      if (zScore <= Z_THRESHOLD_MEDIUM) continue;

      const severity = zScore >= Z_THRESHOLD_HIGH ? 'HIGH' : 'MEDIUM';
      const percentIncrease = Math.round((deltaAbsolute / mean) * 100);
      const catName = categoriesMap.get(catId) || 'Lainnya';

      anomalies.push({
        categoryId: catId,
        categoryName: catName,
        currentSum: currentTotal,
        avgSum: mean,
        zScore: parseFloat(zScore.toFixed(2)),
        severity,
        message: `Pengeluaran ${catName} minggu ini naik ${percentIncrease}% dari rata-rata (Rp ${Math.round(mean).toLocaleString('id-ID')} ➔ Rp ${Math.round(currentTotal).toLocaleString('id-ID')}).`
      });
    }

    anomalies.sort((a, b) => b.zScore - a.zScore);

    // ─────────────────────────────────────────────────────────────
    // MODUL B: LINEAR PROJECTION SALDO AKHIR BULAN
    // ─────────────────────────────────────────────────────────────
    
    const todayJakarta = getJakartaDate();
    const year = todayJakarta.year;
    const month = todayJakarta.month;
    
    const startOfMonthStr = todayJakarta.startOfMonthString;
    const endOfMonthStr = todayJakarta.endOfMonthString;
    const todayStr = todayJakarta.dateString;
    
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const daysElapsed = todayJakarta.day;
    const daysRemaining = totalDaysInMonth - daysElapsed;

    // Fetch accounts to get current total balance
    const accountsRes = await supabase
      .from('accounts')
      .select('id, name, balance')
      .eq('profile', profile)
      .eq('is_active', true);
    
    const operationalAccounts = (accountsRes.data || [])
      .filter(a => {
        if (profile === 'yoga') {
          return !a.name.toLowerCase().includes('seabank') && !a.name.toLowerCase().includes('tabungan');
        }
        return true;
      });
    
    const operationalAccountIds = operationalAccounts.map(a => a.id);
    const currentBalance = operationalAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);

    // Fetch actual expenses this month
    const expensesRes = await supabase
      .from('transactions')
      .select('amount')
      .eq('profile', profile)
      .eq('type', 'EXPENSE')
      .gte('transaction_date', startOfMonthStr)
      .lte('transaction_date', todayStr);
    
    const totalExpense = (expensesRes.data || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Fetch remaining scheduled income
    const recurringRes = await supabase
      .from('recurring_transactions')
      .select('amount, account_id')
      .eq('profile', profile)
      .eq('type', 'INCOME')
      .eq('is_active', true)
      .gt('next_due', todayStr)
      .lte('next_due', endOfMonthStr);

    const estimatedRemainingIncome = (recurringRes.data || [])
      .filter(r => operationalAccountIds.includes(r.account_id))
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    const dailyBurnRate = daysElapsed > 0 ? totalExpense / daysElapsed : 0;
    const projectedRemainingExpense = dailyBurnRate * daysRemaining;
    const projectedEndBalance = currentBalance - projectedRemainingExpense + estimatedRemainingIncome;

    const confidence = daysElapsed < 5 ? 'LOW' : daysElapsed < 12 ? 'MEDIUM' : 'HIGH';
    const status = projectedEndBalance < 0 ? 'DEFISIT' : projectedEndBalance < currentBalance * 0.1 ? 'MEPET' : 'AMAN';

    const prediction = {
      currentBalance: Math.round(currentBalance),
      dailyBurnRate: Math.round(dailyBurnRate),
      daysRemaining,
      projectedRemainingExpense: Math.round(projectedRemainingExpense),
      estimatedRemainingIncome: Math.round(estimatedRemainingIncome),
      projectedEndBalance: Math.round(projectedEndBalance),
      confidence,
      status
    };

    return NextResponse.json({ anomalies, prediction });
  } catch (error: any) {
    console.error('Insights API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
