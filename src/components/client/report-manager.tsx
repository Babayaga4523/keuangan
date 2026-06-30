'use client';

import { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { formatRupiah, formatDate } from '@/utils/format';
import { 
  Search,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

export interface Account {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface Transaction {
  id: string;
  amount: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  transaction_date: string;
  description: string | null;
  accounts: Account | null;
  categories: Category | null;
  destination_account: Account | null;
}

export interface ReportManagerProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  comparisonData: {
    silva: { totalBalance: number; income: number; expense: number };
    yoga: { totalBalance: number; income: number; expense: number };
  };
  profile: string;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
];

export default function ReportManager({ transactions, accounts, categories, comparisonData, profile }: ReportManagerProps) {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'comparison' | 'weekly'>('overview');
  
  // Filter States
  const [timeRange, setTimeRange] = useState<'MTD' | 'QTD' | 'YTD' | 'ALL'>('MTD');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Category Trend State
  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'EXPENSE'), [categories]);
  const [trendCategoryId, setTrendCategoryId] = useState<string>(expenseCategories[0]?.id || '');

  // Filtered Transactions Memo
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (timeRange !== 'ALL') {
        const dateVal = new Date(tx.transaction_date);
        const now = new Date();
        if (timeRange === 'MTD') {
          if (dateVal.getMonth() !== now.getMonth() || dateVal.getFullYear() !== now.getFullYear()) return false;
        } else if (timeRange === 'QTD') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const txQuarter = Math.floor(dateVal.getMonth() / 3);
          if (txQuarter !== currentQuarter || dateVal.getFullYear() !== now.getFullYear()) return false;
        } else if (timeRange === 'YTD') {
          if (dateVal.getFullYear() !== now.getFullYear()) return false;
        }
      }

      if (startDate && tx.transaction_date < startDate) return false;
      if (endDate && tx.transaction_date > endDate) return false;

      if (searchQuery) {
        const desc = tx.description?.toLowerCase() || '';
        const acc = tx.accounts?.name.toLowerCase() || '';
        const cat = tx.categories?.name.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        if (!desc.includes(query) && !acc.includes(query) && !cat.includes(query)) return false;
      }

      return true;
    });
  }, [transactions, timeRange, startDate, endDate, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    let incomeSum = 0;
    let expenseSum = 0;

    filteredTransactions.forEach((tx) => {
      const amt = parseFloat(tx.amount);
      if (tx.type === 'INCOME') incomeSum += amt;
      else if (tx.type === 'EXPENSE') expenseSum += amt;
    });

    return {
      income: incomeSum,
      expense: expenseSum,
      netWorth: incomeSum - expenseSum,
    };
  }, [filteredTransactions]);

  // Overview Chart Data: grouped by day of transactions
  const overviewChartData = useMemo(() => {
    const dailyMap: Record<string, { date: string; displayDate: string; Pemasukan: number; Pengeluaran: number }> = {};
    const sortedTx = [...filteredTransactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    
    sortedTx.forEach((tx) => {
      const dateStr = tx.transaction_date;
      const amt = parseFloat(tx.amount);
      
      if (!dailyMap[dateStr]) {
        const parts = dateStr.split('-');
        const display = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
        dailyMap[dateStr] = { date: dateStr, displayDate: display, Pemasukan: 0, Pengeluaran: 0 };
      }
      
      if (tx.type === 'INCOME') {
        dailyMap[dateStr].Pemasukan += amt;
      } else if (tx.type === 'EXPENSE') {
        dailyMap[dateStr].Pengeluaran += amt;
      }
    });

    return Object.values(dailyMap);
  }, [filteredTransactions]);

  // Category Breakdown for Pie/Donut Chart
  const categoryBreakdown = useMemo(() => {
    let totalExp = 0;
    const catMap: Record<string, number> = {};

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'EXPENSE') {
        const amt = parseFloat(tx.amount);
        totalExp += amt;
        const name = tx.categories?.name || 'Lainnya';
        catMap[name] = (catMap[name] || 0) + amt;
      }
    });

    const donutColors = ['#000000', '#505f76', '#76777d', '#c6c6cd'];
    const items = Object.entries(catMap).map(([name, amount], index) => {
      const percentage = totalExp > 0 ? (amount / totalExp) * 100 : 0;
      return {
        name,
        amount,
        percentage: percentage.toFixed(1),
        color: donutColors[index % donutColors.length],
      };
    }).sort((a, b) => b.amount - a.amount);

    return { totalExp, items };
  }, [filteredTransactions]);

  // 1. TRENDS FEATURE: Category Spending Monthly Trend Chart
  const categoryTrendData = useMemo(() => {
    const monthlyMap: Record<string, number> = {};
    
    // Filter out EXPENSE transactions for selected category
    transactions.forEach((tx) => {
      if (tx.type === 'EXPENSE' && tx.categories?.id === trendCategoryId) {
        const dateVal = new Date(tx.transaction_date);
        const key = `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap[key] = (monthlyMap[key] || 0) + parseFloat(tx.amount);
      }
    });

    // Generate last 6 months chronological list
    const dataList = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amount = monthlyMap[key] || 0;
      dataList.push({
        monthName: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`,
        'Jumlah Pengeluaran': amount
      });
    }

    // Calculate month-over-month comparison
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthVal = monthlyMap[thisMonthKey] || 0;
    const lastMonthVal = monthlyMap[lastMonthKey] || 0;
    
    let changePct = 0;
    if (lastMonthVal > 0) {
      changePct = ((thisMonthVal - lastMonthVal) / lastMonthVal) * 100;
    }

    return { dataList, thisMonthVal, lastMonthVal, changePct };
  }, [transactions, trendCategoryId]);

  // 2. COMPARISON FEATURE: Silva vs Yoga Side-by-Side
  const comparisonChartData = useMemo(() => {
    return [
      {
        name: 'Total Saldo',
        Silva: comparisonData.silva.totalBalance,
        Yoga: comparisonData.yoga.totalBalance
      },
      {
        name: 'Pemasukan MTD',
        Silva: comparisonData.silva.income,
        Yoga: comparisonData.yoga.income
      },
      {
        name: 'Pengeluaran MTD',
        Silva: comparisonData.silva.expense,
        Yoga: comparisonData.yoga.expense
      }
    ];
  }, [comparisonData]);

  // 3. WEEKLY FEATURE: Weekly summary breakdown of outflow
  const weeklySummaryData = useMemo(() => {
    const weeklyOutflow = [
      { name: 'Minggu 1 (tgl 1-7)', total: 0 },
      { name: 'Minggu 2 (tgl 8-14)', total: 0 },
      { name: 'Minggu 3 (tgl 15-21)', total: 0 },
      { name: 'Minggu 4 (tgl 22+)', total: 0 }
    ];

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'EXPENSE') {
        const d = new Date(tx.transaction_date).getDate();
        const amt = parseFloat(tx.amount);
        if (d <= 7) weeklyOutflow[0].total += amt;
        else if (d <= 14) weeklyOutflow[1].total += amt;
        else if (d <= 21) weeklyOutflow[2].total += amt;
        else weeklyOutflow[3].total += amt;
      }
    });

    const maxWeek = [...weeklyOutflow].sort((a, b) => b.total - a.total)[0];

    return { weeklyOutflow, maxWeek };
  }, [filteredTransactions]);

  const handleExportCSV = () => {
    const headers = ['Tanggal', 'Deskripsi', 'Tipe', 'Kategori', 'Rekening Asal', 'Rekening Tujuan', 'Jumlah (IDR)'];
    const rows = filteredTransactions.map((tx) => [
      tx.transaction_date,
      tx.description || '',
      tx.type === 'INCOME' ? 'Pemasukan' : tx.type === 'EXPENSE' ? 'Pengeluaran' : 'Transfer',
      tx.categories?.name || '',
      tx.accounts?.name || '',
      tx.destination_account?.name || '',
      tx.amount
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Silva_Yoga_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Tab Selectors & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl mb-1">Advanced Performance Analytics</h1>
          <p className="text-xs text-[#45464d] font-medium">Analisis visual laporan keuangan real-time dan analisis tren multi-profil.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['overview', 'trends', 'comparison', 'weekly'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border
                ${activeTab === tab 
                  ? 'bg-black text-white border-black' 
                  : 'bg-white hover:bg-slate-50 border-[#e2e8f0] text-slate-500'
                }
              `}
            >
              {tab === 'overview' ? 'Arus Kas' : tab === 'trends' ? 'Tren Kategori' : tab === 'comparison' ? 'Silva vs Yoga' : 'Mingguan'}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER ROW (only visible/applied in Overview/Arus Kas tab) */}
      {activeTab === 'overview' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-2.5 text-[#45464d] h-4 w-4" />
            <Input
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-[#e2e8f0] rounded-lg text-xs w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex border border-[#c6c6cd] rounded-lg overflow-hidden shrink-0 w-full sm:w-auto">
              {(['MTD', 'QTD', 'YTD', 'ALL'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold transition-colors
                    ${timeRange === range 
                      ? 'bg-black text-white' 
                      : 'bg-white hover:bg-slate-100 text-[#45464d]'
                    }
                  `}
                >
                  {range}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-between">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-[125px] border-[#e2e8f0] rounded-lg text-xs font-mono"
              />
              <span className="text-slate-400 text-xs">s/d</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-[125px] border-[#e2e8f0] rounded-lg text-xs font-mono"
              />
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-[#f2f4f6] text-[#45464d] hover:bg-[#eceef0] rounded-lg text-xs font-bold transition-all w-full sm:w-auto"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Ekspor</span>
            </button>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE TAB VIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Main Chart Area */}
          <div className="col-span-12 lg:col-span-8 bg-white border border-[#e2e8f0] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-sm font-bold text-black uppercase tracking-wider">Perbandingan Arus Kas</h4>
                <p className="text-[10px] text-[#45464d] font-semibold mt-0.5">Pemasukan vs Pengeluaran dalam Grafik</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-black block"></span>
                  <span>Pemasukan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#76777d] block"></span>
                  <span>Pengeluaran</span>
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              {overviewChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Tidak ada data grafik dalam kriteria filter saat ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overviewChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#76777d" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#76777d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} tickFormatter={(v) => `Rp ${(v / 1000).toFixed(0)}rb`} tickMargin={8} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                      formatter={(value: any) => [formatRupiah(value), '']}
                    />
                    <Area type="monotone" dataKey="Pemasukan" stroke="#000000" strokeWidth={2} fillOpacity={1} fill="url(#colorInc)" />
                    <Area type="monotone" dataKey="Pengeluaran" stroke="#76777d" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-[#e2e8f0] flex items-center gap-8">
              <div>
                <p className="text-[10px] text-[#45464d] uppercase tracking-wider mb-1 font-bold">Surplus Bersih</p>
                <p className="text-lg font-bold font-mono text-black">{formatRupiah(stats.netWorth)}</p>
                <div className="flex items-center gap-0.5 mt-0.5 text-[#009668] text-[10px] font-bold">
                  <ArrowUp className="h-3 w-3" /><span>Selisih periode ini</span>
                </div>
              </div>
              <div className="w-px h-10 bg-[#e2e8f0]"></div>
              <div>
                <p className="text-[10px] text-[#45464d] uppercase tracking-wider mb-1 font-bold">Rasio Menabung</p>
                <p className="text-lg font-bold font-mono text-black">
                  {stats.income > 0 ? ((stats.netWorth / stats.income) * 100).toFixed(1) : '0'}%
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Dari total arus masuk bersih</p>
              </div>
            </div>
          </div>

          {/* Allocation Panel */}
          <div className="col-span-12 lg:col-span-4 bg-white border border-[#e2e8f0] rounded-xl p-6">
            <h4 className="text-sm font-bold text-black uppercase tracking-wider mb-4">Pengeluaran Kategori</h4>
            <div className="relative h-44 flex items-center justify-center">
              {categoryBreakdown.totalExp === 0 ? (
                <p className="text-slate-400 text-xs">Belum ada pengeluaran periode ini</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown.items}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="amount"
                      >
                        {categoryBreakdown.items.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatRupiah(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center">
                    <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider">Total</p>
                    <p className="text-sm font-extrabold font-mono text-black">{formatRupiah(categoryBreakdown.totalExp)}</p>
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {categoryBreakdown.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="font-bold text-slate-700">{item.name}</span>
                  </div>
                  <span className="font-bold text-black font-mono">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TRENDS TAB VIEW */}
      {activeTab === 'trends' && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-black uppercase tracking-wider">Tren Pengeluaran per Kategori</h4>
              <p className="text-[10px] text-[#45464d] font-semibold mt-0.5">Analisis pengeluaran kategori tertentu dalam 6 bulan terakhir</p>
            </div>
            <div className="w-full sm:w-56">
              <Select value={trendCategoryId} onValueChange={(val) => setTrendCategoryId(val || '')}>
                <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                  <SelectValue placeholder="Pilih kategori..." />
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#e2e8f0]">
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categoryTrendData.dataList} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="monthName" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rp ${(v/1000).toFixed(0)}rb`} />
                  <Tooltip formatter={(v: any) => [formatRupiah(v), '']} />
                  <Line type="monotone" dataKey="Jumlah Pengeluaran" stroke="#000000" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#f7f9fb] border border-[#e2e8f0] rounded-xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Bulan Ini vs Bulan Lalu</span>
                <div className="mt-3 space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Bulan Ini</p>
                    <p className="text-xl font-bold font-mono text-black">{formatRupiah(categoryTrendData.thisMonthVal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Bulan Lalu</p>
                    <p className="text-xl font-bold font-mono text-slate-600">{formatRupiah(categoryTrendData.lastMonthVal)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0]">
                {categoryTrendData.changePct > 0 ? (
                  <div className="flex items-center gap-2 text-red-600">
                    <TrendingUp className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Meningkat {categoryTrendData.changePct.toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-400 font-medium">Pengeluaran kategori ini naik dibanding bulan lalu.</p>
                    </div>
                  </div>
                ) : categoryTrendData.changePct < 0 ? (
                  <div className="flex items-center gap-2 text-[#009668]">
                    <TrendingDown className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Lebih Hemat {Math.abs(categoryTrendData.changePct).toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-400 font-medium">Pengeluaran kategori ini berkurang dari bulan lalu. Bagus!</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-500">Stabil / Tidak ada perubahan</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SILVA VS YOGA COMPARISON VIEW */}
      {activeTab === 'comparison' && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 space-y-6">
          <div>
            <h4 className="text-sm font-bold text-black uppercase tracking-wider">Perbandingan Silva vs Yoga</h4>
            <p className="text-[10px] text-[#45464d] font-semibold mt-0.5">Analisis perbandingan saldo aset, total pemasukan, dan pengeluaran bulan berjalan</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rp ${(v/1000000).toFixed(1)}jt`} />
                  <Tooltip formatter={(v: any) => formatRupiah(v)} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="Silva" fill="#009668" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Yoga" fill="#505f76" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                <span className="text-[10px] font-bold text-[#009668] uppercase tracking-wider block mb-1">🌿 Profil Silva</span>
                <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Saldo</p>
                    <p className="font-bold text-black font-mono">{formatRupiah(comparisonData.silva.totalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Masuk</p>
                    <p className="font-bold text-black font-mono">{formatRupiah(comparisonData.silva.income)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Keluar</p>
                    <p className="font-bold text-[#ba1a1a] font-mono">{formatRupiah(comparisonData.silva.expense)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">🧘 Profil Yoga</span>
                <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Saldo</p>
                    <p className="font-bold text-black font-mono">{formatRupiah(comparisonData.yoga.totalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Masuk</p>
                    <p className="font-bold text-black font-mono">{formatRupiah(comparisonData.yoga.income)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Keluar</p>
                    <p className="font-bold text-[#ba1a1a] font-mono">{formatRupiah(comparisonData.yoga.expense)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEEKLY SUMMARY VIEW */}
      {activeTab === 'weekly' && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 space-y-6">
          <div>
            <h4 className="text-sm font-bold text-black uppercase tracking-wider">Ringkasan Mingguan (Weekly Summary)</h4>
            <p className="text-[10px] text-[#45464d] font-semibold mt-0.5">Analisis grafik pengeluaran mingguan Anda di bulan ini</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySummaryData.weeklyOutflow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rp ${(v/1000).toFixed(0)}rb`} />
                  <Tooltip formatter={(v: any) => [formatRupiah(v), '']} />
                  <Bar dataKey="total" name="Total Pengeluaran" fill="#000000" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-50 border border-[#e2e8f0] rounded-xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Analisis Perilaku Belanja</span>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-black shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-black">Minggu Terboros</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pengeluaran paling besar terjadi pada <strong>{weeklySummaryData.maxWeek?.name || '-'}</strong> dengan total <strong>{formatRupiah(weeklySummaryData.maxWeek?.total || 0)}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-6 pt-4 border-t border-[#e2e8f0]">
                Tips: Cobalah membatasi pengeluaran non-primer di awal minggu terboros Anda agar arus kas tetap seimbang sepanjang bulan.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
