'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { formatRupiah, parseFormattedNumber } from '@/utils/format';
import { 
  SlidersHorizontal, 
  Wallet, 
  PiggyBank, 
  HeartHandshake, 
  Bike, 
  Wrench,
  Fuel,
  ShieldCheck, 
  Wifi, 
  Coffee, 
  MoreHorizontal, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  PieChart
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { actionSaveUserParameters, type UserParametersData } from '@/lib/actions';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  name: string;
  balance: number;
}

interface ParameterManagerProps {
  initialParameters?: UserParametersData | null;
  accounts?: Account[];
  profile: string;
}

export default function ParameterManager({ initialParameters, accounts = [], profile }: ParameterManagerProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states initialized from props or default zeros
  const [salary, setSalary] = useState(initialParameters?.monthlySalary ? initialParameters.monthlySalary.toString() : '6000000');
  const [savingsGoal, setSavingsGoal] = useState(initialParameters?.monthlySavingsGoal ? initialParameters.monthlySavingsGoal.toString() : '1500000');

  // Account designations
  const [operatingAccountId, setOperatingAccountId] = useState(initialParameters?.operatingAccountId || '');
  const [savingsAccountId, setSavingsAccountId] = useState(initialParameters?.savingsAccountId || '');

  // Expense breakdowns
  const [parentAllowance, setParentAllowance] = useState(initialParameters?.expenses?.parentAllowance ? initialParameters.expenses.parentAllowance.toString() : '1000000');
  const [motorService, setMotorService] = useState(initialParameters?.expenses?.motorService ? initialParameters.expenses.motorService.toString() : '150000');
  const [motorFuel, setMotorFuel] = useState(initialParameters?.expenses?.motorFuel ? initialParameters.expenses.motorFuel.toString() : '200000');
  const [bpjsHealth, setBpjsHealth] = useState(initialParameters?.expenses?.bpjsHealth ? initialParameters.expenses.bpjsHealth.toString() : '150000');
  const [internetBill, setInternetBill] = useState(initialParameters?.expenses?.internetBill ? initialParameters.expenses.internetBill.toString() : '250000');
  const [pocketMoney, setPocketMoney] = useState(initialParameters?.expenses?.pocketMoney ? initialParameters.expenses.pocketMoney.toString() : '1500000');
  const [otherExpenses, setOtherExpenses] = useState(initialParameters?.expenses?.otherExpenses ? initialParameters.expenses.otherExpenses.toString() : '300000');

  // Calculations
  const salaryNum = parseFormattedNumber(salary);
  const savingsNum = parseFormattedNumber(savingsGoal);
  const parentNum = parseFormattedNumber(parentAllowance);
  const motorNum = parseFormattedNumber(motorService);
  const fuelNum = parseFormattedNumber(motorFuel);
  const bpjsNum = parseFormattedNumber(bpjsHealth);
  const internetNum = parseFormattedNumber(internetBill);
  const pocketNum = parseFormattedNumber(pocketMoney);
  const otherNum = parseFormattedNumber(otherExpenses);

  const totalExpensesNum = parentNum + motorNum + fuelNum + bpjsNum + internetNum + pocketNum + otherNum;
  const netSurplusNum = salaryNum - (totalExpensesNum + savingsNum);

  const savingsPct = salaryNum > 0 ? ((savingsNum / salaryNum) * 100).toFixed(1) : '0';
  const expensePct = salaryNum > 0 ? ((totalExpensesNum / salaryNum) * 100).toFixed(1) : '0';
  const surplusPct = salaryNum > 0 ? ((netSurplusNum / salaryNum) * 100).toFixed(1) : '0';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload: UserParametersData = {
      monthlySalary: salaryNum,
      monthlySavingsGoal: savingsNum,
      operatingAccountId,
      savingsAccountId,
      expenses: {
        parentAllowance: parentNum,
        motorService: motorNum,
        motorFuel: fuelNum,
        bpjsHealth: bpjsNum,
        internetBill: internetNum,
        pocketMoney: pocketNum,
        otherExpenses: otherNum
      }
    };

    try {
      const res = await actionSaveUserParameters(payload);
      if (res.success) {
        setSuccessMsg('Parameter keuangan berhasil disimpan! AI Advisor telah memperbarui rincian keuangan Anda.');
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Gagal menyimpan parameter');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-black" />
            <h1 className="text-xl font-bold tracking-tight text-black sm:text-2xl">Parameter Keuangan Utama</h1>
          </div>
          <p className="text-xs sm:text-sm text-[#45464d] mt-1">
            Atur pemasukan gaji, penentuan rekening, alokasi tabungan, dan rincian pengeluaran rutin Anda — Profil: <strong>{profile === 'yoga' ? '🧘 Yoga' : '🌿 Silva'}</strong>
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-[#009668] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-medium flex items-center gap-2 shadow-xs">
          <AlertCircle className="h-5 w-5 text-[#ba1a1a] shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Financial Health Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Salary */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#45464d] mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">GAJI BULANAN</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-black">{formatRupiah(salaryNum)}</p>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1">Total Pemasukan Pokok</span>
        </div>

        {/* Savings Target */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#45464d] mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">TARGET NABUNG</span>
            <PiggyBank className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold font-mono text-[#009668]">{formatRupiah(savingsNum)}</p>
          <span className="text-[10px] text-[#009668] font-bold block mt-1">{savingsPct}% dari total gaji</span>
        </div>

        {/* Total Expenses */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#45464d] mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">TOTAL PENGELUARAN</span>
            <PieChart className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold font-mono text-[#ba1a1a]">{formatRupiah(totalExpensesNum)}</p>
          <span className="text-[10px] text-[#ba1a1a] font-bold block mt-1">{expensePct}% dari total gaji</span>
        </div>

        {/* Surplus / Cash flow */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#45464d] mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">SURPLUS BERSIH</span>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </div>
          <p className={`text-xl font-bold font-mono ${netSurplusNum >= 0 ? 'text-black' : 'text-red-600'}`}>
            {formatRupiah(netSurplusNum)}
          </p>
          <span className={`text-[10px] font-bold block mt-1 ${netSurplusNum >= 0 ? 'text-slate-500' : 'text-red-500'}`}>
            {netSurplusNum >= 0 ? `${surplusPct}% sisa dana fleksibel` : 'Defisit! Kurangi pengeluaran'}
          </span>
        </div>
      </div>

      {/* Main Form Formats */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 0: Pilihan Rekening Utama Operasional & Tabungan */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-black uppercase tracking-wider flex items-center gap-2 border-b border-[#e2e8f0] pb-3">
            <Wallet className="h-4 w-4 text-black" />
            1. Pilihan Rekening Utama (Operasional vs Tabungan)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Rekening Kebutuhan Sebulan / Operasional</Label>
              <Select value={operatingAccountId} onValueChange={(val) => setOperatingAccountId(val || '')}>
                <SelectTrigger className="border-[#e2e8f0] rounded-lg h-10 text-sm">
                  <SelectValue placeholder="Pilih rekening operasional...">
                    {accounts.find(a => a.id === operatingAccountId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#e2e8f0]">
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id} className="hover:bg-slate-50 text-sm">
                      {acc.name} ({formatRupiah(acc.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400">Rekening yang dipakai untuk transaksi harian, belanja, & tagihan.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Rekening Utama Khusus Tabungan</Label>
              <Select value={savingsAccountId} onValueChange={(val) => setSavingsAccountId(val || '')}>
                <SelectTrigger className="border-[#e2e8f0] rounded-lg h-10 text-sm">
                  <SelectValue placeholder="Pilih rekening tabungan...">
                    {accounts.find(a => a.id === savingsAccountId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#e2e8f0]">
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id} className="hover:bg-slate-50 text-sm">
                      {acc.name} ({formatRupiah(acc.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400">Rekening (misal: CIMB Niaga) tempat mengunci dana simpanan impian Anda.</p>
            </div>
          </div>
        </div>

        {/* Section 1: Pemasukan & Target Tabungan */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-black uppercase tracking-wider flex items-center gap-2 border-b border-[#e2e8f0] pb-3">
            <PiggyBank className="h-4 w-4 text-black" />
            2. Pemasukan & Komitmen Tabungan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Gaji Bulanan Utama (Rupiah)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold h-10 text-sm"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400">Pemasukan rutin dari gaji bulanan Anda.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Target Nabung Sebulan (Rupiah)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={savingsGoal}
                  onChange={(e) => setSavingsGoal(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono font-semibold h-10 text-sm"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400">Nominal komitmen tabungan yang wajib disisihkan tiap bulan.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Rincian Pengeluaran Rutin */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-black uppercase tracking-wider flex items-center gap-2 border-b border-[#e2e8f0] pb-3">
            <PieChart className="h-4 w-4 text-black" />
            2. Rincian Pengeluaran Rutin Bulanan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Jatah Orang Tua */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <HeartHandshake className="h-4 w-4 text-rose-500" />
                Jatah Orang Tua
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={parentAllowance}
                  onChange={(e) => setParentAllowance(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            {/* Service Motor */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Wrench className="h-4 w-4 text-amber-500" />
                Service Motor
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={motorService}
                  onChange={(e) => setMotorService(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            {/* Bensin Motor */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Fuel className="h-4 w-4 text-orange-500" />
                Bensin Motor
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={motorFuel}
                  onChange={(e) => setMotorFuel(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            {/* BPJS / Kesehatan */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#009668]" />
                BPJS / Kesehatan
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={bpjsHealth}
                  onChange={(e) => setBpjsHealth(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            {/* Tagihan Internet */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Wifi className="h-4 w-4 text-blue-500" />
                Internet & Tagihan
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={internetBill}
                  onChange={(e) => setInternetBill(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            {/* Uang Jajan Bulanan */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Coffee className="h-4 w-4 text-orange-500" />
                Uang Jajan / Operasional
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={pocketMoney}
                  onChange={(e) => setPocketMoney(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            {/* Pengeluaran Lain-Lain */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MoreHorizontal className="h-4 w-4 text-slate-500" />
                Pengeluaran Lainnya
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 font-mono">Rp</span>
                <Input
                  type="text"
                  placeholder="0"
                  value={otherExpenses}
                  onChange={(e) => setOtherExpenses(e.target.value)}
                  className="pl-9 border-[#e2e8f0] rounded-lg font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3 bg-black hover:bg-black/90 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyimpan Parameter...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Simpan Parameter Keuangan</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
