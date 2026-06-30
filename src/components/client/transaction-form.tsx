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
  SelectValue 
} from '../ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from '../ui/dialog';
import { Loader2, Plus, AlertCircle } from 'lucide-react';
import { actionCreateTransaction, actionCreateTransfer } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { parseFormattedNumber } from '@/utils/format';

interface Account {
  id: string;
  name: string;
  balance: number;
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface TransactionFormProps {
  accounts: Account[];
  categories: Category[];
  profile?: string;
}

export default function TransactionForm({ accounts, categories, profile = 'silva' }: TransactionFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Form states
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');

  // Filter categories by selected transaction type
  const filteredCategories = categories.filter((cat) => cat.type === type);

  const resetForm = () => {
    setAccountId('');
    setDestinationAccountId('');
    setCategoryId('');
    setAmount('');
    setDescription('');
    setTags('');
    setReceiptUrl('');
    setDate(new Date().toISOString().split('T')[0]);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!accountId) {
      setErrorMsg('Silakan pilih rekening asal.');
      return;
    }

    const numericAmount = parseFormattedNumber(amount);
    if (numericAmount <= 0) {
      setErrorMsg('Jumlah transaksi harus lebih dari 0.');
      return;
    }

    setLoading(true);

    try {
      if (type === 'TRANSFER') {
        if (!destinationAccountId) {
          setErrorMsg('Silakan pilih rekening tujuan untuk transfer.');
          setLoading(false);
          return;
        }

        const result = await actionCreateTransfer({
          fromAccountId: accountId,
          toAccountId: destinationAccountId,
          amount: numericAmount,
          description: description || undefined,
          date,
        });

        if (!result.success) {
          setErrorMsg(result.error);
          setLoading(false);
          return;
        }
      } else {
        const result = await actionCreateTransaction({
          accountId,
          categoryId: categoryId || undefined,
          amount: numericAmount,
          type,
          description: description || undefined,
          date,
          receiptUrl: receiptUrl || undefined,
          tags: tags || undefined,
        });

        if (!result.success) {
          setErrorMsg(result.error);
          setLoading(false);
          return;
        }
      }

      // Success
      router.refresh();
      resetForm();
      setOpen(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      setErrorMsg(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setErrorMsg(null); } }}>
      <DialogTrigger render={
        <button className="flex items-center gap-1.5 px-4 py-2 bg-black text-white hover:bg-black/90 transition-all text-xs font-bold rounded-lg shrink-0">
          <Plus className="h-4 w-4" />
          <span>Catat Transaksi</span>
        </button>
      } />
      <DialogContent className="sm:max-w-[425px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-slate-800 text-lg font-bold">Catat Transaksi Baru</DialogTitle>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider uppercase ${
              profile === 'yoga' 
                ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}>
              {profile === 'yoga' ? '🧘 Yoga' : '🌿 Silva'}
            </span>
          </div>
          <DialogDescription className="text-slate-400 text-xs">
            Transaksi akan dicatat ke profil <strong>{profile === 'yoga' ? 'Yoga' : 'Silva'}</strong>. Pastikan rekening yang dipilih sudah benar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-red-650 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tipe Transaksi */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500">Tipe Transaksi</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setCategoryId('');
                    setDestinationAccountId('');
                    setErrorMsg(null);
                  }}
                  className={`
                    py-2 text-xs font-semibold rounded-lg border transition-all duration-200
                    ${type === t 
                      ? t === 'INCOME' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                        : t === 'EXPENSE'
                        ? 'bg-red-50 border-red-500 text-red-600'
                        : 'bg-blue-50 border-blue-500 text-blue-600'
                      : 'border-[#e2e8f0] text-slate-500 hover:bg-slate-50'
                    }
                  `}
                >
                  {t === 'INCOME' ? 'Masuk' : t === 'EXPENSE' ? 'Keluar' : 'Transfer'}
                </button>
              ))}
            </div>
          </div>

          {/* Rekening Asal */}
          <div className="space-y-2">
            <Label htmlFor="accountId" className="text-xs font-semibold text-slate-500">
              {type === 'TRANSFER' ? 'Dari Rekening' : 'Pilih Rekening'}
            </Label>
            <Select value={accountId} onValueChange={(val) => setAccountId(val || '')}>
              <SelectTrigger id="accountId" className="border-[#e2e8f0] rounded-lg">
                <SelectValue placeholder="Pilih rekening...">
                  {accounts.find((acc) => acc.id === accountId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-[#e2e8f0]">
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} className="hover:bg-slate-50">
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rekening Tujuan (Hanya untuk TRANSFER) */}
          {type === 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="destinationAccountId" className="text-xs font-semibold text-slate-500">Ke Rekening</Label>
              <Select value={destinationAccountId} onValueChange={(val) => setDestinationAccountId(val || '')}>
                <SelectTrigger id="destinationAccountId" className="border-[#e2e8f0] rounded-lg">
                  <SelectValue placeholder="Pilih rekening tujuan...">
                    {accounts.find((acc) => acc.id === destinationAccountId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#e2e8f0]">
                  {accounts
                    .filter((acc) => acc.id !== accountId)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="hover:bg-slate-50">
                        {acc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Kategori (Hanya untuk INCOME/EXPENSE) */}
          {type !== 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="categoryId" className="text-xs font-semibold text-slate-500">Kategori</Label>
              <Select value={categoryId} onValueChange={(val) => setCategoryId(val || '')}>
                <SelectTrigger id="categoryId" className="border-[#e2e8f0] rounded-lg">
                  <SelectValue placeholder="Pilih kategori...">
                    {categories.find((cat) => cat.id === categoryId)?.name}
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
          )}

          {/* Jumlah Transaksi */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-xs font-semibold text-slate-500">Jumlah (Rupiah)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
              <Input
                id="amount"
                type="text"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold"
                required
              />
            </div>
          </div>

          {/* Tanggal Transaksi */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-xs font-semibold text-slate-500">Tanggal</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-[#e2e8f0] rounded-lg font-mono"
              required
            />
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-semibold text-slate-500">Deskripsi / Catatan</Label>
            <Input
              id="description"
              type="text"
              placeholder="Contoh: Beli makan siang"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-[#e2e8f0] rounded-lg"
            />
          </div>

          {/* Tags (Hanya untuk INCOME/EXPENSE) */}
          {type !== 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="tags" className="text-xs font-semibold text-slate-500">Tag (Pemisah Koma)</Label>
              <Input
                id="tags"
                type="text"
                placeholder="Contoh: makan, liburan, kerja"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="border-[#e2e8f0] rounded-lg"
              />
            </div>
          )}

          {/* Upload Struk (Hanya untuk INCOME/EXPENSE) */}
          {type !== 'TRANSFER' && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Lampirkan Foto Struk</Label>
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
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetForm(); }}
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
                  Menyimpan...
                </>
              ) : (
                'Simpan Transaksi'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
