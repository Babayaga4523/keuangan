'use client';

import { useState, useMemo, useEffect } from 'react';
import { actionSaveSimulatorConfig } from '@/app/actions/simulator';
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
import { formatRupiah, parseFormattedNumber } from '@/utils/format';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  DollarSign 
} from 'lucide-react';

interface SimulatedItem {
  id: string;
  name: string;
  amount: number;
}

interface SimulatorManagerProps {
  liveTotalBalance: number;
  defaultMonthlyIncomes: SimulatedItem[];
  defaultMonthlyExpenses: SimulatedItem[];
  profile: string;
  accounts?: any[];
  savedConfig?: any;
}

const MONTH_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function SimulatorManager({ 
  liveTotalBalance, 
  defaultMonthlyIncomes, 
  defaultMonthlyExpenses,
  profile,
  accounts = [],
  savedConfig = null
}: SimulatorManagerProps) {
  const savedState = savedConfig?.state || {};

  // Target Dream State
  const [dreamName, setDreamName] = useState(savedState.dreamName || 'Barang Impian');
  const [dreamCost, setDreamCost] = useState(savedState.dreamCost || '0');
  const [targetMonthOffset, setTargetMonthOffset] = useState(savedState.targetMonthOffset ?? 2); 

  // Selected Account
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(savedConfig?.selected_account_id || 'all');

  // Starting Balance State
  const [startBalance, setStartBalance] = useState(savedState.startBalance || liveTotalBalance.toLocaleString('id-ID'));

  // Incomes & Expenses List
  const [incomes, setIncomes] = useState<SimulatedItem[]>(savedState.incomes || defaultMonthlyIncomes);
  const [expenses, setExpenses] = useState<SimulatedItem[]>(savedState.expenses || defaultMonthlyExpenses);

  // One-off payments (Biaya Nombok Sekali Bayar)
  const [oneOffs, setOneOffs] = useState<SimulatedItem[]>(savedState.oneOffs || []);

  // Auto Save Effect
  useEffect(() => {
    const timeout = setTimeout(() => {
      const currentState = {
        dreamName,
        dreamCost,
        targetMonthOffset,
        startBalance,
        incomes,
        expenses,
        oneOffs
      };
      actionSaveSimulatorConfig(currentState, selectedAccountId === 'all' ? null : selectedAccountId);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [dreamName, dreamCost, targetMonthOffset, startBalance, incomes, expenses, oneOffs, selectedAccountId, profile]);

  // Input states for adding new list items
  const [newIncName, setNewIncName] = useState('');
  const [newIncAmt, setNewIncAmt] = useState('');
  
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmt, setNewExpAmt] = useState('');

  const [newOneName, setNewOneName] = useState('');
  const [newOneAmt, setNewOneAmt] = useState('');

  // Add handlers
  const handleAddIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncName.trim()) return;
    const amt = parseFormattedNumber(newIncAmt || '0');
    setIncomes([...incomes, { id: Date.now().toString(), name: newIncName, amount: amt }]);
    setNewIncName(''); setNewIncAmt('');
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpName.trim()) return;
    const amt = parseFormattedNumber(newExpAmt || '0');
    setExpenses([...expenses, { id: Date.now().toString(), name: newExpName, amount: amt }]);
    setNewExpName(''); setNewExpAmt('');
  };

  const handleAddOneOff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOneName.trim()) return;
    const amt = parseFormattedNumber(newOneAmt || '0');
    setOneOffs([...oneOffs, { id: Date.now().toString(), name: newOneName, amount: amt }]);
    setNewOneName(''); setNewOneAmt('');
  };

  // Remove handlers
  const removeIncome = (id: string) => setIncomes(incomes.filter(x => x.id !== id));
  const removeExpense = (id: string) => setExpenses(expenses.filter(x => x.id !== id));
  const removeOneOff = (id: string) => setOneOffs(oneOffs.filter(x => x.id !== id));

  // Compute total monthly inputs/outflow
  const totalInflow = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalOutflow = expenses.reduce((sum, item) => sum + item.amount, 0);
  const netMonthlySurplus = totalInflow - totalOutflow;

  // ROADMAP CALCULATOR ALGORITHM
  const roadmapProjection = useMemo(() => {
    const startBal = parseFormattedNumber(startBalance);
    const dreamAmt = parseFormattedNumber(dreamCost);
    const currentDate = new Date();
    
    let currentBal = startBal;
    const monthsTimeline = [];

    // Hitung nombok sekali bayar di awal (fase pra-juli)
    const totalOneOffs = oneOffs.reduce((sum, item) => sum + item.amount, 0);
    const initialRest = currentBal - totalOneOffs;
    currentBal = initialRest;

    // Proyeksi 6 bulan ke depan
    for (let i = 0; i < 6; i++) {
      const projDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 25);
      const isTargetMonth = i === targetMonthOffset;

      const monthlyIncome = totalInflow;
      const monthlyExpense = totalOutflow;

      // 1. Kas sebelum gajian bulan ini (saldo bawaan dari bulan sebelumnya)
      const balanceBeforeSalary = currentBal;
      
      // 2. Terima gajian di tanggal 25 (Puncak Saldo)
      const balanceAfterSalary = balanceBeforeSalary + monthlyIncome;

      // 3. Eksekusi pembelian jika bulan target
      let balanceAfterPurchase = balanceAfterSalary;
      let purchaseOccurred = false;

      if (isTargetMonth) {
        balanceAfterPurchase = balanceAfterSalary - dreamAmt;
        purchaseOccurred = true;
      }

      // 4. Saldo Akhir Bulan (setelah dikurangi biaya hidup sebulan penuh)
      const finalBalance = balanceAfterPurchase - monthlyExpense;

      // Status deteksi didasarkan pada sisa kas akhir bulan (titik terendah likuiditas sebelum gajian berikutnya)
      let status: 'SAFE' | 'WARNING' | 'CRITICAL' | 'DANGER' = 'SAFE';
      let statusText = 'Aman & Sehat';

      if (finalBalance < 0) {
        status = 'DANGER';
        statusText = '🚨 Minus Sebelum Gajian!';
      } else if (finalBalance < 200000) {
        status = 'CRITICAL';
        statusText = '⚠️ Saldo Kritis Sebelum Gajian';
      } else if (finalBalance < 1000000) {
        status = 'WARNING';
        statusText = 'Keleluasaan Kas Rendah';
      }

      monthsTimeline.push({
        monthName: `${MONTH_LABELS[projDate.getMonth()]} ${projDate.getFullYear()}`,
        startBalance: balanceBeforeSalary,
        netSurplus: netMonthlySurplus,
        balanceBeforeSalary, // Kas sebelum gajian
        balanceAfterSalary,  // Kas setelah gajian
        balanceAfterPurchase: finalBalance, // Saldo Akhir Bulan di-map ke key ini agar UI tidak error
        purchaseOccurred,
        status,
        statusText,
        finalBalance // Disimpan juga secara eksplisit untuk logic recommendation
      });
      
      // Saldo akhir bulan ini menjadi saldo awal bulan depan
      currentBal = finalBalance;
    }

    // Recommendation generator
    let recommendation = 'Rencana Anda sangat aman. Keuangan Anda seimbang sepenuhnya!';
    const criticalMonth = monthsTimeline.find(m => m.status === 'CRITICAL' || m.status === 'DANGER');

    if (criticalMonth) {
      if (criticalMonth.finalBalance < 0) {
        const gap = Math.abs(criticalMonth.finalBalance);
        recommendation = `Rencana belanja terhambat! Anda akan mengalami minus sebesar ${formatRupiah(gap)} sebelum gajian bulan berikutnya. Disarankan memangkas pengeluaran rutin Anda sebesar ${formatRupiah(Math.ceil(gap / (targetMonthOffset + 1)))}/bulan, atau menunda pembelian target impian selama 1 bulan.`;
      } else {
        const gap = 250000 - criticalMonth.finalBalance;
        recommendation = `Saldo kas pemulihan Anda di akhir periode target sangat mepet (${formatRupiah(criticalMonth.finalBalance)}). Kurangi anggaran Gaya Hidup bulanan sebesar ${formatRupiah(Math.ceil(gap))}, atau cari pemasukan sampingan ekstra agar sisa kas pasca pembelian bernilai aman (minimal Rp 250.000).`;
      }
    }

    return { monthsTimeline, initialRest, totalOneOffs, recommendation };
  }, [startBalance, dreamCost, targetMonthOffset, incomes, expenses, oneOffs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl">Simulator Roadmap Keuangan</h1>
          <p className="text-xs text-[#45464d] font-medium">
            Simulasikan pembelian barang impian Anda &amp; ketahui dampaknya terhadap stabilitas tabungan &bull; Profil: <strong>{profile === 'yoga' ? '🧘 Yoga' : '🌿 Silva'}</strong>
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#45464d]">Mode Proyeksi Aktif</span>
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Main Grid Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Inputs and Parameters (Spans 5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Parameter Simulasi HP / Target Impian
            </h3>

            {/* Target Barang */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Nama Impian</Label>
                <Input
                  type="text"
                  value={dreamName}
                  onChange={(e) => setDreamName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Bulan Target Eksekusi</Label>
                <Select value={String(targetMonthOffset)} onValueChange={(v) => setTargetMonthOffset(parseInt(v || '0'))}>
                  <SelectTrigger className="border-[#e2e8f0] text-xs">
                    <SelectValue>
                      {targetMonthOffset === 0 ? 'Bulan ke-1' : targetMonthOffset === 1 ? 'Bulan ke-2' : targetMonthOffset === 2 ? 'Bulan ke-3' : `Bulan ke-${targetMonthOffset + 1}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#e2e8f0]">
                    <SelectItem value="0" className="text-xs">Bulan Depan (1 bln)</SelectItem>
                    <SelectItem value="1" className="text-xs">2 Bulan lagi</SelectItem>
                    <SelectItem value="2" className="text-xs">3 Bulan lagi (Agustus)</SelectItem>
                    <SelectItem value="3" className="text-xs">4 Bulan lagi</SelectItem>
                    <SelectItem value="4" className="text-xs">5 Bulan lagi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rekening, Harga & Saldo Awal */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Pilih Rekening Simulasi</Label>
                <Select 
                  value={selectedAccountId || 'all'} 
                  onValueChange={(val) => {
                    setSelectedAccountId(val);
                    if (val === 'all') {
                      setStartBalance(liveTotalBalance.toLocaleString('id-ID'));
                    } else {
                      const acc = accounts.find(a => a.id === val);
                      if (acc) {
                        setStartBalance(parseFloat(acc.balance).toLocaleString('id-ID'));
                      }
                    }
                  }}
                >
                  <SelectTrigger className="border-[#e2e8f0] text-xs w-full truncate">
                    <SelectValue placeholder="Semua Rekening">
                      {selectedAccountId === 'all' 
                        ? 'Total (Semua Rekening)' 
                        : accounts.find(a => a.id === selectedAccountId)
                          ? `${accounts.find(a => a.id === selectedAccountId)?.name} - ${formatRupiah(parseFloat(accounts.find(a => a.id === selectedAccountId)?.balance || '0'))}`
                          : 'Pilih Rekening...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#e2e8f0]">
                    <SelectItem value="all" className="text-xs font-bold text-blue-600">Total (Semua Rekening)</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name} - {formatRupiah(parseFloat(acc.balance))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Harga Barang (Rp)</Label>
                <Input
                  type="text"
                  value={dreamCost}
                  onChange={(e) => setDreamCost(e.target.value)}
                  className="font-mono text-xs font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Saldo Awal Tabungan (Rp)</Label>
                <Input
                  type="text"
                  value={startBalance}
                  onChange={(e) => setStartBalance(e.target.value)}
                  className="font-mono text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Inflow Section */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-wider">Pemasukan Bulanan Rutin</h3>
            <div className="space-y-2">
              {incomes.map((inc) => (
                <div key={inc.id} className="flex items-center justify-between text-xs p-2 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  <span className="font-semibold text-slate-700">{inc.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#009668]">{formatRupiah(inc.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeIncome(inc.id)} className="h-6 w-6 text-slate-350 hover:text-red-500"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddIncome} className="flex gap-2">
              <Input placeholder="Nama..." value={newIncName} onChange={e => setNewIncName(e.target.value)} className="text-xs flex-1" />
              <Input placeholder="Rp..." value={newIncAmt} onChange={e => setNewIncAmt(e.target.value)} className="text-xs w-28 font-mono" />
              <Button type="submit" className="bg-black hover:bg-black/90 text-white text-xs px-2"><Plus className="h-4 w-4" /></Button>
            </form>
          </div>

          {/* Monthly Outflow Section */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-wider">Pengeluaran Bulanan Rutin</h3>
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between text-xs p-2 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  <span className="font-semibold text-slate-700">{exp.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#ba1a1a]">{formatRupiah(exp.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeExpense(exp.id)} className="h-6 w-6 text-slate-350 hover:text-red-500"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddExpense} className="flex gap-2">
              <Input placeholder="Nama..." value={newExpName} onChange={e => setNewExpName(e.target.value)} className="text-xs flex-1" />
              <Input placeholder="Rp..." value={newExpAmt} onChange={e => setNewExpAmt(e.target.value)} className="text-xs w-28 font-mono" />
              <Button type="submit" className="bg-black hover:bg-black/90 text-white text-xs px-2"><Plus className="h-4 w-4" /></Button>
            </form>
          </div>

          {/* One-off Payments Section */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-wider">Pengeluaran Sekali Bayar (Nombok)</h3>
            <div className="space-y-2">
              {oneOffs.map((one) => (
                <div key={one.id} className="flex items-center justify-between text-xs p-2 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  <span className="font-semibold text-slate-700">{one.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-600">{formatRupiah(one.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeOneOff(one.id)} className="h-6 w-6 text-slate-350 hover:text-red-500"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddOneOff} className="flex gap-2">
              <Input placeholder="Nama..." value={newOneName} onChange={e => setNewOneName(e.target.value)} className="text-xs flex-1" />
              <Input placeholder="Rp..." value={newOneAmt} onChange={e => setNewOneAmt(e.target.value)} className="text-xs w-28 font-mono" />
              <Button type="submit" className="bg-black hover:bg-black/90 text-white text-xs px-2"><Plus className="h-4 w-4" /></Button>
            </form>
          </div>
        </div>

        {/* Right Side: Projections Timeline & Recommendation (Spans 7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Recommendation Box */}
          <div className="bg-blue-600 text-white rounded-xl p-6 relative overflow-hidden shadow-md">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-300 fill-amber-300 animate-bounce" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Engine Analysis &amp; Rekomendasi</h4>
              </div>
              <p className="text-xs md:text-sm font-semibold leading-relaxed">
                {roadmapProjection.recommendation}
              </p>
            </div>
          </div>

          {/* Phase 0: Pre-July */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">💼 FASE AWAL (Kondisi Tabungan)</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <div>
                <p className="text-[10px] text-slate-500">Saldo Awal Terbaca</p>
                <p className="text-base font-bold font-mono text-black">{formatRupiah(parseFormattedNumber(startBalance))}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Total Nombok Awal</p>
                <p className="text-base font-bold font-mono text-slate-500">- {formatRupiah(roadmapProjection.totalOneOffs)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Saldo Murni Awal</p>
                <p className="text-base font-bold font-mono text-[#009668]">{formatRupiah(roadmapProjection.initialRest)}</p>
              </div>
            </div>
          </div>

          {/* Projections Roadmap Timeline */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-black uppercase tracking-wider">Proyeksi Aliran Kas Bulanan &amp; Timeline</h4>
            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
              {roadmapProjection.monthsTimeline.map((item, idx) => {
                const isTarget = item.purchaseOccurred;
                const isCritical = item.status === 'CRITICAL' || item.status === 'DANGER';

                return (
                  <div key={idx} className="relative">
                    {/* Timeline dot */}
                    <span className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center
                      ${isTarget 
                        ? 'bg-blue-600 scale-125 shadow' 
                        : isCritical 
                          ? 'bg-[#ba1a1a]' 
                          : 'bg-[#009668]'}`}>
                    </span>

                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">Bulan Proyeksi</span>
                          <h5 className="text-sm font-bold text-black">{item.monthName}</h5>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold
                          ${item.status === 'SAFE' 
                            ? 'bg-emerald-50 text-[#009668]' 
                            : item.status === 'WARNING' 
                              ? 'bg-slate-50 text-slate-600' 
                              : 'bg-red-50 text-[#ba1a1a] animate-pulse'}`}>
                          {item.statusText}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Saldo Masuk</span>
                          <span className="font-bold text-[#009668] font-mono">+{formatRupiah(item.netSurplus)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Kas sebelum Gajian</span>
                          <span className="font-bold text-slate-800 font-mono">{formatRupiah(item.balanceBeforeSalary)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Kas setelah Gajian</span>
                          <span className="font-bold text-slate-800 font-mono">{formatRupiah(item.balanceAfterSalary)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Saldo Akhir</span>
                          <span className="font-bold text-blue-600 font-mono">{formatRupiah(item.balanceAfterPurchase)}</span>
                        </div>
                      </div>

                      {isTarget && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-blue-800">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                            <span>Eksekusi Belanja Target: <strong>{dreamName}</strong></span>
                          </div>
                          <span className="font-mono font-bold text-blue-700">- {formatRupiah(parseFormattedNumber(dreamCost))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
