'use client';

import { useState, useMemo } from 'react';
import { formatRupiah, formatDate } from '@/utils/format';
import { 
  Download,
  Trash2,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Info,
  TrendingUp,
  Lightbulb
} from 'lucide-react';
import { actionDeleteTransaction } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import TransactionForm from './transaction-form';

export interface Account {
  id: string;
  name: string;
  balance: number;
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
  accounts: { id: string; name: string } | null;
  categories: { id: string; name: string } | null;
  destination_account?: { id: string; name: string } | null;
}

export interface TransactionManagerProps {
  initialTransactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}

export default function TransactionManager({ 
  initialTransactions, 
  accounts, 
  categories 
}: TransactionManagerProps) {
  const router = useRouter();
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Client-side filtering
  const filteredTransactions = useMemo(() => {
    return initialTransactions.filter((tx) => {
      // 1. Search Query
      if (searchQuery) {
        const desc = tx.description?.toLowerCase() || '';
        const acc = tx.accounts?.name.toLowerCase() || '';
        const cat = tx.categories?.name.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        if (!desc.includes(query) && !acc.includes(query) && !cat.includes(query)) return false;
      }

      // 2. Type Filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;

      // 3. Category Filter
      if (categoryFilter !== 'ALL' && tx.categories?.id !== categoryFilter) return false;

      // 4. Date Range
      if (startDate && tx.transaction_date < startDate) return false;
      if (endDate && tx.transaction_date > endDate) return false;

      return true;
    });
  }, [initialTransactions, searchQuery, categoryFilter, typeFilter, startDate, endDate]);

  // Calculate Net Outflow & Category breakdown for Spending Analytics (Expenses only, current calendar month MTD)
  const spendingAnalytics = useMemo(() => {
    let totalOutflow = 0;
    const catMap: { [name: string]: number } = {};

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    initialTransactions.forEach((tx) => {
      if (tx.type === 'EXPENSE') {
        const txDate = new Date(tx.transaction_date);
        if (txDate >= startOfMonth && txDate <= endOfMonth) {
          const amt = parseFloat(tx.amount);
          totalOutflow += amt;

          const catName = tx.categories?.name || 'Lainnya';
          catMap[catName] = (catMap[catName] || 0) + amt;
        }
      }
    });

    const breakdown = Object.entries(catMap).map(([name, amount]) => {
      const percentage = totalOutflow > 0 ? (amount / totalOutflow) * 100 : 0;
      return { name, amount, percentage };
    }).sort((a, b) => b.amount - a.amount);

    return { totalOutflow, breakdown };
  }, [initialTransactions]);

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini? Saldo rekening asal akan dikembalikan.')) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await actionDeleteTransaction(id);
      if (!result.success) {
        alert(`Gagal menghapus transaksi: ${result.error}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      alert(`Gagal menghapus transaksi: ${errorMsg}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Export CSV
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
    link.setAttribute('download', `Amanah_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl">Transaction Ledger</h1>
          <p className="text-xs text-[#45464d] font-medium">Pemantauan arus kas masuk dan keluar secara presisi real-time.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            className="h-9 border-[#c6c6cd] text-xs font-semibold px-3 rounded-lg"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Ekspor CSV
          </Button>
          <TransactionForm accounts={accounts} categories={categories} />
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filter & Ledger Table (Spans 8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Filter Bar */}
          <div className="bg-white border border-[#e2e8f0] p-4 rounded-xl flex flex-wrap items-center gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-2.5 text-[#45464d] h-4 w-4" />
              <Input
                placeholder="Cari transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 border-[#e2e8f0] rounded-lg text-xs"
              />
            </div>
            <div className="w-[140px]">
              <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'ALL')}>
                <SelectTrigger className="border-[#e2e8f0] rounded-lg text-xs">
                  <SelectValue placeholder="Semua Tipe">
                    {typeFilter === 'ALL' ? 'Semua Tipe' : typeFilter === 'INCOME' ? 'Pemasukan' : typeFilter === 'EXPENSE' ? 'Pengeluaran' : 'Transfer'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#e2e8f0]">
                  <SelectItem value="ALL" className="text-xs">Semua Tipe</SelectItem>
                  <SelectItem value="INCOME" className="text-xs">Pemasukan</SelectItem>
                  <SelectItem value="EXPENSE" className="text-xs">Pengeluaran</SelectItem>
                  <SelectItem value="TRANSFER" className="text-xs">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || 'ALL')}>
                <SelectTrigger className="border-[#e2e8f0] rounded-lg text-xs">
                  <SelectValue placeholder="Semua Kategori">
                    {categoryFilter === 'ALL' ? 'Semua Kategori' : categories.find((c) => c.id === categoryFilter)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#e2e8f0]">
                  <SelectItem value="ALL" className="text-xs">Semua Kategori</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="text-xs">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Ledger Table Container */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#e2e8f0] bg-slate-50/10 flex items-center justify-between">
              <h3 className="font-bold text-black text-xs uppercase tracking-wider">Daftar Transaksi</h3>
              <span className="text-[#45464d] text-[10px] font-bold">
                Menampilkan {filteredTransactions.length} transaksi
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f2f4f6] text-[#45464d] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="px-6 py-3.5 font-bold">Tanggal</th>
                    <th className="px-6 py-3.5 font-bold">Deskripsi</th>
                    <th className="px-6 py-3.5 font-bold">Kategori</th>
                    <th className="px-6 py-3.5 font-bold">Akun</th>
                    <th className="px-6 py-3.5 font-bold text-right">Jumlah</th>
                    <th className="px-6 py-3.5 w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] font-medium text-slate-800">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-[#45464d] py-12 italic">
                        Belum ada riwayat transaksi yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const amountValue = parseFloat(tx.amount);
                      
                      let typeIcon = null;
                      let amountColor = '';
                      let amountPrefix = '';

                      if (tx.type === 'INCOME') {
                        typeIcon = <ArrowUp className="text-emerald-600 mr-1 h-3.5 w-3.5 inline-block" />;
                        amountColor = 'text-[#009668]';
                        amountPrefix = '+ ';
                      } else if (tx.type === 'EXPENSE') {
                        typeIcon = <ArrowDown className="text-red-600 mr-1 h-3.5 w-3.5 inline-block" />;
                        amountColor = 'text-[#ba1a1a]';
                        amountPrefix = '- ';
                      } else {
                        typeIcon = <ArrowLeftRight className="text-blue-600 mr-1 h-3.5 w-3.5 inline-block" />;
                        amountColor = 'text-slate-800';
                      }

                      return (
                        <tr key={tx.id} className="hover:bg-[#f2f4f6]/30 transition-colors">
                          <td className="px-6 py-4 text-[#45464d] whitespace-nowrap font-mono">
                            {formatDate(tx.transaction_date)}
                          </td>
                          <td className="px-6 py-4 font-bold text-black max-w-[200px] truncate">
                            {tx.description || <span className="text-slate-400 font-normal italic">Tanpa deskripsi</span>}
                          </td>
                          <td className="px-6 py-4">
                            {tx.categories?.name ? (
                              <span className="px-2 py-0.5 bg-[#f2f4f6] text-[#45464d] text-[10px] font-bold rounded uppercase">
                                {tx.categories.name}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-[#45464d]">
                            {tx.type === 'TRANSFER' && tx.destination_account ? (
                              <div className="flex items-center space-x-1 font-semibold text-slate-700">
                                <span>{tx.accounts?.name}</span>
                                <span className="text-slate-400">→</span>
                                <span>{tx.destination_account.name}</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-slate-700">{tx.accounts?.name}</span>
                            )}
                          </td>
                          <td className={`px-6 py-4 text-right font-bold font-mono ${amountColor}`}>
                            <div className="flex items-center justify-end">
                              {typeIcon}
                              {amountPrefix}
                              {formatRupiah(amountValue)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingId === tx.id}
                              onClick={() => handleDelete(tx.id)}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-7 w-7 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Spending Analytics Panel (Spans 4 columns) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-xl space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-black text-sm uppercase tracking-wider">Spending Analytics</h3>
              <Info className="h-4 w-4 text-[#45464d]" />
            </div>

            {/* Total Net Outflow Info Card */}
            <div className="p-4 bg-[#f7f9fb] border border-[#e2e8f0] rounded-lg">
              <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider mb-1">Total Pengeluaran Bulan Ini</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-black">
                  {formatRupiah(spendingAnalytics.totalOutflow)}
                </span>
                <span className="text-[10px] font-bold text-[#ba1a1a] flex items-center">
                  <TrendingUp className="h-3.5 w-3.5 mr-0.5" />
                  Bulan Ini
                </span>
              </div>
              <p className="text-[9px] text-[#45464d] mt-0.5">Dihitung dari pengeluaran bulan berjalan</p>
            </div>

            {/* Category Breakdown list */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#45464d] uppercase tracking-wider border-b border-slate-100 pb-1.5">
                <span>Berdasarkan Kategori</span>
                <span>Bobot Pengeluaran</span>
              </div>

              <div className="space-y-3.5">
                {spendingAnalytics.breakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Belum ada pengeluaran terdaftar.</p>
                ) : (
                  spendingAnalytics.breakdown.map((item, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-black">{item.name}</span>
                        <span className="font-bold text-slate-800 font-mono">{formatRupiah(item.amount)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#eceef0] rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${idx === 0 ? 'bg-black' : idx === 1 ? 'bg-[#505f76]' : 'bg-[#7c839b]'}`} 
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Liquidity Insight Card */}
            <div className="p-4 border-l-2 border-black bg-[#f2f4f6] rounded-r-lg space-y-1.5">
              <div className="flex items-center gap-1.5 text-black">
                <Lightbulb className="h-4 w-4 text-black fill-black" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Liquidity Insight</span>
              </div>
              <p className="text-[11px] text-[#45464d] leading-relaxed font-medium">
                Porsi pengeluaran Anda didominasi oleh kategori yang telah Anda buat. Pengeluaran diskresioner Anda tetap berada di koridor <span className="font-bold text-black">Optimal Precision</span> dari total saldo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
