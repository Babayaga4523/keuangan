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
  DialogDescription,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, Plus, AlertCircle } from 'lucide-react';
import { actionCreateAccount } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { parseFormattedNumber } from '@/utils/format';

export default function AddAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'CASH' | 'BANK' | 'E_WALLET'>('BANK');
  const [balance, setBalance] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Nama rekening wajib diisi.');
      return;
    }

    const initialBalance = parseFormattedNumber(balance || '0');
    if (initialBalance < 0) {
      setErrorMsg('Saldo awal tidak boleh negatif.');
      return;
    }

    setLoading(true);
    try {
      const res = await actionCreateAccount({ name, type, balance: initialBalance });
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
        setOpen(false);
        setName('');
        setBalance('');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setErrorMsg(null); }}>
      <DialogTrigger render={
        <button className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-black/90 text-white rounded-lg text-xs font-bold transition-all shadow-sm">
          <Plus className="h-4.5 w-4.5" />
          <span>Tambah Rekening</span>
        </button>
      } />
      <DialogContent className="sm:max-w-[400px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-lg font-bold">Rekening Baru</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Buat akun tabungan, bank, dompet fisik, atau e-wallet baru.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nama Rekening */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500">Nama Rekening</Label>
            <Input
              type="text"
              placeholder="Contoh: SeaBank, GoPay, Cash Fisik..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-[#e2e8f0] rounded-lg"
              required
            />
          </div>

          {/* Jenis */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500">Jenis Rekening</Label>
            <Select value={type} onValueChange={(val) => setType(val as 'CASH' | 'BANK' | 'E_WALLET')}>
              <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-[#e2e8f0]">
                <SelectItem value="BANK">Bank / Rekening Tabungan</SelectItem>
                <SelectItem value="E_WALLET">E-Wallet (Gopay, OVO, dll)</SelectItem>
                <SelectItem value="CASH">Cash / Uang Tunai</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Saldo Awal */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500">Saldo Awal (Rupiah)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
              <Input
                type="text"
                placeholder="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#e2e8f0] rounded-lg">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="bg-black hover:bg-black/90 text-white rounded-lg text-xs font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Rekening'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
