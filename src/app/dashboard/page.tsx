import { createServerClient } from '@/lib/supabase-server';
import { formatRupiah } from '@/utils/format';
import { cookies } from 'next/headers';
import { 
  ArrowUpRight, 
  MoreHorizontal,
  Bell,
  Search,
  ListFilter,
  Download,
  Calendar,
  Zap,
  PiggyBank,
  BellRing,
  ChevronRight,
  Wallet,
  Plus,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NetWorthChart, AllocationChart, ForecastChart } from '@/components/client/dashboard-charts';
import ThresholdSetter from '@/components/client/threshold-setter';

export const revalidate = 0; // Live data

export default async function DashboardPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  // 1. Fetch Accounts
  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('*')
    .eq('profile', profile)
    .order('balance', { ascending: false });

  const accounts = accountsRaw || [];
  const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0) || 0;

  // 2. Fetch Transactions for calculations
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Fetch transactions for the last 30 days for running balance sparkline
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];
  const monthNum = now.getMonth() + 1;
  const yearNum = now.getFullYear();

  const [currentMonthRes, recentTxRes, budgetsRes, recurringRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('profile', profile)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth),
    supabase
      .from('transactions')
      .select('*')
      .eq('profile', profile)
      .gte('transaction_date', thirtyDaysAgo)
      .lte('transaction_date', now.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false }),
    supabase
      .from('budgets')
      .select('*, categories(id, name)')
      .eq('profile', profile)
      .eq('month', monthNum)
      .eq('year', yearNum),
    supabase
      .from('recurring_transactions')
      .select('*, accounts(id, name)')
      .eq('profile', profile)
      .eq('is_active', true)
      .lte('next_due', todayStr)
  ]);

  const currentMonthTransactions = currentMonthRes.data || [];
  const recentTransactions = recentTxRes.data || [];
  const budgets = budgetsRes.data || [];
  const dueRecurring = recurringRes.data || [];

  let totalIncome = 0;
  let totalExpense = 0;

  // Split transactions by week for Liquidity Forecast (Week 1 to 4)
  const weeklyFlow = [
    { name: 'WK 1', inflow: 0, outflow: 0 },
    { name: 'WK 2', inflow: 0, outflow: 0 },
    { name: 'WK 3', inflow: 0, outflow: 0 },
    { name: 'WK 4', inflow: 0, outflow: 0 },
  ];

  currentMonthTransactions.forEach((tx) => {
    const amount = parseFloat(tx.amount);
    const dateVal = new Date(tx.transaction_date);
    const day = dateVal.getDate();

    if (tx.type === 'INCOME') {
      totalIncome += amount;
    } else if (tx.type === 'EXPENSE') {
      totalExpense += amount;
    }

    // Assign to week
    let weekIndex = 0;
    if (day <= 7) weekIndex = 0;
    else if (day <= 14) weekIndex = 1;
    else if (day <= 21) weekIndex = 2;
    else weekIndex = 3;

    if (tx.type === 'INCOME') {
      weeklyFlow[weekIndex].inflow += amount;
    } else if (tx.type === 'EXPENSE') {
      weeklyFlow[weekIndex].outflow += amount;
    }
  });

  // Calculate percentages for Smart Allocation Donut Chart
  const donutColors = ['#000000', '#505f76', '#7c839b', '#eceef0'];
  let currentCumulative = 0;
  const allocations = [];
  for (let index = 0; index < accounts.length; index++) {
    const acc = accounts[index];
    const balance = parseFloat(acc.balance);
    const fraction = totalBalance > 0 ? balance / totalBalance : 0;
    const percentage = (fraction * 100).toFixed(1);
    const startAngle = currentCumulative * 360;
    currentCumulative += fraction;
    allocations.push({
      name: acc.name,
      percentage,
      fraction,
      startAngle,
      balance,
      color: donutColors[index % donutColors.length],
    });
  }

  // Calculate historical net worth daily running balance backtracking 30 days
  let runningBalance = totalBalance;
  const dailyBalances: { date: string; displayDate: string; balance: number }[] = [];
  
  // Group recent transactions by date
  const txByDate: { [date: string]: any[] } = {};
  recentTransactions.forEach((tx) => {
    if (!txByDate[tx.transaction_date]) {
      txByDate[tx.transaction_date] = [];
    }
    txByDate[tx.transaction_date].push(tx);
  });

  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const displayDate = `${day}/${month}`;

    dailyBalances.push({
      date: dateStr,
      displayDate,
      balance: runningBalance
    });

    const dayTx = txByDate[dateStr] || [];
    dayTx.forEach((tx) => {
      const amount = parseFloat(tx.amount);
      if (tx.type === 'INCOME') {
        runningBalance -= amount;
      } else if (tx.type === 'EXPENSE') {
        runningBalance += amount;
      }
    });
  }

  dailyBalances.reverse();

  // 3. Fetch Saving Goals (Limit to top 2 goals)
  const { data: savingGoals } = await supabase
    .from('saving_goals')
    .select('*')
    .eq('profile', profile)
    .limit(2);

  // 4. Low balance accounts calculation
  const lowBalanceAccounts = accounts.filter(
    (acc) => parseFloat(acc.balance) < (parseFloat(acc.low_balance_threshold) || 0)
  );

  // 5. Budget warnings calculation
  const spentByCat: Record<string, number> = {};
  currentMonthTransactions.forEach((tx) => {
    if (tx.type === 'EXPENSE' && tx.category_id) {
      spentByCat[tx.category_id] = (spentByCat[tx.category_id] || 0) + parseFloat(tx.amount);
    }
  });

  const budgetWarnings = budgets.map((b) => {
    const spent = spentByCat[b.category_id] || 0;
    const limit = parseFloat(b.amount);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      id: b.id,
      categoryName: b.categories?.name || 'Kategori',
      spent,
      limit,
      pct,
      isOver: spent > limit,
      isWarning: pct >= 80 && spent <= limit,
    };
  }).filter((w) => w.isOver || w.isWarning);


  return (
    <div className="space-y-6">
      {/* Top Header/Navbar */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#e2e8f0] pb-5 gap-4">
        <div className="flex items-center flex-grow">
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl">Financial Command Center</h1>
          <div className="ml-8 relative w-full max-w-xs hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] h-4 w-4" />
            <input 
              className="w-full pl-9 pr-4 py-1.5 bg-[#f2f4f6] border border-transparent rounded-lg text-xs font-medium focus:outline-none focus:border-black focus:bg-white transition-all duration-200" 
              placeholder="Cari aset atau transaksi..." 
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-2 rounded-full hover:bg-[#eceef0] relative shrink-0">
            <Bell className="h-5 w-5 text-black" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ba1a1a] rounded-full"></span>
          </button>
          <div className="h-6 w-[1px] bg-[#c6c6cd]"></div>
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#45464d]">Live Sync</span>
            <div className="w-2 h-2 bg-[#009668] rounded-full animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* Warnings & Alerts Grid */}
      {(lowBalanceAccounts.length > 0 || budgetWarnings.length > 0 || dueRecurring.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Low Balance Accounts warning */}
          {lowBalanceAccounts.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#ba1a1a] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-900">Saldo Menipis</h4>
                <ul className="text-xs mt-1 space-y-1 text-red-700">
                  {lowBalanceAccounts.map(acc => (
                    <li key={acc.id}>
                      <strong>{acc.name}</strong>: {formatRupiah(parseFloat(acc.balance))}
                      <span className="text-[10px] text-red-500 block">Limit: {formatRupiah(parseFloat(acc.low_balance_threshold))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Budget Limits warning */}
          {budgetWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Peringatan Budget</h4>
                <ul className="text-xs mt-1 space-y-1 text-amber-700">
                  {budgetWarnings.map(w => (
                    <li key={w.id}>
                      <strong>{w.categoryName}</strong>: {w.pct.toFixed(0)}% terpakai
                      <span className="text-[10px] text-amber-500 block">
                        {w.isOver ? 'Kelebihan budget!' : 'Mendekati batas budget'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recurring Due warning */}
          {dueRecurring.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">Jatuh Tempo</h4>
                <p className="text-xs mt-1 text-blue-700">
                  Ada <strong>{dueRecurring.length}</strong> transaksi rutin jatuh tempo hari ini.
                </p>
                <Link href="/recurring" className="text-[10px] font-bold text-blue-600 underline block mt-1 hover:text-blue-800">
                  Eksekusi Sekarang →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Net Worth & Smart Allocation Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        {/* Net Worth Card (Spans 2 columns) */}
        <div className="md:col-span-2 bg-white border border-[#e2e8f0] rounded-xl p-6 flex flex-col justify-between hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider mb-1">TOTAL NET WORTH</p>
              <h2 className="text-3xl font-bold tracking-tight font-mono text-black">
                {formatRupiah(totalBalance)}
              </h2>
              <div className="flex items-center mt-1.5 space-x-1.5">
                <div className="flex items-center text-[#009668] text-xs font-bold">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>+0.52%</span>
                </div>
                <span className="text-[10px] text-[#45464d]">30 hari terakhir</span>
              </div>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto justify-start sm:justify-end">
              <Link href="/laporan" className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" className="h-8 w-full border-[#c6c6cd] text-xs px-3 rounded-lg">
                  Laporan
                </Button>
              </Link>
              <Link href="/transaksi" className="flex-1 sm:flex-initial">
                <Button size="sm" className="h-8 w-full bg-black hover:bg-black/90 text-white text-xs px-3 rounded-lg font-bold">
                  Catat Kas
                </Button>
              </Link>
            </div>
          </div>

          {/* Recharts Interactive Sparkline */}
          <NetWorthChart data={dailyBalances} />
        </div>

        {/* Smart Allocation Donut Card (Spans 1 column) */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 flex flex-col justify-between hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow duration-200">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider">SMART ALLOCATION</p>
            <MoreHorizontal className="h-5 w-5 text-[#45464d]" />
          </div>

          {/* Recharts Donut Allocation Chart */}
          <AllocationChart allocations={allocations} />
        </div>
      </div>

      {/* Forecast & Sinking Funds Actions Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-12">
        {/* Weekly Cash Flow Forecast Card */}
        <div className="md:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-6 flex flex-col justify-between hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow duration-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider">LIQUIDITY FORECAST</p>
              <p className="text-xs text-[#45464d] font-medium">Estimasi Arus Kas Masuk Mingguan</p>
            </div>
            <div className="flex items-center space-x-1.5 bg-[#eceef0] px-2.5 py-1 rounded-lg text-black">
              <Calendar className="h-3.5 w-3.5 text-black" />
              <span className="text-[10px] font-bold">
                {now.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Recharts Forecast Bar Chart */}
          <ForecastChart data={weeklyFlow} />

          {/* Statistics summary below bars */}
          <div className="mt-6 pt-6 border-t border-[#e2e8f0] flex justify-around text-center text-xs">
            <div>
              <p className="text-[10px] text-[#45464d] font-medium">Pemasukan</p>
              <p className="font-bold text-black font-mono">{formatRupiah(totalIncome)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-[#45464d] font-medium">Pengeluaran</p>
              <p className="font-bold text-[#ba1a1a] font-mono">{formatRupiah(totalExpense)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-[#45464d] font-medium">Surplus Bersih</p>
              <p className="font-bold text-[#009668] font-mono">{formatRupiah(totalIncome - totalExpense)}</p>
            </div>
          </div>
        </div>

        {/* High Priority Actions Card */}
        <div className="md:col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-6 flex flex-col justify-between hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow duration-200">
          <div>
            <div className="flex items-center space-x-2 mb-5">
              <Zap className="h-4 w-4 text-black fill-black" />
              <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider">HIGH-PRIORITY ACTIONS</p>
            </div>

            <div className="space-y-3.5">
              {/* Dynamic Target Tabungan Progress Action */}
              {savingGoals && savingGoals.length > 0 ? (
                savingGoals.map((goal) => {
                  const target = parseFloat(goal.target_amount);
                  const current = parseFloat(goal.current_amount);
                  const progress = Math.min((current / target) * 100, 100);

                  return (
                    <Link key={goal.id} href="/tabungan">
                      <div className="p-3.5 rounded-lg bg-[#f2f4f6] border border-[#e2e8f0] hover:border-black transition-all flex flex-col space-y-2.5 cursor-pointer group">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="p-1.5 bg-white rounded border border-[#e2e8f0] shrink-0">
                              <PiggyBank className="h-4 w-4 text-slate-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-black truncate">{goal.name}</p>
                              <p className="text-[9px] text-[#45464d] font-mono truncate">
                                {formatRupiah(current)} / {formatRupiah(target)}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#009668] font-mono shrink-0">{progress.toFixed(0)}% Selesai</span>
                        </div>
                        <Progress value={progress} className="h-1.5 bg-slate-200 [&>div]:bg-[#009668]" />
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="p-4 rounded-lg bg-[#f2f4f6] border border-[#e2e8f0] text-center text-xs text-slate-400">
                  Belum ada rencana tabungan aktif.
                </div>
              )}

              {/* Action 2: Audit Biaya */}
              <div className="p-3 rounded-lg bg-[#f2f4f6] border border-[#e2e8f0] flex items-center justify-between hover:border-black transition-all cursor-pointer group">
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 bg-white rounded border border-[#e2e8f0] group-hover:bg-black group-hover:text-white transition-all">
                    <BellRing className="h-4 w-4 text-slate-700 group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-black">Evaluasi Pengeluaran Bulanan</p>
                    <p className="text-[9px] text-[#45464d]">Audit tagihan dan langganan aktif Anda</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[#45464d] group-hover:text-black transition-colors" />
              </div>
            </div>
          </div>

          <Link href="/tabungan" className="mt-5 block">
            <button className="w-full py-2.5 border border-black text-black font-bold text-xs rounded-lg hover:bg-black hover:text-white transition-all duration-200">
              Kelola Rencana Tabungan
            </button>
          </Link>
        </div>
      </div>

      {/* Asset Detail Section (Wide Table) */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 flex justify-between items-center border-b border-[#e2e8f0] bg-slate-50/10">
          <h3 className="text-sm font-bold text-black">Informasi Saldo Rekening</h3>
          <div className="flex space-x-1.5">
            <button className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#eceef0] transition-colors text-[#45464d] hover:text-black">
              <ListFilter className="h-4 w-4" />
            </button>
            <button className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#eceef0] transition-colors text-[#45464d] hover:text-black">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f2f4f6] border-b border-[#e2e8f0] text-[#45464d] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5 font-bold">Jenis Rekening</th>
                <th className="px-6 py-3.5 font-bold hidden md:table-cell">Keterangan</th>
                <th className="px-6 py-3.5 font-bold text-right">Saldo</th>
                <th className="px-6 py-3.5 font-bold text-right">Persentase</th>
                <th className="px-6 py-3.5 font-bold hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {accounts.map((acc) => {
                const balanceVal = parseFloat(acc.balance);
                const pct = totalBalance > 0 ? ((balanceVal / totalBalance) * 100).toFixed(1) : '0';
                
                return (
                  <tr key={acc.id} className="hover:bg-[#f2f4f6]/40 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Wallet className="h-4 w-4 text-black" />
                        <span className="font-bold text-black">{acc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium hidden md:table-cell">
                      Limit Alert: {formatRupiah(parseFloat(acc.low_balance_threshold || '0'))}
                    </td>
                    <td className="px-6 py-4 font-bold text-right font-mono text-black">{formatRupiah(balanceVal)}</td>
                    <td className="px-6 py-4 text-right font-bold font-mono text-[#45464d]">{pct}%</td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#d0e1fb] text-[#38485d] text-[10px] font-bold">
                          Aktif
                        </span>
                        <ThresholdSetter 
                          accountId={acc.id} 
                          accountName={acc.name} 
                          currentThreshold={parseFloat(acc.low_balance_threshold || '0')} 
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAB float button for quick transactions */}
      <div className="fixed bottom-6 right-6 z-50">
        <Link href="/transaksi">
          <button className="w-12 h-12 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 group">
            <Plus className="h-6 w-6" />
            <div className="absolute right-14 bg-black text-white px-3 py-1.5 rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md">
              Catat Transaksi Baru
            </div>
          </button>
        </Link>
      </div>
    </div>
  );
}
