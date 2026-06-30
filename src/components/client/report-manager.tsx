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
  Cell
} from 'recharts';
import { formatRupiah } from '@/utils/format';
import { 
  Search,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Filter,
  ShieldCheck,
  Download,
  FileText,
  Table,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Input } from '../ui/input';

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
}

export default function ReportManager({ transactions }: ReportManagerProps) {
  // Filter States
  const [timeRange, setTimeRange] = useState<'MTD' | 'QTD' | 'YTD' | 'ALL'>('MTD');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Metadata customization toggles for Export Suite
  const [includeMeta, setIncludeMeta] = useState(true);
  const [rawLogs, setRawLogs] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Filtered Transactions Memo
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Time range filter based on pre-sets
      if (timeRange !== 'ALL') {
        const dateVal = new Date(tx.transaction_date);
        const now = new Date();
        if (timeRange === 'MTD') {
          // Month-to-date
          if (dateVal.getMonth() !== now.getMonth() || dateVal.getFullYear() !== now.getFullYear()) return false;
        } else if (timeRange === 'QTD') {
          // Quarter-to-date
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const txQuarter = Math.floor(dateVal.getMonth() / 3);
          if (txQuarter !== currentQuarter || dateVal.getFullYear() !== now.getFullYear()) return false;
        } else if (timeRange === 'YTD') {
          // Year-to-date
          if (dateVal.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // 2. Custom date range
      if (startDate && tx.transaction_date < startDate) return false;
      if (endDate && tx.transaction_date > endDate) return false;

      // 3. Search query
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

  // Statistics calculations (Sum of all incomes and expenses)
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

  // Chart Data preparation (grouped by day of transactions)
  const chartData = useMemo(() => {
    const dailyMap: { [date: string]: { date: string; displayDate: string; Pemasukan: number; Pengeluaran: number } } = {};
    
    // Sort transactions ascending by date to build chronological chart
    const sortedTx = [...filteredTransactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    
    sortedTx.forEach((tx) => {
      const dateStr = tx.transaction_date;
      const amt = parseFloat(tx.amount);
      
      if (!dailyMap[dateStr]) {
        const parts = dateStr.split('-');
        const display = parts.length === 3 ? `${parts[2]} / ${parts[1]}` : dateStr;
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

  // Category Breakdown calculations for donut
  const categoryBreakdown = useMemo(() => {
    let totalExp = 0;
    const catMap: { [name: string]: number } = {};

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'EXPENSE') {
        const amt = parseFloat(tx.amount);
        totalExp += amt;
        const name = tx.categories?.name || 'Lainnya';
        catMap[name] = (catMap[name] || 0) + amt;
      }
    });

    const donutColors = ['#000000', '#505f76', '#76777d', '#c6c6cd'];
    let accumPercent = 0;
    const items = Object.entries(catMap).map(([name, amount], index) => {
      const percentage = totalExp > 0 ? (amount / totalExp) * 100 : 0;
      const dasharray = `${percentage.toFixed(0)} ${(100 - percentage).toFixed(0)}`;
      const dashoffset = -accumPercent;
      accumPercent += percentage;

      return {
        name,
        amount,
        percentage: percentage.toFixed(1),
        dasharray,
        dashoffset,
        color: donutColors[index % donutColors.length],
      };
    }).sort((a, b) => b.amount - a.amount);

    return { totalExp, items };
  }, [filteredTransactions]);

  // Calculate dynamic fiscal comparison between current and previous year
  const fiscalComparison = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    let thisYearIncome = 0;
    let thisYearExpense = 0;
    let thisYearTaxZakat = 0;

    let lastYearIncome = 0;
    let lastYearExpense = 0;
    let lastYearTaxZakat = 0;

    transactions.forEach((tx) => {
      if (!tx.transaction_date) return;
      const txYear = new Date(tx.transaction_date).getFullYear();
      const amt = parseFloat(tx.amount) || 0;
      const isTaxZakat = tx.categories?.name?.toLowerCase().includes('pajak') || 
                          tx.categories?.name?.toLowerCase().includes('zakat') ||
                          tx.description?.toLowerCase().includes('pajak') ||
                          tx.description?.toLowerCase().includes('zakat');

      if (txYear === thisYear) {
        if (tx.type === 'INCOME') {
          thisYearIncome += amt;
        } else if (tx.type === 'EXPENSE') {
          if (isTaxZakat) {
            thisYearTaxZakat += amt;
          } else {
            thisYearExpense += amt;
          }
        }
      } else if (txYear === lastYear) {
        if (tx.type === 'INCOME') {
          lastYearIncome += amt;
        } else if (tx.type === 'EXPENSE') {
          if (isTaxZakat) {
            lastYearTaxZakat += amt;
          } else {
            lastYearExpense += amt;
          }
        }
      }
    });

    const thisYearResidual = thisYearIncome - thisYearExpense - thisYearTaxZakat;
    const lastYearResidual = lastYearIncome - lastYearExpense - lastYearTaxZakat;

    const calcVariant = (curr: number, prev: number) => {
      if (prev === 0) {
        return curr > 0 ? '+100.00%' : '0.00%';
      }
      const diff = ((curr - prev) / prev) * 100;
      return (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%';
    };

    const calcAchievement = (curr: number, prev: number) => {
      if (prev <= 0) {
        return curr > 0 ? 100 : 0;
      }
      const pct = (curr / prev) * 100;
      return Math.min(Math.round(pct), 100);
    };

    return [
      {
        name: 'Hasil Portofolio Kotor',
        prev: lastYearIncome,
        curr: thisYearIncome,
        variant: calcVariant(thisYearIncome, lastYearIncome),
        achievement: calcAchievement(thisYearIncome, lastYearIncome),
        isPositive: thisYearIncome >= lastYearIncome
      },
      {
        name: 'Pengeluaran Kapital',
        prev: lastYearExpense,
        curr: thisYearExpense,
        variant: calcVariant(thisYearExpense, lastYearExpense),
        achievement: calcAchievement(thisYearExpense, lastYearExpense),
        isPositive: thisYearExpense <= lastYearExpense
      },
      {
        name: 'Liabilitas Pajak & Zakat',
        prev: lastYearTaxZakat,
        curr: thisYearTaxZakat,
        variant: calcVariant(thisYearTaxZakat, lastYearTaxZakat),
        achievement: calcAchievement(thisYearTaxZakat, lastYearTaxZakat),
        isPositive: thisYearTaxZakat <= lastYearTaxZakat
      },
      {
        name: 'Nilai Sisa Bersih (Residual)',
        prev: lastYearResidual,
        curr: thisYearResidual,
        variant: calcVariant(thisYearResidual, lastYearResidual),
        achievement: calcAchievement(thisYearResidual, lastYearResidual),
        isPositive: thisYearResidual >= lastYearResidual
      }
    ];
  }, [transactions]);

  // Export to CSV / Export Suite action
  const handleExport = (format: 'CSV' | 'PDF' | 'EXCEL') => {
    if (filteredTransactions.length === 0) {
      alert('Tidak ada data transaksi untuk diekspor.');
      return;
    }

    if (format === 'CSV') {
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
      link.setAttribute('download', `Laporan_Amanah_Finance_${new Date().toISOString().split('T')[0]}.csv`);
      link.click();
    } else {
      alert(`Format ekspor ${format} simulasi berjalan sukses! Berkas sedang dipersiapkan.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & MTD/QTD/YTD/ALL filter header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl mb-1">Advanced Performance Analytics</h1>
          <p className="text-xs text-[#45464d] font-medium">Real-time fiscal reporting and trend forecasting.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* MTD/QTD/YTD/ALL Buttons */}
          <div className="flex border border-[#c6c6cd] rounded-lg overflow-hidden shrink-0">
            {(['MTD', 'QTD', 'YTD', 'ALL'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors
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

          {/* Date range picker */}
          <div className="flex items-center space-x-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[125px] border-[#e2e8f0] rounded-lg text-xs font-mono"
            />
            <span className="text-slate-400 text-xs">-</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[125px] border-[#e2e8f0] rounded-lg text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Search Input Row */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-2.5 text-[#45464d] h-4 w-4" />
        <Input
          placeholder="Cari transaksi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 border-[#e2e8f0] rounded-lg text-xs"
        />
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Main Chart Area (Spans 8 columns) */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-[#e2e8f0] rounded-xl p-6 hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow duration-200">
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

          {/* Recharts Live Chart rendering or placeholder */}
          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Tidak ada data grafik dalam kriteria filter saat ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    formatter={(value: unknown, name?: string | number) => [
                      formatRupiah(typeof value === 'number' || typeof value === 'string' ? value : 0), 
                      String(name || '')
                    ]}
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
                <ArrowUp className="h-3 w-3" />
                <span>Selisih periode ini</span>
              </div>
            </div>
            <div className="w-px h-10 bg-[#e2e8f0]"></div>
            <div>
              <p className="text-[10px] text-[#45464d] uppercase tracking-wider mb-1 font-bold">Pengeluaran Operasional</p>
              <p className="text-lg font-bold font-mono text-black">{formatRupiah(stats.expense)}</p>
              <div className="flex items-center gap-0.5 mt-0.5 text-[#ba1a1a] text-[10px] font-bold">
                <ArrowDown className="h-3 w-3" />
                <span>-2.1% target</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown (Spans 4 columns) */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-[#e2e8f0] rounded-xl p-6 hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-sm font-bold text-black uppercase tracking-wider">Category Breakdown</h4>
              <MoreVertical className="h-4 w-4 text-[#45464d]" />
            </div>

            {/* Recharts Donut Chart */}
            <div className="flex flex-col items-center py-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {categoryBreakdown.items.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    Belum ada pengeluaran.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown.items}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="amount"
                          onMouseEnter={(_, index) => setActiveIndex(index)}
                        >
                          {categoryBreakdown.items.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center px-2">
                      <span className="text-sm font-bold text-black leading-none">
                        {categoryBreakdown.items[activeIndex]?.percentage || categoryBreakdown.items[0]?.percentage || '0'}%
                      </span>
                      <span className="text-[8px] text-[#45464d] uppercase font-bold tracking-tight mt-0.5 max-w-[80px] truncate">
                        {categoryBreakdown.items[activeIndex]?.name || categoryBreakdown.items[0]?.name || 'Kategori'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Legend breakdown list */}
              <div className="space-y-1.5 mt-5 w-full">
                {categoryBreakdown.items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Belum ada data pengeluaran.</p>
                ) : (
                  categoryBreakdown.items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-1.5 rounded transition-all duration-150 cursor-pointer ${activeIndex === idx ? 'bg-slate-100/80 font-bold' : 'hover:bg-slate-50'}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full block shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[125px]">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-black shrink-0">{item.percentage}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Year-over-Year & Widgets Grid */}
      <div className="grid grid-cols-12 gap-6 mt-6 items-start">
        {/* YoY comparison table (Spans 9 columns) */}
        <div className="col-span-12 lg:col-span-9 bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#e2e8f0] bg-slate-50/10 flex items-center justify-between">
            <h4 className="text-xs font-bold text-black uppercase tracking-wider">Perbandingan Kinerja Fiskal</h4>
            <div className="flex gap-2">
              <button className="p-1.5 border border-[#e2e8f0] rounded-lg hover:bg-[#f2f4f6] text-[#45464d] hover:text-black flex items-center justify-center">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f2f4f6] text-[#45464d] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="px-6 py-3.5 font-bold">Parameter Fiskal</th>
                  <th className="px-6 py-3.5 font-bold text-right">Tahun Lalu ({new Date().getFullYear() - 1})</th>
                  <th className="px-6 py-3.5 font-bold text-right">Tahun Ini ({new Date().getFullYear()})</th>
                  <th className="px-6 py-3.5 font-bold text-right">Varian</th>
                  <th className="px-6 py-3.5 font-bold">Pencapaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] text-slate-800 font-medium">
                {fiscalComparison.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#f2f4f6]/30 transition-all">
                    <td className="px-6 py-4 font-bold text-black">{row.name}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">{formatRupiah(row.prev)}</td>
                    <td className="px-6 py-4 text-right font-mono text-black font-bold">{formatRupiah(row.curr)}</td>
                    <td className={`px-6 py-4 text-right font-mono font-bold ${row.isPositive ? 'text-[#009668]' : 'text-[#ba1a1a]'}`}>
                      {row.variant}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-[#f2f4f6] rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${row.isPositive ? 'bg-black' : 'bg-slate-500'}`} 
                            style={{ width: `${row.achievement}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold">{row.achievement}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right side widgets (Spans 3 columns) */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* Tax & Compliance widget */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 hover:shadow-[0_1px_3px_rgba(15,23,42,0.02)] transition-shadow duration-200 space-y-4">
            <div className="flex items-center gap-2 text-black">
              <ShieldCheck className="h-4.5 w-4.5 text-black" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Tax &amp; Compliance</h4>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#f7f9fb] border border-[#e2e8f0] rounded-lg">
                <p className="text-[9px] text-[#45464d] font-bold uppercase tracking-wider mb-0.5">Status</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#009668] block"></span>
                  <span className="font-bold text-black">Fully Compliant</span>
                </div>
              </div>
              <div className="p-3 bg-[#f7f9fb] border border-[#e2e8f0] rounded-lg">
                <p className="text-[9px] text-[#45464d] font-bold uppercase tracking-wider mb-0.5">Next Filing Date</p>
                <p className="font-bold text-black font-mono">15 Jan 2027</p>
              </div>
              <button className="w-full py-2 border border-black text-black text-[11px] font-bold rounded-lg hover:bg-black hover:text-white transition-all duration-200">
                Tinjau Log Audit
              </button>
            </div>
          </div>

          {/* Export Suite widget (Dark Mode style) */}
          <div className="bg-black text-white rounded-xl p-5 shadow-md space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Export Suite</h4>
            <div className="space-y-2 text-xs">
              <button 
                onClick={() => handleExport('PDF')}
                className="w-full flex items-center justify-between p-2.5 bg-white/10 hover:bg-white/20 transition-all rounded-lg group"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5" />
                  <span>Laporan PDF</span>
                </div>
                <Download className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all" />
              </button>
              <button 
                onClick={() => handleExport('EXCEL')}
                className="w-full flex items-center justify-between p-2.5 bg-white/10 hover:bg-white/20 transition-all rounded-lg group"
              >
                <div className="flex items-center gap-2">
                  <Table className="h-4.5 w-4.5" />
                  <span>Spreadsheet Excel</span>
                </div>
                <Download className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all" />
              </button>
              <button 
                onClick={() => handleExport('CSV')}
                className="w-full flex items-center justify-between p-2.5 bg-white/10 hover:bg-white/20 transition-all rounded-lg group"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4.5 w-4.5" />
                  <span>Data Mentah CSV</span>
                </div>
                <Download className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all" />
              </button>

              <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
                <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">Kustomisasi Ekspor</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-medium">Sertakan Meta Data</span>
                  <button 
                    onClick={() => setIncludeMeta(!includeMeta)}
                    className={`w-7 h-4 rounded-full transition-all relative ${includeMeta ? 'bg-[#009668]' : 'bg-white/20'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${includeMeta ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-medium">Sertakan Log Audit</span>
                  <button 
                    onClick={() => setRawLogs(!rawLogs)}
                    className={`w-7 h-4 rounded-full transition-all relative ${rawLogs ? 'bg-[#009668]' : 'bg-white/20'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${rawLogs ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
