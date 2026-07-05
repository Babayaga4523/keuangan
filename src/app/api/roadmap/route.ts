import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // This roadmap is specifically customized for Yoga's iPhone 15 Pro target
    if (profile !== 'yoga') {
      return NextResponse.json({ showRoadmap: false });
    }

    // Fetch accounts to get current total balance
    const accountsRes = await supabase
      .from('accounts')
      .select('balance')
      .eq('profile', 'yoga')
      .eq('is_active', true);

    const totalBalance = (accountsRes.data || []).reduce((sum, a) => sum + parseFloat(a.balance), 0);

    // Fetch all transactions since July 1, 2026 for Yoga
    const txRes = await supabase
      .from('transactions')
      .select('description, amount, type, transaction_date')
      .eq('profile', 'yoga')
      .gte('transaction_date', '2026-07-01')
      .order('transaction_date', { ascending: true });

    const transactions = txRes.data || [];

    // Define the blueprint milestones based on Yoga's iPhone 15 Pro blueprint
    const milestones = [
      {
        id: 'start_balance',
        title: 'Saldo Awal Patokan',
        targetAmount: 5000000,
        date: '1 Juli 2026',
        description: 'Patokan awal tabungan sebesar Rp 5.000.000 (dikunci secara resmi).',
        isCompleted: totalBalance >= 5000000 || transactions.length > 0,
        value: 5000000
      },
      {
        id: 'salary_1',
        title: 'Gaji Bulanan 1',
        targetAmount: 6000000,
        date: '25 Juli 2026',
        description: 'Gaji bulanan pertama masuk sebesar Rp 6.000.000.',
        isCompleted: transactions.some(t => t.type === 'INCOME' && t.description.toLowerCase().includes('gaji') && t.transaction_date >= '2026-07-20' && t.transaction_date <= '2026-07-31'),
        value: 6000000
      },
      {
        id: 'event_honor',
        title: 'Honor Event Tambahan',
        targetAmount: 1050000,
        date: '10 Agustus 2026',
        description: 'Pendapatan tambahan dari honor event sebesar Rp 1.050.000.',
        isCompleted: transactions.some(t => t.type === 'INCOME' && (t.description.toLowerCase().includes('honor') || t.description.toLowerCase().includes('event'))),
        value: 1050000
      },
      {
        id: 'salary_2',
        title: 'Gaji Bulanan 2',
        targetAmount: 6000000,
        date: '25 Agustus 2026',
        description: 'Gaji bulanan kedua masuk sebesar Rp 6.000.000.',
        isCompleted: transactions.some(t => t.type === 'INCOME' && t.description.toLowerCase().includes('gaji') && t.transaction_date >= '2026-08-20' && t.transaction_date <= '2026-08-31'),
        value: 6000000
      },
      {
        id: 'purchase_iphone',
        title: 'Beli iPhone 15 Pro',
        targetAmount: 12850000,
        date: '25 Agustus 2026',
        description: 'Pembelian iPhone 15 Pro tunai seharga Rp 12.850.000.',
        isCompleted: transactions.some(t => t.type === 'EXPENSE' && t.description.toLowerCase().includes('iphone')),
        value: -12850000
      },
      {
        id: 'salary_3',
        title: 'Gaji Bulanan 3',
        targetAmount: 6000000,
        date: '25 September 2026',
        description: 'Gaji bulanan ketiga (pemulihan saldo) masuk sebesar Rp 6.000.000.',
        isCompleted: transactions.some(t => t.type === 'INCOME' && t.description.toLowerCase().includes('gaji') && t.transaction_date >= '2026-09-20'),
        value: 6000000
      }
    ];

    // Calculate total completed value and current progress percentage
    const completedCount = milestones.filter(m => m.isCompleted).length;
    const progressPercent = Math.round((completedCount / milestones.length) * 100);

    return NextResponse.json({
      showRoadmap: true,
      targetName: 'iPhone 15 Pro',
      targetPrice: 12850000,
      currentBalance: totalBalance,
      progressPercent,
      milestones
    });
  } catch (error: any) {
    console.error('Roadmap API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
