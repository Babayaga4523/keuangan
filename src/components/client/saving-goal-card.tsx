'use client';

import { useState } from 'react';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { formatRupiah, formatDate, parseFormattedNumber } from '@/utils/format';
import { 
  Edit2, 
  Trash2, 
  Calendar, 
  Loader2, 
  Wallet,
  Home,
  Shield,
  Heart,
  Laptop,
  PiggyBank,
  Moon,
  AlertCircle
} from 'lucide-react';
import { actionUpdateSavingGoal, actionDeleteSavingGoal, actionFundSavingGoal } from '@/lib/actions';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  name: string;
  balance: number;
}

interface SavingGoal {
  id: string;
  name: string;
  target_amount: string | number;
  current_amount: string | number;
  deadline: string | null;
  is_completed?: boolean;
}

interface SavingGoalCardProps {
  goal: SavingGoal;
  accounts?: Account[];
}

export default function SavingGoalCard({ goal, accounts = [] }: SavingGoalCardProps) {
  const router = useRouter();
  const target = parseFloat(goal.target_amount as string);
  const current = parseFloat(goal.current_amount as string);
  const progress = Math.min((current / target) * 100, 100);

  const [editOpen, setEditOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fundLoading, setFundLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newCurrentAmount, setNewCurrentAmount] = useState(current.toString());
  const [fundAmount, setFundAmount] = useState('');
  const [fundAccountId, setFundAccountId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Determine status label & styling dynamically based on progress
  let statusText = 'BEHIND TARGET';
  let statusStyle = 'text-[#ba1a1a] bg-red-50';
  let iconBg = 'bg-[#f2f4f6] text-black';

  if (goal.is_completed || progress >= 100) {
    statusText = 'COMPLETED';
    statusStyle = 'text-[#009668] bg-emerald-50';
  } else if (progress >= 70) {
    statusText = 'ON TRACK';
    statusStyle = 'text-[#009668] bg-emerald-50';
  } else if (progress >= 40) {
    statusText = 'ACCELERATING';
    statusStyle = 'text-[#38485d] bg-[#d0e1fb]/40';
  }

  // Determine icon based on goal name keywords
  let IconComponent = PiggyBank;
  const nameLower = goal.name.toLowerCase();
  if (nameLower.includes('umroh') || nameLower.includes('haji') || nameLower.includes('masjid') || nameLower.includes('sholat')) {
    IconComponent = Moon;
    iconBg = 'bg-emerald-50 text-[#009668]';
  } else if (nameLower.includes('darurat') || nameLower.includes('emergency') || nameLower.includes('aman') || nameLower.includes('shield')) {
    IconComponent = Shield;
    iconBg = 'bg-[#d0e1fb] text-[#38485d]';
  } else if (nameLower.includes('nikah') || nameLower.includes('kawin') || nameLower.includes('pesta')) {
    IconComponent = Heart;
    iconBg = 'bg-pink-50 text-pink-650';
  } else if (nameLower.includes('rumah') || nameLower.includes('pondok') || nameLower.includes('apartemen') || nameLower.includes('kost')) {
    IconComponent = Home;
    iconBg = 'bg-blue-50 text-blue-650';
  } else if (nameLower.includes('gadget') || nameLower.includes('hp') || nameLower.includes('laptop') || nameLower.includes('komputer')) {
    IconComponent = Laptop;
    iconBg = 'bg-purple-50 text-purple-650';
  } else {
    IconComponent = PiggyBank;
    iconBg = 'bg-slate-100 text-slate-700';
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFormattedNumber(newCurrentAmount);
    if (value < 0) {
      alert('Jumlah tabungan tidak boleh negatif.');
      return;
    }

    setLoading(true);
    try {
      const result = await actionUpdateSavingGoal(goal.id, value);
      if (!result.success) {
        alert(`Gagal: ${result.error}`);
      } else {
        router.refresh();
        setEditOpen(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      alert(`Gagal memperbarui tabungan: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fundAccountId) {
      setErrorMsg('Pilih rekening sumber dana.');
      return;
    }

    const amt = parseFormattedNumber(fundAmount);
    if (amt <= 0) {
      setErrorMsg('Jumlah setoran harus lebih dari 0.');
      return;
    }

    setFundLoading(true);
    try {
      const result = await actionFundSavingGoal({
        accountId: fundAccountId,
        goalId: goal.id,
        amount: amt,
      });

      if (!result.success) {
        setErrorMsg(result.error);
      } else {
        router.refresh();
        setFundOpen(false);
        setFundAmount('');
        setFundAccountId('');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      setErrorMsg(errorMsg);
    } finally {
      setFundLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Apakah Anda yakin ingin menghapus target tabungan "${goal.name}"?`)) {
      return;
    }

    setDeleteLoading(true);
    try {
      const result = await actionDeleteSavingGoal(goal.id);
      if (!result.success) {
        alert(`Gagal: ${result.error}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      alert(`Gagal menghapus target: ${errorMsg}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const remaining = Math.max(target - current, 0);

  return (
    <div className="bg-white border border-[#e2e8f0] p-6 rounded-xl hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all duration-200 flex flex-col justify-between h-full relative group">
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className={`w-12 h-12 ${iconBg} flex items-center justify-center rounded-lg`}>
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className={`text-[9px] font-bold px-2 py-1 rounded tracking-wider ${statusStyle}`}>
              {statusText}
            </span>

            {/* Fund Button */}
            {accounts.length > 0 && progress < 100 && (
              <Dialog open={fundOpen} onOpenChange={(v) => { setFundOpen(v); if (v) setErrorMsg(null); }}>
                <DialogTrigger render={
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 h-7 w-7 rounded-lg"
                    title="Setor dari Rekening"
                  />
                }>
                  <span className="flex items-center justify-center">
                    <Wallet className="h-3.5 w-3.5" />
                  </span>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
                  <DialogHeader>
                    <DialogTitle className="text-slate-800 text-lg font-bold">Setor ke Tabungan</DialogTitle>
                    <DialogDescription className="text-slate-400 text-xs">
                      Setor dana dari salah satu rekening Anda ke target &quot;{goal.name}&quot;. Saldo rekening akan berkurang otomatis.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleFund} className="space-y-4 py-4">
                    {errorMsg && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 text-red-650 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-500">Dari Rekening</Label>
                      <Select value={fundAccountId} onValueChange={(val) => setFundAccountId(val || '')}>
                        <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                          <SelectValue placeholder="Pilih rekening...">
                            {accounts.find((acc) => acc.id === fundAccountId) 
                              ? `${accounts.find((acc) => acc.id === fundAccountId)?.name} (${formatRupiah(accounts.find((acc) => acc.id === fundAccountId)?.balance || 0)})`
                              : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-[#e2e8f0]">
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id} className="hover:bg-slate-50">
                              {acc.name} ({formatRupiah(acc.balance)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-500">Jumlah Setoran</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                        <Input
                          type="text"
                          placeholder="0"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold"
                          required
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Sisa target: {formatRupiah(remaining)}
                      </p>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setFundOpen(false)} className="border-[#e2e8f0] rounded-lg">
                        Batal
                      </Button>
                      <Button type="submit" disabled={fundLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold">
                        {fundLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Setor Sekarang'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {/* Edit / Actions trigger */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger render={
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-slate-750 hover:bg-slate-100 h-7 w-7 rounded-lg"
                />
              }>
                <span className="flex items-center justify-center">
                  <Edit2 className="h-3.5 w-3.5" />
                </span>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-slate-800 text-lg font-bold">Update Progres Tabungan</DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs">
                    Perbarui jumlah uang yang sudah Anda sisihkan untuk target &quot;{goal.name}&quot;.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentVal" className="text-xs font-semibold text-slate-500">Jumlah Terkumpul Saat Ini</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                      <Input
                        id="currentVal"
                        type="text"
                        value={newCurrentAmount}
                        onChange={(e) => setNewCurrentAmount(e.target.value)}
                        className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">Total target: {formatRupiah(target)}</p>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditOpen(false)}
                      className="border-[#e2e8f0] rounded-lg"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-black hover:bg-black/90 text-white rounded-lg"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="icon"
              disabled={deleteLoading}
              onClick={handleDelete}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-7 w-7 rounded-lg"
            >
              {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <h3 className="text-base font-bold text-black break-words leading-tight">{goal.name}</h3>
        
        {goal.deadline ? (
          <p className="text-xs text-[#45464d] mt-1 flex items-center font-medium">
            <Calendar className="mr-1 h-3.5 w-3.5 text-[#45464d]" />
            Tenggat: {formatDate(goal.deadline)}
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Tanpa tenggat waktu</p>
        )}

        <div className="mt-6">
          <div className="flex justify-between items-end mb-2 text-xs font-semibold text-black">
            <span className="text-base font-bold font-mono">{formatRupiah(current)}</span>
            <span className="text-[#45464d] font-normal font-mono">dari {formatRupiah(target)}</span>
          </div>
          <Progress value={progress} className="h-2 bg-[#f2f4f6] [&>div]:bg-black rounded-full" />
          <p className="text-[10px] text-[#45464d] mt-2 font-bold font-mono">{progress.toFixed(1)}% Terkumpul</p>
        </div>
      </div>

      {/* Monthly contributions histogram card footer matching Stitch design */}
      <div className="mt-6 pt-5 border-t border-[#e2e8f0] w-full">
        <p className="text-[9px] font-bold text-[#45464d] mb-3 uppercase tracking-wider">Histori Kontribusi Tabungan</p>
        <div className="flex items-end gap-1 h-10 w-full px-1">
          <div className="bg-black/10 w-full h-[40%] rounded-sm"></div>
          <div className="bg-black/10 w-full h-[60%] rounded-sm"></div>
          <div className="bg-black/10 w-full h-[55%] rounded-sm"></div>
          <div className="bg-black/15 w-full h-[80%] rounded-sm"></div>
          <div className="bg-black/20 w-full h-[70%] rounded-sm"></div>
          <div className="bg-black w-full h-[95%] rounded-sm"></div>
        </div>
      </div>
    </div>
  );
}
