import { createServerClient } from '@/lib/supabase-server';
import NewSavingGoalForm from '@/components/client/new-saving-goal-form';
import SavingGoalCard from '@/components/client/saving-goal-card';
import OptimizationEngineWidget from '@/components/client/optimization-engine-widget';
import { Target } from 'lucide-react';
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
      .select('*')
      .eq('profile', profile)
      .order('name')
  ]);

  const savingGoals = goalsRes.data || [];
  const accounts = accountsRes.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight">Target Tabungan</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pantau dan kelola pencapaian sinking funds Anda secara tepat.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NewSavingGoalForm />
        </div>
      </div>

      {/* Main Content */}
      {goalsRes.error ? (
        <div className="p-4 text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
          Gagal memuat target tabungan: {goalsRes.error.message}
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
      <OptimizationEngineWidget />
    </div>
  );
}
