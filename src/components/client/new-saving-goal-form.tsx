'use client';

import { useState } from 'react';
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
import { Loader2, Plus } from 'lucide-react';
import { actionCreateSavingGoal } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { parseFormattedNumber } from '@/utils/format';

export default function NewSavingGoalForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      alert('Nama target wajib diisi.');
      return;
    }

    const targetVal = parseFormattedNumber(targetAmount);
    if (targetVal <= 0) {
      alert('Jumlah target harus lebih dari 0.');
      return;
    }

    const currentVal = currentAmount ? parseFormattedNumber(currentAmount) : 0;
    if (currentVal < 0) {
      alert('Jumlah tabungan saat ini tidak boleh negatif.');
      return;
    }

    setLoading(true);

    try {
      const result = await actionCreateSavingGoal({
        name,
        targetAmount: targetVal,
        currentAmount: currentVal,
        deadline: deadline || undefined,
      });

      if (!result.success) {
        alert(`Gagal: ${result.error}`);
        setLoading(false);
        return;
      }

      router.refresh();

      // Reset Form
      setName('');
      setTargetAmount('');
      setCurrentAmount('');
      setDeadline('');
      setOpen(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      alert(`Gagal membuat target tabungan: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <button className="flex items-center gap-1.5 px-4 py-2 bg-black text-white hover:bg-black/90 transition-all text-xs font-bold rounded-lg shrink-0">
          <Plus className="h-4 w-4" />
          <span>Target Baru</span>
        </button>
      } />
      <DialogContent className="sm:max-w-[425px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-lg font-bold">Buat Target Tabungan Baru</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Tentukan tujuan finansial Anda (seperti beli gadget, liburan, dana darurat) dan kelola progresnya di sini.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Nama Target */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-semibold text-slate-500">Nama Impian / Target</Label>
            <Input
              id="name"
              type="text"
              placeholder="Contoh: Dana Darurat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-[#e2e8f0] rounded-lg"
              required
            />
          </div>

          {/* Jumlah Target */}
          <div className="space-y-2">
            <Label htmlFor="targetAmount" className="text-xs font-semibold text-slate-500">Nominal Target (Rupiah)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
              <Input
                id="targetAmount"
                type="text"
                placeholder="0"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold"
                required
              />
            </div>
          </div>

          {/* Jumlah Saat Ini */}
          <div className="space-y-2">
            <Label htmlFor="currentAmount" className="text-xs font-semibold text-slate-500">Saldo Awal Terkumpul (Opsional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
              <Input
                id="currentAmount"
                type="text"
                placeholder="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="pl-9 border-[#e2e8f0] rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline" className="text-xs font-semibold text-slate-500">Tenggat Waktu / Deadline (Opsional)</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="border-[#e2e8f0] rounded-lg font-mono"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#e2e8f0] rounded-lg"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-black hover:bg-black/90 text-white rounded-lg text-xs font-bold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Membuat...
                </>
              ) : (
                'Buat Target'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
