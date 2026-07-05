'use client';

import { Download } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: string;
}

interface AccountTableActionsProps {
  accounts: Account[];
}

export default function AccountTableActions({ accounts }: AccountTableActionsProps) {
  const handleExport = () => {
    const headers = ['Nama Rekening', 'Tipe', 'Saldo (IDR)'];
    const rows = accounts.map((a) => [
      a.name,
      a.type === 'CASH' ? 'Tunai' : 'Bank/E-Wallet',
      a.balance
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Silva_Yoga_Rekening_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button 
      onClick={handleExport}
      className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#eceef0] transition-colors text-[#45464d] hover:text-black cursor-pointer"
      title="Ekspor daftar rekening ke CSV"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
