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
  DollarSign,
  Loader2
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

  const now = useMemo(() => new Date(), []);
  const [dreamName, setDreamName] = useState(savedState.dreamName || 'Barang Impian');
  const [dreamCost, setDreamCost] = useState(savedState.dreamCost || '0');
  
  // Timeline Start & Target Date States
  const [startMonth, setStartMonth] = useState<number>(savedState.startMonth ?? now.getMonth());
  const [startYear, setStartYear] = useState<number>(savedState.startYear ?? now.getFullYear());

  const defaultTarget = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    return { month: d.getMonth(), year: d.getFullYear() };
  }, [now]);

  const [targetMonth, setTargetMonth] = useState<number>(savedState.targetMonth ?? defaultTarget.month);
  const [targetYear, setTargetYear] = useState<number>(savedState.targetYear ?? defaultTarget.year);
  const [projectionLength, setProjectionLength] = useState<number>(12);

  // Selected Account
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(savedConfig?.selected_account_id || 'all');

  // Starting Balance State
  const [startBalance, setStartBalance] = useState(savedState.startBalance || liveTotalBalance.toLocaleString('id-ID'));

  // Incomes & Expenses List
  const [incomes, setIncomes] = useState<SimulatedItem[]>(savedState.incomes || defaultMonthlyIncomes);
  const [expenses, setExpenses] = useState<SimulatedItem[]>(savedState.expenses || defaultMonthlyExpenses);

  // One-off payments (Biaya Nombok Sekali Bayar)
  const [oneOffs, setOneOffs] = useState<SimulatedItem[]>(savedState.oneOffs || []);

  const [aiRecommendation, setAiRecommendation] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Computed offset for backward compatibility
  const targetMonthOffset = useMemo(() => {
    return Math.max(0, (targetYear - startYear) * 12 + (targetMonth - startMonth));
  }, [startYear, startMonth, targetYear, targetMonth]);

  // Auto Save Effect
  useEffect(() => {
    const timeout = setTimeout(() => {
      const currentState = {
        dreamName,
        dreamCost,
        startMonth,
        startYear,
        targetMonth,
        targetYear,
        targetMonthOffset,
        startBalance,
        incomes,
        expenses,
        oneOffs
      };
      actionSaveSimulatorConfig(currentState, selectedAccountId === 'all' ? null : selectedAccountId);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [dreamName, dreamCost, startMonth, startYear, targetMonth, targetYear, targetMonthOffset, startBalance, incomes, expenses, oneOffs, selectedAccountId, profile]);

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

    // Proyeksi berdasarkan panjang durasi pilihan (minimal hingga bulan target)
    const totalProjectionMonths = Math.max(projectionLength, targetMonthOffset + 1);
    for (let i = 0; i < totalProjectionMonths; i++) {
      const projDate = new Date(startYear, startMonth + i, 25);
      const isTargetMonth = (projDate.getFullYear() === targetYear && projDate.getMonth() === targetMonth);

      const monthlyIncome = totalInflow;
      const regularExpense = totalOutflow;
      const targetCost = isTargetMonth ? dreamAmt : 0;
      const totalExpense = regularExpense + targetCost;

      const startBalance = currentBal;
      const finalBalance = startBalance + monthlyIncome - totalExpense;

      // Status deteksi didasarkan pada sisa kas akhir bulan
      let status: 'SAFE' | 'WARNING' | 'CRITICAL' | 'DANGER' = 'SAFE';
      let statusText = 'Aman & Sehat';

      if (finalBalance < 0) {
        status = 'DANGER';
        statusText = '🚨 Defisit / Minus!';
      } else if (finalBalance < 200000) {
        status = 'CRITICAL';
        statusText = '⚠️ Saldo Sangat Kritis';
      } else if (finalBalance < 1000000) {
        status = 'WARNING';
        statusText = 'Keleluasaan Kas Rendah';
      }

      monthsTimeline.push({
        monthName: `${MONTH_LABELS[projDate.getMonth()]} ${projDate.getFullYear()}`,
        monthNum: projDate.getMonth(),
        yearNum: projDate.getFullYear(),
        startBalance,
        monthlyIncome,
        regularExpense,
        targetCost,
        totalExpense,
        finalBalance,
        purchaseOccurred: isTargetMonth,
        status,
        statusText,
        // Compatibility fields:
        netSurplus: monthlyIncome - regularExpense,
        balanceBeforeSalary: startBalance,
        balanceAfterSalary: startBalance + monthlyIncome,
        balanceAfterPurchase: finalBalance,
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

  // Debounced AI recommendation fetching
  useEffect(() => {
    setAiRecommendation('');
    const delayDebounce = setTimeout(async () => {
      if (parseFormattedNumber(dreamCost) <= 0) {
        return;
      }
      setIsAiLoading(true);
      try {
        const res = await fetch('/api/ai-advisor/recommendation?type=simulator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dreamName: dreamName || 'Aset Impian',
            dreamCost: parseFormattedNumber(dreamCost),
            targetMonthOffset,
            startMonth,
            startYear,
            targetMonth,
            targetYear,
            incomes,
            expenses,
            oneOffs,
            startBalance: parseFormattedNumber(startBalance),
            timeline: roadmapProjection.monthsTimeline
          })
        });
        if (res.ok) {
          const rawText = await res.text();
          if (rawText) {
            try {
              const data = JSON.parse(rawText);
              setAiRecommendation(data.recommendation || '');
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch AI recommendation for simulator:', err);
      } finally {
        setIsAiLoading(false);
      }
    }, 1000);

    return () => clearTimeout(delayDebounce);
  }, [roadmapProjection, dreamName, dreamCost]);

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

            {/* Target Impian Name */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Nama Impian</Label>
              <Input
                type="text"
                value={dreamName}
                onChange={(e) => setDreamName(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Config 1: Mulai Proyeksi Timeline */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <span>📌 Mulai Proyeksi Timeline</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Bulan Mulai</span>
                  <Select value={String(startMonth)} onValueChange={(val) => setStartMonth(parseInt(val || '0'))}>
                    <SelectTrigger className="border-[#e2e8f0] text-xs font-medium">
                      <SelectValue>{MONTH_LABELS[startMonth]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#e2e8f0] max-h-60 overflow-y-auto">
                      {MONTH_LABELS.map((mName, mIdx) => (
                        <SelectItem key={mIdx} value={String(mIdx)} className="text-xs">
                          {mName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Tahun Mulai</span>
                  <Select value={String(startYear)} onValueChange={(val) => setStartYear(parseInt(val || String(now.getFullYear())))}>
                    <SelectTrigger className="border-[#e2e8f0] text-xs font-medium font-mono">
                      <SelectValue>{startYear}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#e2e8f0] max-h-60 overflow-y-auto">
                      {Array.from({ length: 20 }).map((_, yIdx) => {
                        const yr = now.getFullYear() - 1 + yIdx;
                        return (
                          <SelectItem key={yr} value={String(yr)} className="text-xs font-mono">
                            {yr}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Config 2: Target Eksekusi Pembelian */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <Label className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                <span>🎯 Target Eksekusi Pembelian</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Bulan Target</span>
                  <Select value={String(targetMonth)} onValueChange={(val) => setTargetMonth(parseInt(val || '0'))}>
                    <SelectTrigger className="border-[#e2e8f0] text-xs font-medium border-blue-200">
                      <SelectValue>{MONTH_LABELS[targetMonth]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#e2e8f0] max-h-60 overflow-y-auto">
                      {MONTH_LABELS.map((mName, mIdx) => (
                        <SelectItem key={mIdx} value={String(mIdx)} className="text-xs">
                          {mName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Tahun Target</span>
                  <Select value={String(targetYear)} onValueChange={(val) => setTargetYear(parseInt(val || String(now.getFullYear())))}>
                    <SelectTrigger className="border-[#e2e8f0] text-xs font-medium border-blue-200 font-mono">
                      <SelectValue>{targetYear}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#e2e8f0] max-h-60 overflow-y-auto">
                      {Array.from({ length: 20 }).map((_, yIdx) => {
                        const yr = now.getFullYear() - 1 + yIdx;
                        return (
                          <SelectItem key={yr} value={String(yr)} className="text-xs font-mono">
                            {yr}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
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
                {isAiLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-300 shrink-0" />
                    <span>Opin sedang menganalisis rencana simulasi Anda...</span>
                  </span>
                ) : (
                  aiRecommendation || roadmapProjection.recommendation
                )}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h4 className="text-xs font-bold text-black uppercase tracking-wider">Proyeksi Aliran Kas Bulanan &amp; Timeline</h4>
                <p className="text-[10px] text-slate-400">Klik tombol pada kartu bulan untuk memindahkan target eksekusi secara instan.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 shrink-0">Panjang Timeline:</span>
                <Select value={String(projectionLength)} onValueChange={(val) => setProjectionLength(parseInt(val || '12'))}>
                  <SelectTrigger className="border-[#e2e8f0] text-xs h-8 bg-white w-32">
                    <SelectValue>{projectionLength} Bulan</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#e2e8f0]">
                    <SelectItem value="6" className="text-xs">6 Bulan</SelectItem>
                    <SelectItem value="12" className="text-xs">12 Bulan (1 Thn)</SelectItem>
                    <SelectItem value="18" className="text-xs">18 Bulan</SelectItem>
                    <SelectItem value="24" className="text-xs">24 Bulan (2 Thn)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6 pt-2">
              {roadmapProjection.monthsTimeline.map((item, idx) => {
                const isTarget = item.purchaseOccurred;
                const isCritical = item.status === 'CRITICAL' || item.status === 'DANGER';

                return (
                  <div key={idx} className="relative">
                    {/* Timeline dot */}
                    <span className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center
                      ${isTarget 
                        ? 'bg-blue-600 scale-125 shadow ring-4 ring-blue-100' 
                        : isCritical 
                          ? 'bg-[#ba1a1a]' 
                          : 'bg-[#009668]'}`}>
                    </span>

                    <div className={`bg-white border rounded-xl p-5 space-y-3 shadow-sm hover:shadow-md transition-all ${isTarget ? 'border-blue-300 ring-2 ring-blue-50' : 'border-[#e2e8f0]'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">Bulan Proyeksi ke-{idx + 1}</span>
                          <h5 className="text-sm font-bold text-black flex items-center gap-2">
                            <span>{item.monthName}</span>
                            {isTarget && (
                              <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                                TARGET EKSEKUSI
                              </span>
                            )}
                          </h5>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold self-start sm:self-auto
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
                          <span className="text-[10px] text-slate-400 block mb-0.5">Saldo Awal Bulan</span>
                          <span className="font-bold text-slate-800 font-mono">{formatRupiah(item.startBalance)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Pemasukan</span>
                          <span className="font-bold text-[#009668] font-mono">+{formatRupiah(item.monthlyIncome)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Total Pengeluaran</span>
                          <span className="font-bold text-[#ba1a1a] font-mono">-{formatRupiah(item.totalExpense)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Saldo Akhir Bulan</span>
                          <span className={`font-bold font-mono ${item.finalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatRupiah(item.finalBalance)}
                          </span>
                        </div>
                      </div>

                      {isTarget ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 text-blue-900 font-medium">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                            <span>Eksekusi Belanja Target: <strong>{dreamName}</strong></span>
                          </div>
                          <span className="font-mono font-bold text-blue-700">- {formatRupiah(parseFormattedNumber(dreamCost))}</span>
                        </div>
                      ) : (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetMonth(item.monthNum);
                              setTargetYear(item.yearNum);
                            }}
                            className="text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg border border-slate-200 hover:border-blue-200 transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span>Pindahkan Eksekusi Ke {item.monthName}</span>
                          </button>
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
