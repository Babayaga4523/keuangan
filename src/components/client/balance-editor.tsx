'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '../ui/dialog';
import { Pencil, Loader2 } from 'lucide-react';
import { actionUpdateAccountBalance } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { parseFormattedNumber } from '@/utils/format';

interface BalanceEditorProps {
  accountId: string;
  accountName: string;
  currentBalance: number;
}

export default function BalanceEditor({ accountId, accountName, currentBalance }: BalanceEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(currentBalance.toLocaleString('id-ID'));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const val = parseFormattedNumber(balance);
    if (val < 0) {
      setErrorMsg('Saldo tidak boleh negatif');
      return;
    }

    setLoading(true);
    try {
      const res = await actionUpdateAccountBalance({ accountId, balance: val });
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
        setOpen(false);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setErrorMsg(null); setBalance(currentBalance.toLocaleString('id-ID')); } }}>
      <DialogTrigger render={
        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-black transition-colors" title="Koreksi saldo rekening">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      } />
      <DialogContent className="sm:max-w-[360px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-sm font-bold">Koreksi Saldo Rekening</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Perbarui nominal saldo aktif untuk rekening <strong>{accountName}</strong> secara langsung.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          {errorMsg && (
            <div className="p-2 text-[11px] bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {errorMsg}
            </div>
          )}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Jumlah Saldo Baru (Rp)</span>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-slate-400">Rp</span>
              <Input
                type="text"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="pl-9 text-xs font-mono font-semibold"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="text-xs h-8">
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="text-xs h-8 bg-black hover:bg-black/90 text-white font-bold">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
