'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '../ui/dialog';
import { Loader2, Trash2, AlertCircle } from 'lucide-react';
import { actionDeleteAccount } from '@/lib/actions';
import { useRouter } from 'next/navigation';

interface DeleteAccountDialogProps {
  accountId: string;
  accountName: string;
}

export default function DeleteAccountDialog({ accountId, accountName }: DeleteAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDelete = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await actionDeleteAccount(accountId);
      if (!res.success) {
        setErrorMsg(res.error || 'Terjadi kesalahan saat menghapus rekening');
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setErrorMsg(null); }}>
      <DialogTrigger render={
        <button className="p-1 rounded bg-[#fff0f0] text-[#ba1a1a] hover:bg-[#ffe4e4] transition-colors border border-[#ffcfcf]" title="Hapus Rekening">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      } />
      <DialogContent className="sm:max-w-[400px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-lg font-bold">Hapus Rekening</DialogTitle>
          <DialogDescription className="text-slate-600 text-sm mt-2">
            Apakah Anda yakin ingin menghapus rekening <strong>{accountName}</strong>?
            <br /><br />
            Data transaksi yang terhubung dengan rekening ini tidak akan dihapus untuk menjaga integritas riwayat, namun rekening ini tidak akan muncul lagi di Dashboard Anda.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
          {errorMsg && (
            <div className="p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#e2e8f0] rounded-lg text-xs">
              Batal
            </Button>
            <Button type="button" onClick={handleDelete} disabled={loading} className="bg-[#ba1a1a] hover:bg-[#930f0f] text-white rounded-lg text-xs font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hapus Rekening'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
