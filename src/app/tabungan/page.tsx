import { createServerClient } from '@/lib/supabase-server';
import NewSavingGoalForm from '@/components/client/new-saving-goal-form';
import SavingGoalCard from '@/components/client/saving-goal-card';
import { Target, Sparkles } from 'lucide-react';
import { cookies } from 'next/headers';

export const revalidate = 0; // Live data

export default async function TabunganPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  // Fetch saving goals and accounts in parallel
  const [goalsRes, accountsRes] = await Promise.all([
    supabase
      .from('saving_goals')
      .select('*')
      .eq('profile', profile)
      .order('created_at', { ascending: false }),
    supabase
      .from('accounts')
      .select('id, name, balance')
      .eq('is_active', true)
      .eq('profile', profile)
      .order('name'),
  ]);

  const { data: savingGoals, error } = goalsRes;
  const accounts = accountsRes.data || [];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-[#e2e8f0] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black md:text-2xl">Wealth Goals & Sinking Funds</h1>
          <p className="text-xs text-[#45464d] font-medium">Pelacakan presisi untuk pencapaian keuangan spiritual dan tujuan duniawi Anda.</p>
        </div>
        <div className="flex items-center">
          <NewSavingGoalForm />
        </div>
      </div>

      {/* Sinking Funds Grid */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-650 font-medium">
          Gagal memuat target tabungan: {error.message}
        </div>
      ) : !savingGoals || savingGoals.length === 0 ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-16 text-center shadow-sm flex flex-col items-center justify-center space-y-4 w-full max-w-2xl mx-auto">
          <div className="rounded-full bg-slate-50 p-4 text-black border border-[#e2e8f0]">
            <Target className="h-8 w-8" />
          </div>
          <div className="space-y-2 w-full text-center">
            <h3 className="text-black font-bold text-base">Belum ada target tabungan</h3>
            <p className="text-slate-400 text-xs w-full max-w-md mx-auto leading-relaxed">
              Buat target tabungan rencana (sinking funds) pertama Anda sekarang untuk mulai melacak pencapaian impian Anda.
            </p>
          </div>
          <div>
            <NewSavingGoalForm />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savingGoals.map((goal) => (
            <SavingGoalCard key={goal.id} goal={goal} accounts={accounts} />
          ))}
        </div>
      )}

      {/* Optimization Engine Widget matching Stitch design */}
      <div className="bg-[#131b2e] text-white p-8 rounded-xl relative overflow-hidden mt-8 shadow-md">
        {/* Background glow effects */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300 fill-amber-300" />
            <h3 className="text-base font-bold uppercase tracking-wider">Optimization Engine</h3>
          </div>
          <p className="text-xs md:text-sm max-w-2xl text-slate-300 leading-relaxed font-medium">
            Analisis kami terhadap pengeluaran diskresioner Anda menunjukkan peluang untuk mencapai target <span className="font-bold text-white">&quot;Umroh&quot;</span> atau dana darurat <span className="font-bold text-white">3 bulan lebih cepat</span> dengan merealokasikan sekitar <span className="font-bold text-white">Rp 450.000/bulan</span> dari anggaran hiburan.
          </p>
          <div className="pt-4 flex flex-wrap gap-3">
            <button className="bg-white hover:bg-white/90 text-[#131b2e] px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow">
              Terapkan Optimasi
            </button>
            <button className="border border-white/20 text-white hover:bg-white/10 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all">
              Tinjau Rincian
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
