import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import ParameterManager from '@/components/client/parameter-manager';

export const revalidate = 0;

export default async function ParameterPage() {
  const supabase = createServerClient();
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  // Fetch saved parameters and active accounts in parallel
  const [configRes, accountsRes] = await Promise.all([
    supabase
      .from('simulator_configs')
      .select('state')
      .eq('profile', profile)
      .maybeSingle(),
    supabase
      .from('accounts')
      .select('id, name, balance')
      .eq('profile', profile)
      .eq('is_active', true)
      .order('name')
  ]);

  const userParameters = configRes.data?.state?.userParameters || null;
  const accounts = (accountsRes.data || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    balance: parseFloat(a.balance || '0')
  }));

  return (
    <ParameterManager 
      initialParameters={userParameters}
      accounts={accounts}
      profile={profile}
    />
  );
}
