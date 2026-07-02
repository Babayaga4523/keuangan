import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export const runtime = 'edge';
export const maxDuration = 30;

function formatRp(val: string | number) {
  return `Rp ${parseFloat(val.toString()).toLocaleString('id-ID')}`;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    console.time('DB Fetch');
    // Fetch data for context
    const [accountsRes, recurringRes, configRes, transactionsRes] = await Promise.all([
      supabase.from('accounts').select('name, balance, type').eq('profile', profile).eq('is_active', true),
      supabase.from('recurring_transactions').select('name, amount, type').eq('profile', profile).eq('is_active', true),
      supabase.from('simulator_configs').select('state').eq('profile', profile).maybeSingle(),
      supabase.from('transactions').select('description, amount, type, transaction_date').eq('profile', profile).order('transaction_date', { ascending: false }).limit(5)
    ]);
    console.timeEnd('DB Fetch');

    const accounts = accountsRes.data || [];
    const recurring = recurringRes.data || [];
    const simulator = configRes.data?.state || null;
    const recentTransactions = transactionsRes.data || [];

    // COMPUTE DERIVED METRICS BEFORE INJECTING TO PROMPT
    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
    const incomes = recurring.filter(r => r.type === 'INCOME');
    const expenses = recurring.filter(r => r.type === 'EXPENSE');
    const totalIncome = incomes.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const netCashFlow = totalIncome - totalExpense;

    const savingsRate = totalIncome > 0
      ? ((netCashFlow / totalIncome) * 100).toFixed(1)
      : '0';

    // Emergency fund = idealnya 3–6x pengeluaran bulanan
    const emergencyFundTarget = totalExpense * 3;
    const emergencyFundStatus = totalBalance >= emergencyFundTarget && emergencyFundTarget > 0
      ? `✅ CUKUP (${formatRp(totalBalance)} ≥ target ${formatRp(emergencyFundTarget)})`
      : `⚠️ KURANG — butuh tambahan ${formatRp(emergencyFundTarget - totalBalance)}`;

    // Runway: berapa bulan bisa hidup kalau income berhenti
    const runway = totalExpense > 0
      ? (totalBalance / totalExpense).toFixed(1)
      : 'N/A';

    // Simulasi impian
    let dreamAnalysis = '';
    if (simulator?.dreamName && simulator?.dreamCost) {
      const dreamCostNum = parseFloat(simulator.dreamCost);
      const targetOffset = parseInt(simulator.targetMonthOffset) || 0;
      const simulatorNetCashflow = (simulator.incomes?.reduce((s:any, i:any) => s + i.amount, 0) || 0) - (simulator.expenses?.reduce((s:any, e:any) => s + e.amount, 0) || 0);

      const monthsNeeded = simulatorNetCashflow > 0
        ? Math.ceil(dreamCostNum / simulatorNetCashflow)
        : null;
        
      const targetDate = targetOffset > 0
        ? new Date(Date.now() + targetOffset * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        : null;

      dreamAnalysis = `
## ANALISIS TARGET IMPIAN (SIMULATOR ROADMAP):
- Target: ${simulator.dreamName} — ${formatRp(dreamCostNum)}
- Dengan cash flow simulasi bersih ${formatRp(simulatorNetCashflow)}/bulan, butuh ±${monthsNeeded ?? '?'} bulan
- Target pengguna: ${targetOffset} bulan lagi (${targetDate ?? '-'})
- Status: ${monthsNeeded !== null && monthsNeeded <= targetOffset
      ? '✅ Realistis — bisa tercapai sesuai target'
      : `❌ Tidak realistis — butuh ${monthsNeeded ?? '?'} bulan, target hanya ${targetOffset} bulan`
    }
- Shortfall per bulan (jika perlu dipercepat): ${
      monthsNeeded !== null && targetOffset < monthsNeeded && targetOffset > 0
        ? formatRp((dreamCostNum / targetOffset) - simulatorNetCashflow)
        : '-'
    }`;
    }

    // Ringkasan transaksi terbaru
    const recentSummary = recentTransactions.length > 0
      ? `\n## TRANSAKSI TERBARU (5 terakhir):\n` +
        recentTransactions.map(t =>
          `- [${t.type}] ${t.description}: ${formatRp(t.amount)} (${t.transaction_date})`
        ).join('\n')
      : '';

    const now = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // SYSTEM PROMPT
    const systemPrompt = `
# IDENTITAS
Kamu adalah **Opin**, AI Financial Advisor pribadi yang cerdas, suportif, dan jujur.
Profil pengguna aktif: **${profile}**
Tanggal hari ini: ${now}

---

# SNAPSHOT KEUANGAN PENGGUNA

## Rekening
${accounts.length > 0
  ? accounts.map(a => `- ${a.name} (${a.type || 'Bank'}): **${formatRp(a.balance)}**`).join('\n')
  : '- Belum ada rekening terdaftar'}
- **Total Saldo: ${formatRp(totalBalance)}**

## Arus Kas Bulanan Rutin
- Pemasukan: **${formatRp(totalIncome)}**
- Pengeluaran: **${formatRp(totalExpense)}**
- Kas Bersih: **${formatRp(netCashFlow)}** ${netCashFlow >= 0 ? '✅' : '❌ (defisit)'}
- Savings Rate: **${savingsRate}%** ${
    parseFloat(savingsRate) >= 20 ? '✅ Baik' :
    parseFloat(savingsRate) >= 10 ? '⚠️ Perlu ditingkatkan' : '❌ Terlalu rendah'
  }

## Kesehatan Finansial
- Dana Darurat (3× pengeluaran): ${emergencyFundStatus}
- Financial Runway: **${runway} bulan** ${
    runway !== 'N/A' && parseFloat(runway) >= 6 ? '✅' :
    runway !== 'N/A' && parseFloat(runway) >= 3 ? '⚠️' : '❌'
  }
${dreamAnalysis}
${recentSummary}

---

# CARA KAMU BERPIKIR (FRAMEWORK ANALISIS)

Setiap menjawab, ikuti alur ini secara implisit (tidak perlu ditampilkan ke user):

1. **IDENTIFY** — Apa yang user minta? (cek saldo, minta saran, simulasi, tanya edukasi)
2. **CONTEXTUALIZE** — Hubungkan pertanyaan dengan data keuangan di atas
3. **CALCULATE** — Jika ada angka, hitung dulu dengan benar sebelum menjawab
4. **ASSESS** — Nilai kondisi: sehat / perlu perhatian / darurat
5. **ADVISE** — Berikan 1–3 langkah konkret yang bisa langsung dilakukan
6. **CAVEAT** — Jika relevan, tambahkan catatan risiko atau asumsi yang dipakai

---

# ATURAN RESPONS

**Gaya bahasa:**
- Kasual tapi profesional — seperti teman yang juga seorang financial planner
- Gunakan "kamu" bukan "Anda"
- Boleh pakai emoji secukupnya untuk highlight poin penting

**Format output:**
- Gunakan **bold** untuk angka dan poin kunci
- Gunakan bullet list untuk saran/langkah
- Untuk perbandingan, gunakan tabel Markdown
- Panjang respons: singkat untuk pertanyaan simpel, detail untuk analisis — jangan panjang-panjang tanpa isi

**Kalkulasi:**
- Selalu tampilkan cara hitung jika melibatkan angka penting
- Contoh: "Dengan menabung **${formatRp(netCashFlow)}/bulan**, kamu butuh **X bulan** untuk mencapai target"

**Jika data tidak cukup:**
- Tanya balik dengan pertanyaan spesifik, bukan menolak
- Contoh: "Bisa kasih tahu pengeluaran bulanan kamu berapa? Biar bisa hitung lebih akurat."

**Topik yang dijawab:**
- ✅ Perencanaan anggaran, tabungan, investasi, utang, simulasi finansial, darurat dana, gaya hidup finansial
- ❌ Topik non-keuangan: tolak dengan sopan dan redirect ke topik keuangan

**Jika kondisi keuangan buruk (defisit/runway < 1 bulan):**
- Sampaikan dengan jujur tapi tidak menghakimi
- Langsung ke solusi: apa yang bisa dipangkas, apa yang bisa ditambah

---

# CONTOH RESPONS YANG BAIK

User: "Apakah saldo aku cukup buat beli motor 15 juta?"

Opin yang baik:
"Saldo kamu sekarang **${formatRp(totalBalance)}** — jadi secara nominal, cukup buat beli motor 15 juta.

Tapi sebelum dieksekusi, cek ini dulu:

- **Dana darurat** kamu setelah beli: ${formatRp(totalBalance - 15000000)}
  → Idealnya minimal **${formatRp(emergencyFundTarget)}** (3× pengeluaran bulanan)
  → ${totalBalance - 15000000 >= emergencyFundTarget ? '✅ Masih aman' : '⚠️ Di bawah batas aman'}
- **Opsi yang lebih bijak:** cicil kalau ada 0% dan dana darurat kamu masih terjaga

Rekomendasi: ${totalBalance >= 15000000 + emergencyFundTarget ? 'Go ahead, kondisi keuangan kamu mendukung! 🎉' : 'Tunda dulu, atau cari opsi cicilan supaya dana darurat tidak terkuras.'}"
`;

    const lastUserMessage = messages[messages.length - 1];

    if (lastUserMessage && lastUserMessage.role === 'user') {
      await supabase.from('chat_messages').insert({
        profile: profile,
        role: 'user',
        content: lastUserMessage.content
      });
    }

    // Vercel AI SDK useChat automatically sends the FULL conversation history in `messages`.
    // To prevent AI lag and save tokens on very long chats, we only send the last 20 messages for context.
    const recentMessages = messages.slice(-20);

    console.time('AI Stream Connect');

    const groq = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    });
    
    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: recentMessages,
      temperature: 0.7,
      onFinish: async ({ text }) => {
        // Save the AI response to database
        try {
          const finishSupabase = createServerClient();
          await finishSupabase.from('chat_messages').insert({
            profile: profile,
            role: 'assistant',
            content: text
          });
        } catch (err) {
          console.error('Failed to save AI response:', err);
        }
      }
    });
    console.timeEnd('AI Stream Connect');

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Terjadi kesalahan sistem AI', stack: error.stack }), { status: 500 });
  }
}
