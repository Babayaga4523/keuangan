'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Progress } from '../ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '../ui/dialog';
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { actionUpsertBudget, actionDeleteBudget } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { formatRupiah, parseFormattedNumber } from '@/utils/format';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Budget {
  id: string;
  category_id: string;
  amount: string | number;
  month: number;
  year: number;
  categories: { id: string; name: string } | null;
}

interface TxRow {
  category_id: string | null;
  amount: string | number;
}

interface BudgetManagerProps {
  categories: Category[];
  budgets: Budget[];
  transactions: TxRow[];
  month: number;
  year: number;
  profile: string;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function BudgetManager({ categories, budgets, transactions, month, year, profile }: BudgetManagerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  // Calculate spent per category from transactions
  const spentByCategory: Record<string, number> = {};
  transactions.forEach((tx) => {
    if (tx.category_id) {
      spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] || 0) + parseFloat(String(tx.amount));
    }
  });

  const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(String(b.amount)), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (spentByCategory[b.category_id] || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!categoryId) { setErrorMsg('Pilih kategori terlebih dahulu.'); return; }
    const amt = parseFormattedNumber(amount);
    if (amt <= 0) { setErrorMsg('Jumlah budget harus lebih dari 0.'); return; }

    setLoading(true);
    try {
      const result = await actionUpsertBudget({ categoryId, amount: amt, month, year });
      if (!result.success) { setErrorMsg(result.error); }
      else { router.refresh(); setOpen(false); setCategoryId(''); setAmount(''); }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const result = await actionDeleteBudget(id);
      if (!result.success) alert(`Gagal: ${result.error}`);
      else router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const availableCategories = categories.filter(
    (c) => !budgets.some((b) => b.category_id === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl">Budget Bulanan</h1>
          <p className="text-xs text-[#45464d] font-medium">
            Kelola batas pengeluaran per kategori — {MONTH_NAMES[month - 1]} {year} &bull; Profil: <strong>{profile === 'yoga' ? '🧘 Yoga' : '🌿 Silva'}</strong>
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setErrorMsg(null); }}>
          <DialogTrigger render={
            <button className="flex items-center gap-1.5 px-4 py-2 bg-black text-white hover:bg-black/90 transition-all text-xs font-bold rounded-lg shrink-0">
              <Plus className="h-4 w-4" />
              <span>Tambah Budget</span>
            </button>
          } />
          <DialogContent className="sm:max-w-[400px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-slate-800 text-lg font-bold">Set Budget Kategori</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Tentukan batas pengeluaran untuk kategori ini bulan {MONTH_NAMES[month - 1]}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Kategori Pengeluaran</Label>
                <Select value={categoryId} onValueChange={(val) => setCategoryId(val || '')}>
                  <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                    <SelectValue placeholder="Pilih kategori...">
                      {categories.find((c) => c.id === categoryId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#e2e8f0]">
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Batas Budget (Rupiah)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                  <Input
                    type="text"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#e2e8f0] rounded-lg">Batal</Button>
                <Button type="submit" disabled={loading} className="bg-black hover:bg-black/90 text-white rounded-lg text-xs font-bold">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Budget'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider mb-1">Total Budget</p>
          <p className="text-2xl font-bold font-mono text-black">{formatRupiah(totalBudget)}</p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider mb-1">Terpakai</p>
          <p className={`text-2xl font-bold font-mono ${totalSpent > totalBudget ? 'text-[#ba1a1a]' : 'text-black'}`}>
            {formatRupiah(totalSpent)}
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <p className="text-[10px] font-bold text-[#45464d] uppercase tracking-wider mb-1">Sisa Budget</p>
          <p className={`text-2xl font-bold font-mono ${totalBudget - totalSpent < 0 ? 'text-[#ba1a1a]' : 'text-[#009668]'}`}>
            {formatRupiah(Math.max(totalBudget - totalSpent, 0))}
          </p>
        </div>
      </div>

      {/* Budget List */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e2e8f0] bg-slate-50/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-black flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Progres Budget per Kategori
          </h3>
          <span className="text-[10px] text-slate-400 font-medium">{budgets.length} kategori diset</span>
        </div>

        {budgets.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">Belum ada budget yang diset untuk bulan ini.</p>
            <p className="text-slate-300 text-xs mt-1">Klik "Tambah Budget" untuk mulai.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {budgets.map((budget) => {
              const budgetAmt = parseFloat(String(budget.amount));
              const spent = spentByCategory[budget.category_id] || 0;
              const pct = budgetAmt > 0 ? Math.min((spent / budgetAmt) * 100, 100) : 0;
              const isOver = spent > budgetAmt;
              const isWarning = pct >= 80 && !isOver;

              return (
                <div key={budget.id} className="px-6 py-4 flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isOver ? (
                        <AlertCircle className="h-4 w-4 text-[#ba1a1a] shrink-0" />
                      ) : isWarning ? (
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-[#009668] shrink-0" />
                      )}
                      <span className="text-sm font-bold text-black">{budget.categories?.name}</span>
                      {isOver && (
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-red-50 text-[#ba1a1a] rounded-full">OVER BUDGET</span>
                      )}
                      {isWarning && (
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">HAMPIR HABIS</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      <span className="text-xs font-mono text-slate-500">
                        {formatRupiah(spent)} / {formatRupiah(budgetAmt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === budget.id}
                        onClick={() => handleDelete(budget.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-7 w-7 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={pct}
                      className={`h-2 flex-1 ${isOver ? '[&>div]:bg-[#ba1a1a]' : isWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-[#009668]'} bg-[#f2f4f6]`}
                    />
                    <span className={`text-[10px] font-bold font-mono w-10 text-right ${isOver ? 'text-[#ba1a1a]' : isWarning ? 'text-amber-600' : 'text-[#009668]'}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
