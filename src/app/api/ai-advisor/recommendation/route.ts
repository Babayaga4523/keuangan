import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'savings';
    
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    if (type === 'simulator') {
      const body = await req.json();
      const { dreamName, dreamCost, targetMonthOffset, startMonth, startYear, targetMonth, targetYear, incomes, expenses, oneOffs, startBalance, timeline } = body;

      // Fetch saved userParameters for full context
      const { data: configRes } = await supabase
        .from('simulator_configs')
        .select('state')
        .eq('profile', profile)
        .maybeSingle();

      const userParams = configRes?.state?.userParameters || null;

      const prompt = `
Anda adalah Opin, AI Financial Advisor yang cerdik, logis, dan analitis tinggi. Berikan 2 kalimat rekomendasi dan analisis terbaik tentang kelayakan rencana simulasi belanja aset berikut:
- Profil Pengguna: ${profile.toUpperCase()}
- Saldo Awal Simulasi: Rp ${startBalance.toLocaleString('id-ID')}
- Barang yang Mau Dibeli: "${dreamName || 'Aset Impian'}" seharga Rp ${dreamCost.toLocaleString('id-ID')}
- Target Eksekusi Pembelian: Bulan ${targetMonth !== undefined ? targetMonth + 1 : ''} ${targetYear || ''}
${userParams ? `- Parameter Pengguna: Gaji Rp ${userParams.monthlySalary?.toLocaleString('id-ID')}, Target Nabung Rp ${userParams.monthlySavingsGoal?.toLocaleString('id-ID')}, Uang Jajan Rp ${userParams.expenses?.pocketMoney?.toLocaleString('id-ID')}, Jatah Orangtua Rp ${userParams.expenses?.parentAllowance?.toLocaleString('id-ID')}` : ''}
- Arus Kas Masuk Bulanan: Rp ${incomes.reduce((s:any, i:any) => s + i.amount, 0).toLocaleString('id-ID')}/bulan
- Arus Kas Keluar Bulanan: Rp ${expenses.reduce((s:any, e:any) => s + e.amount, 0).toLocaleString('id-ID')}/bulan
- Pengeluaran Sekali Bayar Awal (One-off): ${oneOffs.map((o:any) => `${o.name} Rp ${o.amount.toLocaleString('id-ID')}`).join(', ') || 'Tidak ada'}
- Ringkasan Proyeksi Kas Akhir Bulan:
${timeline.map((t:any) => `- ${t.monthName}: Sisa Saldo Akhir Rp ${(t.finalBalance ?? t.balanceAfterPurchase ?? 0).toLocaleString('id-ID')} (${t.statusText})`).join('\n')}

Tugas: Berikan analisis cerdas apakah rencana ini "Aman", "Mepet (Kritis)", atau "Defisit (Minus)". Sebutkan kalkulasi konkret berapa nominal penghematan atau dana darurat yang harus dijaga agar sisa saldo pasca pembelian tetap aman. Langsung berikan kalimat saran taktis tersebut tanpa kata pembuka.
`;

      const { text } = await generateText({
        model: openrouter('google/gemma-4-26b-a4b-it:free'),
        prompt,
        temperature: 0.3
      });

      return Response.json({ recommendation: text.trim() });
    } else {
      // type === 'savings'
      // Fetch data for Optimization Engine
      const [goalsRes, accountsRes, transactionsRes, categoriesRes] = await Promise.all([
        supabase.from('saving_goals').select('*').eq('profile', profile).eq('is_completed', false),
        supabase.from('accounts').select('name, balance').eq('profile', profile).eq('is_active', true),
        supabase.from('transactions').select('amount, type, category_id, description').eq('profile', profile).order('transaction_date', { ascending: false }).limit(150),
        supabase.from('categories').select('id, name')
      ]);

      const goals = goalsRes.data || [];
      const accounts = accountsRes.data || [];
      const transactions = transactionsRes.data || [];
      const categories = categoriesRes.data || [];

      if (goals.length === 0) {
        return Response.json({ recommendation: "Belum ada target tabungan aktif terdeteksi. Silakan buat target rencana tabungan pertama Anda agar Optimization Engine dapat memberikan rekomendasi penghematan khusus." });
      }

      // Group expense by category
      const categoryTotals: { [name: string]: number } = {};
      transactions
        .filter(t => t.type === 'EXPENSE')
        .forEach(t => {
          const catName = categories.find(c => c.id === t.category_id)?.name || 'Lainnya';
          categoryTotals[catName] = (categoryTotals[catName] || 0) + parseFloat(t.amount);
        });

      const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);

      const prompt = `
Anda adalah Opin, AI Financial Advisor yang cerdik. Berikan rekomendasi penghematan taktis (Optimization Engine) untuk mempercepat pencapaian target rencana tabungan (sinking funds) pengguna.
- Saldo Rekening Saat Ini: Rp ${totalBalance.toLocaleString('id-ID')}
- Target Tabungan Aktif Pengguna:
${goals.map(g => `- "${g.name}": Target Rp ${g.target_amount.toLocaleString('id-ID')}, Terkumpul Rp ${g.current_amount.toLocaleString('id-ID')}`).join('\n')}
- Pengeluaran Terbesar Pengguna per Kategori saat ini:
${Object.entries(categoryTotals).map(([cat, amt]) => `- ${cat}: Rp ${amt.toLocaleString('id-ID')}`).join('\n')}

Tugas: Berikan 1-2 kalimat saran optimasi hemat yang sangat spesifik berdasarkan pengeluaran di atas. Hitung secara logis berapa uang yang bisa dihemat dari salah satu kategori pengeluaran terbesar tersebut, dan sebutkan target tabungan mana (sesuai data aktif di atas) yang bisa dicapai berapa bulan lebih cepat dengan merealokasikan uang tersebut. Langsung berikan kalimat saran taktis tersebut tanpa basa-basi pembuka.
`;

      const { text } = await generateText({
        model: openrouter('google/gemma-4-26b-a4b-it:free'),
        prompt,
        temperature: 0.3
      });

      return Response.json({ recommendation: text.trim() });
    }
  } catch (err: any) {
    console.error('Error generating recommendation:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
