'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
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
import { Loader2, Upload, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { actionImportCSV } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { formatRupiah } from '@/utils/format';

interface Account {
  id: string;
  name: string;
}

interface ImportCSVDialogProps {
  accounts: Account[];
}

export default function ImportCSVDialog({ accounts }: ImportCSVDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [accountId, setAccountId] = useState('');
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<any[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        setErrorMsg('File CSV tidak memiliki baris data.');
        return;
      }

      // Deteksi pembatas (koma atau titik koma)
      const header = lines[0];
      const delimiter = header.includes(';') ? ';' : ',';

      const results = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
        if (columns.length < 4) continue;

        // Kolom dipetakan default: Tanggal, Deskripsi, Tipe (INCOME/EXPENSE), Jumlah
        const date = columns[0];
        const description = columns[1];
        const typeStr = columns[2].toUpperCase();
        const amountVal = parseFloat(columns[3].replace(/[^0-9.-]/g, ''));

        if (!date || !description || isNaN(amountVal)) continue;

        results.push({
          date: date.match(/^\d{4}-\d{2}-\d{2}$/) ? date : new Date(date).toISOString().split('T')[0],
          description,
          type: typeStr.includes('MASUK') || typeStr.includes('INC') || typeStr.includes('INCOME') ? 'INCOME' : 'EXPENSE',
          amount: Math.abs(amountVal)
        });
      }

      if (results.length === 0) {
        setErrorMsg('Format kolom CSV tidak dikenal. Pastikan urutan: Tanggal (YYYY-MM-DD), Deskripsi, Tipe (INCOME/EXPENSE), Jumlah.');
      } else {
        setParsedData(results);
        setErrorMsg(null);
      }
    } catch (err) {
      setErrorMsg('Gagal membaca file CSV. Pastikan format penulisan benar.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!accountId) {
      setErrorMsg('Pilih rekening tujuan import terlebih dahulu.');
      return;
    }

    if (parsedData.length === 0) {
      setErrorMsg('Belum ada data CSV yang valid untuk di-import.');
      return;
    }

    setLoading(true);
    try {
      const formattedList = parsedData.map((item) => ({
        accountId,
        amount: item.amount,
        type: item.type,
        description: item.description,
        date: item.date,
      }));

      const res = await actionImportCSV(formattedList);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
        setOpen(false);
        setParsedData([]);
        setFileContent('');
        setAccountId('');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setErrorMsg(null); setParsedData([]); } }}>
      <DialogTrigger render={
        <button className="flex items-center gap-1 px-3 py-1.5 bg-[#f2f4f6] text-[#45464d] hover:bg-[#eceef0] rounded-lg text-xs font-bold transition-all">
          <Upload className="h-3.5 w-3.5" />
          <span>Import CSV</span>
        </button>
      } />
      <DialogContent className="sm:max-w-[460px] border border-[#e2e8f0] bg-white rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-lg font-bold">Import CSV Transaksi</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Unggah mutasi transaksi massal Anda. Pastikan format kolom: Tanggal (YYYY-MM-DD), Deskripsi, Tipe (INCOME/EXPENSE), Jumlah.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Rekening */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500">Pilih Rekening Tujuan</Label>
            <Select value={accountId} onValueChange={(val) => setAccountId(val || '')}>
              <SelectTrigger className="border-[#e2e8f0] rounded-lg">
                <SelectValue placeholder="Pilih rekening...">
                  {accounts.find(a => a.id === accountId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-[#e2e8f0]">
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CSV File Input */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500">Upload File CSV</Label>
            <div className="border border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-xs text-slate-500 font-medium">Klik untuk pilih file mutasi bank</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Previews */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Preview Transaksi ({parsedData.length} baris)</span>
              <div className="max-h-[140px] overflow-y-auto border border-[#e2e8f0] rounded-lg divide-y divide-[#e2e8f0]">
                {parsedData.slice(0, 5).map((row, idx) => (
                  <div key={idx} className="p-2 text-[10px] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-black truncate max-w-[200px]">{row.description}</p>
                      <p className="text-slate-400 font-mono">{row.date}</p>
                    </div>
                    <span className={`font-bold font-mono ${row.type === 'INCOME' ? 'text-[#009668]' : 'text-[#ba1a1a]'}`}>
                      {row.type === 'INCOME' ? '+' : '-'}{formatRupiah(row.amount)}
                    </span>
                  </div>
                ))}
                {parsedData.length > 5 && (
                  <div className="p-2 text-center text-slate-400 text-[9px] bg-slate-50">
                    + {parsedData.length - 5} baris mutasi lainnya...
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#e2e8f0] rounded-lg">
              Batal
            </Button>
            <Button type="submit" disabled={loading || parsedData.length === 0} className="bg-black hover:bg-black/90 text-white rounded-lg text-xs font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eksekusi Import'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
