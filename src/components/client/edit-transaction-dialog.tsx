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
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { actionUpdateTransaction } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { parseFormattedNumber } from '@/utils/format';

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface EditTransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    amount: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    transaction_date: string;
    description: string | null;
    categories: { id: string; name: string } | null;
    tags?: string | null;
    receipt_url?: string | null;
  };
  categories: Category[];
}

export default function EditTransactionDialog({
  open,
  onClose,
  transaction,
  categories,
}: EditTransactionDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [amount, setAmount] = useState(parseFloat(transaction.amount).toLocaleString('id-ID'));
  const [categoryId, setCategoryId] = useState(transaction.categories?.id || '');
  const [description, setDescription] = useState(transaction.description || '');
  const [date, setDate] = useState(transaction.transaction_date);
  const [tags, setTags] = useState(transaction.tags || '');
  const [receiptUrl, setReceiptUrl] = useState(transaction.receipt_url || '');

  const filteredCategories = categories.filter((c) => c.type === transaction.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (transaction.type === 'TRANSFER') {
      setErrorMsg('Transaksi transfer tidak bisa diedit. Hapus dan buat ulang.');
      return;
    }

    const amt = parseFormattedNumber(amount);
    if (amt <= 0) {
      setErrorMsg('Jumlah harus lebih dari 0.');
      return;
    }

    setLoading(true);
    try {
      const result = await actionUpdateTransaction({
        id: transaction.id,
        amount: amt,
        categoryId: categoryId || undefined,
        description: description || undefined,
        date,
        tags: tags || undefined,
        receiptUrl: receiptUrl || undefined,
      });

      if (!result.success) {
        setErrorMsg(result.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[425px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-lg font-bold">Edit Transaksi</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Ubah detail transaksi. Saldo rekening akan disesuaikan otomatis.
          </DialogDescription>
        </DialogHeader>

        {transaction.type === 'TRANSFER' ? (
          <div className="py-4 text-center">
            <p className="text-sm text-slate-500">
              Transaksi <strong>Transfer</strong> tidak dapat diedit.
            </p>
            <p className="text-xs text-slate-400 mt-1">Hapus transaksi ini dan buat ulang jika perlu.</p>
            <Button onClick={onClose} className="mt-4 bg-black text-white hover:bg-black/90 rounded-lg text-xs">
              Tutup
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Jumlah */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Jumlah (Rupiah)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold"
                  required
                />
              </div>
            </div>

            {/* Kategori */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Kategori</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v || '')}>
                <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                  <SelectValue placeholder="Pilih kategori...">
                    {categories.find((c) => c.id === categoryId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#e2e8f0]">
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="hover:bg-slate-50">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tanggal */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Tanggal</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border-[#e2e8f0] rounded-lg font-mono"
                required
              />
            </div>

            {/* Deskripsi */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Deskripsi / Catatan</Label>
              <Input
                type="text"
                placeholder="Opsional..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-[#e2e8f0] rounded-lg"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Tag (Pemisah Koma)</Label>
              <Input
                type="text"
                placeholder="Contoh: makan, liburan, kerja"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="border-[#e2e8f0] rounded-lg"
              />
            </div>

            {/* Upload Struk */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Ganti Foto Struk</Label>
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setReceiptUrl(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="border-[#e2e8f0] rounded-lg text-xs"
                />
                {receiptUrl && (
                  <div className="relative w-20 h-20 border border-slate-200 rounded overflow-hidden">
                    <img src={receiptUrl} alt="Preview Struk" className="object-cover w-full h-full" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="border-[#e2e8f0] rounded-lg">
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="bg-black hover:bg-black/90 text-white rounded-lg text-xs font-bold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
