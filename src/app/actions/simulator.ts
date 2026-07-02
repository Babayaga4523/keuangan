'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function actionSaveSimulatorConfig(
  state: any,
  selectedAccountId: string | null
) {
  try {
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // Upsert into simulator_configs
    const { error } = await supabase
      .from('simulator_configs')
      .upsert(
        { 
          profile, 
          selected_account_id: selectedAccountId || null,
          state 
        },
        { onConflict: 'profile' }
      );

    if (error) {
      console.error('Failed to save simulator config:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('actionSaveSimulatorConfig error:', err);
    return { success: false, error: err.message };
  }
}
