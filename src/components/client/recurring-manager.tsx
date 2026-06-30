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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '../ui/dialog';
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Play,
  RefreshCw,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { actionCreateRecurring, actionDeleteRecurring, actionExecuteRecurring } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { formatRupiah, formatDate, parseFormattedNumber } from '@/utils/format';

interface Account { id: string; name: string; balance: number; }
interface Category { id: string; name: string; type: string; }
interface Recurring {
  id: string;
  amount: string | number;
  type: 'INCOME' | 'EXPENSE';
  description: string | null;
  frequency: string;
  day_of_month: number | null;
  next_due: string;
  accounts: { id: string; name: string } | null;
  categories: { id: string; name: string } | null;
}

interface RecurringManagerProps {
  recurrings: Recurring[];
  accounts: Account[];
  categories: Category[];
  profile: string;
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'Harian',
  WEEKLY: 'Mingguan',
  MONTHLY: 'Bulanan',
};

export default function RecurringManager({ recurrings, accounts, categories, profile }: RecurringManagerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [nextDue, setNextDue] = useState(new Date().toISOString().split('T')[0]);

  const today = new Date().toISOString().split('T')[0];
  const dueToday = recurrings.filter((r) => r.next_due <= today);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!accountId) { setErrorMsg('Pilih rekening terlebih dahulu.'); return; }
    const amt = parseFormattedNumber(amount);
    if (amt <= 0) { setErrorMsg('Jumlah harus lebih dari 0.'); return; }

    setLoading(true);
    try {
      const result = await actionCreateRecurring({
        accountId,
        categoryId: categoryId || undefined,
        amount: amt,
        type,
        description: description || undefined,
        frequency,
        nextDue,
      });
      if (!result.success) { setErrorMsg(result.error); }
      else {
        router.refresh();
        setOpen(false);
        setAccountId(''); setCategoryId(''); setAmount(''); setDescription('');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (id: string) => {
    setExecutingId(id);
    try {
      const result = await actionExecuteRecurring(id);
      if (!result.success) alert(`Gagal eksekusi: ${result.error}`);
      else router.refresh();
    } finally {
      setExecutingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus transaksi berulang ini?')) return;
    setDeletingId(id);
    try {
      const result = await actionDeleteRecurring(id);
      if (!result.success) alert(`Gagal: ${result.error}`);
      else router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl">Transaksi Berulang</h1>
          <p className="text-xs text-[#45464d] font-medium">
            Kelola cicilan, langganan, dan pemasukan rutin &bull; Profil: <strong>{profile === 'yoga' ? '🧘 Yoga' : '🌿 Silva'}</strong>
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setErrorMsg(null); }}>
          <DialogTrigger render={
            <button className="flex items-center gap-1.5 px-4 py-2 bg-black text-white hover:bg-black/90 transition-all text-xs font-bold rounded-lg shrink-0">
              <Plus className="h-4 w-4" />
              <span>Tambah Recurring</span>
            </button>
          } />
          <DialogContent className="sm:max-w-[440px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-slate-800 text-lg font-bold">Buat Transaksi Berulang</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Contoh: gaji bulanan, cicilan, langganan streaming.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{errorMsg}</span>
                </div>
              )}
              {/* Tipe */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Tipe</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['EXPENSE', 'INCOME'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => { setType(t); setCategoryId(''); }}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${type === t
                        ? t === 'INCOME' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-red-50 border-red-500 text-red-600'
                        : 'border-[#e2e8f0] text-slate-500 hover:bg-slate-50'}`}>
                      {t === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Rekening */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Rekening</Label>
                <Select value={accountId} onValueChange={(val) => setAccountId(val || '')}>
                  <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                    <SelectValue placeholder="Pilih rekening...">
                      {accounts.find(a => a.id === accountId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#e2e8f0]">
                    {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Kategori */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Kategori (Opsional)</Label>
                <Select value={categoryId} onValueChange={(val) => setCategoryId(val || '')}>
                  <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                    <SelectValue placeholder="Pilih kategori...">
                      {categories.find(c => c.id === categoryId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#e2e8f0]">
                    {categories.filter((c) => c.type === type).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Jumlah */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Jumlah (Rupiah)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                  <Input type="text" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold" required />
                </div>
              </div>
              {/* Deskripsi */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Deskripsi</Label>
                <Input type="text" placeholder="Contoh: Gaji bulanan, Netflix, Cicilan motor..."
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  className="border-[#e2e8f0] rounded-lg" />
              </div>
              {/* Frekuensi */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">Frekuensi</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency((v || 'MONTHLY') as 'DAILY' | 'WEEKLY' | 'MONTHLY')}>
                    <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                      <SelectValue>
                        {frequency === 'DAILY' ? 'Harian' : frequency === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#e2e8f0]">
                      <SelectItem value="DAILY">Harian</SelectItem>
                      <SelectItem value="WEEKLY">Mingguan</SelectItem>
                      <SelectItem value="MONTHLY">Bulanan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">Mulai / Jatuh Tempo</Label>
                  <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)}
                    className="border-[#e2e8f0] rounded-lg font-mono" required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#e2e8f0] rounded-lg">Batal</Button>
                <Button type="submit" disabled={loading} className="bg-black hover:bg-black/90 text-white rounded-lg text-xs font-bold">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Due Today Alert */}
      {dueToday.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">{dueToday.length} transaksi jatuh tempo hari ini!</p>
            <p className="text-xs text-amber-600 mt-0.5">Klik tombol ▶ untuk mengeksekusi sekarang.</p>
          </div>
        </div>
      )}

      {/* Recurring List */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e2e8f0] bg-slate-50/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-black flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Daftar Transaksi Berulang Aktif
          </h3>
          <span className="text-[10px] text-slate-400 font-medium">{recurrings.length} aktif</span>
        </div>

        {recurrings.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">Belum ada transaksi berulang.</p>
            <p className="text-slate-300 text-xs mt-1">Klik "Tambah Recurring" untuk mulai.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {recurrings.map((rec) => {
              const isDue = rec.next_due <= today;
              const amt = parseFloat(String(rec.amount));
              return (
                <div key={rec.id} className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDue ? 'bg-amber-50/30' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${rec.type === 'INCOME' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {rec.type === 'INCOME'
                        ? <ArrowUp className="h-4 w-4 text-emerald-600" />
                        : <ArrowDown className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-black truncate">
                        {rec.description || rec.categories?.name || 'Transaksi Berulang'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] bg-[#f2f4f6] text-[#45464d] px-2 py-0.5 rounded font-bold">
                          {FREQ_LABELS[rec.frequency]}
                        </span>
                        <span className="text-[10px] text-slate-400">Rekening: {rec.accounts?.name}</span>
                        {rec.categories && (
                          <span className="text-[10px] text-slate-400">• {rec.categories.name}</span>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold ${isDue ? 'text-amber-600' : 'text-slate-400'}`}>
                        <Calendar className="h-3 w-3" />
                        {isDue ? 'Jatuh tempo: ' : 'Berikutnya: '}{formatDate(rec.next_due)}
                        {isDue && ' — SEGERA EKSEKUSI'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <p className={`text-sm font-bold font-mono ${rec.type === 'INCOME' ? 'text-[#009668]' : 'text-[#ba1a1a]'}`}>
                      {rec.type === 'INCOME' ? '+' : '-'}{formatRupiah(amt)}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={executingId === rec.id}
                        onClick={() => handleExecute(rec.id)}
                        className={`h-8 w-8 rounded-lg ${isDue ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title="Eksekusi sekarang"
                      >
                        {executingId === rec.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === rec.id}
                        onClick={() => handleDelete(rec.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
