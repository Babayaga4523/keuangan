import { streamText, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { z } from 'zod';


export const runtime = 'edge';
export const maxDuration = 30;

function formatRp(val: string | number) {
  return `Rp ${parseFloat(val.toString()).toLocaleString('id-ID')}`;
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json();

    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    console.time('DB Fetch');
    // Fetch data for context
    const [accountsRes, recurringRes, configRes, transactionsRes, categoriesRes] = await Promise.all([
      supabase.from('accounts').select('id, name, balance, type').eq('profile', profile).eq('is_active', true),
      supabase.from('recurring_transactions').select('description, amount, type').eq('profile', profile).eq('is_active', true),
      supabase.from('simulator_configs').select('state').eq('profile', profile).maybeSingle(),
      supabase.from('transactions').select('description, amount, type, transaction_date, category_id').eq('profile', profile).order('transaction_date', { ascending: false }).limit(500),
      supabase.from('categories').select('id, name')
    ]);
    console.timeEnd('DB Fetch');

    const accounts = accountsRes.data || [];
    const recurring = recurringRes.data || [];
    const simulator = configRes.data?.state || null;
    const allTransactions = transactionsRes.data || [];
    const dbCategories = categoriesRes.data || [];

    // Filter transactions to get current month ones for stats in-memory
    const currentMonthTx = allTransactions.filter(t => t.transaction_date >= startOfMonthStr);

    // Calculate current month statistics
    const actualIncomeThisMonth = currentMonthTx
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
    const actualExpenseThisMonth = currentMonthTx
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const categoryTotals: { [name: string]: number } = {};
    currentMonthTx
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const catName = dbCategories.find(c => c.id === t.category_id)?.name || 'Lainnya';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + parseFloat(t.amount);
      });

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
    const recentSummary = allTransactions.length > 0
      ? `\n## TRANSAKSI TERBARU (Maksimal 150):\n` +
        allTransactions.slice(0, 150).map(t => {
          const catName = dbCategories.find(c => c.id === t.category_id)?.name || 'Lainnya';
          return `- [${t.type}] ${t.description} (${catName}): **${formatRp(t.amount)}** (${t.transaction_date})`;
        }).join('\n')
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

## Arus Kas Bulanan Rutin (Anggaran Rutin)
- Pemasukan: **${formatRp(totalIncome)}**
- Pengeluaran: **${formatRp(totalExpense)}**
- Kas Bersih: **${formatRp(netCashFlow)}** ${netCashFlow >= 0 ? '✅' : '❌ (defisit)'}
- Savings Rate: **${savingsRate}%** ${
    parseFloat(savingsRate) >= 20 ? '✅ Baik' :
    parseFloat(savingsRate) >= 10 ? '⚠️ Perlu ditingkatkan' : '❌ Terlalu rendah'
  }

## Realisasi Transaksi Bulan Ini (Aktual Sejak ${startOfMonthStr})
- Total Pemasukan Aktual: **${formatRp(actualIncomeThisMonth)}**
- Total Pengeluaran Aktual: **${formatRp(actualExpenseThisMonth)}**
- Arus Kas Aktual Bersih: **${formatRp(actualIncomeThisMonth - actualExpenseThisMonth)}** ${actualIncomeThisMonth - actualExpenseThisMonth >= 0 ? '✅' : '❌ (defisit)'}

### Breakdown Pengeluaran per Kategori Bulan Ini (Aktual):
${Object.keys(categoryTotals).length > 0 
  ? Object.entries(categoryTotals).map(([cat, amt]) => `- ${cat}: **${formatRp(amt)}**`).join('\n')
  : '- Belum ada pengeluaran aktual tercatat bulan ini'}

## Kesehatan Finansial
- Dana Darurat (3× pengeluaran): ${emergencyFundStatus}
- Financial Runway: **${runway} bulan** ${
    runway !== 'N/A' && parseFloat(runway) >= 6 ? '✅' :
    runway !== 'N/A' && parseFloat(runway) >= 3 ? '⚠️' : '❌'
  }
${dreamAnalysis}
${recentSummary}

## BLUEPRINT RENCANA KEUANGAN UTAMA YOGA (IPHONE 15 PRO - AGUSTUS 2026)
Pengguna (Yoga) telah menetapkan blueprint rencana keuangan resmi yang dikunci sebagai berikut:
- **Saldo Awal Patokan:** Rp 5.000.000 (dikunci secara resmi).
- **Rencana Pemasukan:**
  - Gaji Bulanan (Gaji 1 pada 25 Juli, Gaji 2 pada 25 Agustus, Gaji 3 pada 25 September): masing-masing Rp 6.000.000.
  - Honor Event Tambahan: Rp 1.050.000.
  - Total Amunisi Kotor hingga 25 September: Rp 24.050.000.
- **Rencana Pengeluaran Rutin (Ditekan Menggunakan Motor):**
  - Jatah Nyokap: Rp 500.000/bulan.
  - Bensin & Parkir Motor: Rp 792.000/bulan.
  - Servis Motor Rutin: Rp 150.000/bulan.
  - Utilitas (BPJS & Internet): Rp 250.000/bulan.
  - Gaya Hidup (Kopi, Silva, Opin): Rp 1.200.000/bulan.
  - Total Pengeluaran Bulanan: Rp 2.892.000 (Total 2 bulan = Rp 5.784.000).
- **Hasil Proyeksi & Target Beli HP:**
  - Pembelian iPhone 15 Pro secara tunai dilakukan pada **25 Agustus 2026** seharga **Rp 12.850.000**.
  - Sisa saldo setelah beli HP di tanggal 25 Agustus (setelah dikurangi pengeluaran Agustus): **Rp 2.308.000** (posisi aman, di bawah plafon bulanan tapi langsung ditutup gajian berikutnya).
  - Total Saldo Akhir Periode pada **25 September 2026** (setelah ditambah Gaji 3 & dikurangi pengeluaran September): **Rp 5.416.000**.

Gunakan data blueprint di atas sebagai patokan utama (*anchor blueprint*) ketika pengguna menanyakan tentang kelayakan, kemajuan, anggaran bulanan, atau saran hemat terkait pembelian iPhone 15 Pro Yoga. Jangan menyarankan menunda atau mengubah anggaran jika sudah sesuai dengan rencana motor ini.

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
      let contentToSave = '';
      
      if (Array.isArray(lastUserMessage.content)) {
        const textParts = lastUserMessage.content.filter((part: any) => part.type === 'text');
        const imageParts = lastUserMessage.content.filter((part: any) => part.type === 'image_url' || part.type === 'image');
        
        contentToSave = textParts.map((part: any) => part.text).join('\n');
        
        if (imageParts.length > 0) {
          imageParts.forEach((part: any, index: number) => {
             contentToSave += `\n\n[Gambar Terlampir: Gambar ${index + 1}]`;
          });
        }
      } else {
        contentToSave = lastUserMessage.content;
      }

      if (lastUserMessage.experimental_attachments && Array.isArray(lastUserMessage.experimental_attachments)) {
        lastUserMessage.experimental_attachments.forEach((att: any) => {
          contentToSave += `\n\n[Gambar Terlampir: ${att.name || 'Gambar'}]`;
        });
      }

      await supabase.from('chat_messages').insert({
        profile: profile,
        role: 'user',
        content: contentToSave,
        session_id: sessionId || 'default'
      });
    }

    // Vercel AI SDK useChat automatically sends the FULL conversation history in `messages`.
    // To prevent AI lag and save tokens on very long chats, we only send the last 20 messages for context.
    const recentMessages = messages.slice(-20).map((msg: any) => {
      // Normalize multimodal parts to standard Vercel AI SDK CoreMessage format
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        const newContent = msg.content.map((part: any) => {
          if (part.type === 'image_url' && part.image_url?.url) {
            return {
              type: 'image',
              image: part.image_url.url
            };
          }
          return part;
        });
        return { ...msg, content: newContent };
      }
      return msg;
    });

    console.time('AI Stream Connect');

    const githubOpenAI = createOpenAI({
      baseURL: 'https://models.inference.ai.azure.com',
      apiKey: process.env.GITHUB_PAT || '',
    });

    const systemInstructions = systemPrompt + '\n\n**PENTING**: Pikirkan langkah demi langkah secara logis sebelum memberikan jawaban yang melibatkan angka atau perhitungan. Jika pengguna meminta untuk mencatat transaksi keuangan, gunakan `add_transaction`. Jika pengguna meminta transfer saldo, gunakan `create_transfer`. Jika pengguna meminta target tabungan baru, gunakan `add_saving_goal`. Panggil alat-alat ini secara otonom tanpa perlu meminta konfirmasi ulang.';

    const onFinishCallback = async ({ text }: any) => {
      try {
        if (!text || text.trim() === '') return;
        const finishSupabase = createServerClient();
        await finishSupabase.from('chat_messages').insert({
          profile: profile,
          role: 'assistant',
          content: text,
          session_id: sessionId || 'default'
        });
      } catch (err) {
        console.error('Failed to save AI response:', err);
      }
    };

    const chatTools = {
      add_transaction: tool({
        description: 'Tambahkan transaksi pengeluaran atau pemasukan baru ke database pengguna. Gunakan ini secara otomatis jika pengguna menyebutkan pengeluaran atau pemasukan tanpa harus meminta persetujuan berulang.',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            amount: { 
              type: 'number', 
              description: 'Jumlah uang transaksi (harus angka positif tanpa pemisah ribuan).' 
            },
            type: { 
              type: 'string', 
              enum: ['INCOME', 'EXPENSE'], 
              description: 'Jenis transaksi: INCOME untuk pemasukan, EXPENSE untuk pengeluaran.' 
            },
            description: { 
              type: 'string', 
              description: 'Deskripsi singkat transaksi, misalnya "Beli kopi", "Gaji bulanan".' 
            },
            category: { 
              type: 'string', 
              description: 'Kategori transaksi. Untuk EXPENSE: Makanan, Transportasi, Hiburan, Tagihan, Belanja, Utang, Lainnya. Untuk INCOME: Gaji, Bisnis, Investasi, Lainnya.' 
            },
            accountName: {
              type: 'string',
              description: 'Nama rekening yang disebutkan oleh pengguna (misalnya "Gopay", "BCA", "Cash", dll). Biarkan kosong jika tidak disebutkan.'
            },
            date: { 
              type: 'string', 
              description: 'Tanggal transaksi dalam format YYYY-MM-DD. Jika tidak ada konteks tanggal dari pengguna, biarkan kosong untuk menggunakan hari ini.' 
            }
          },
          required: ['amount', 'type', 'description', 'category']
        }),
        execute: async ({ amount, type, description, category, accountName, date }: any) => {
          try {
            const targetDate = date || new Date().toISOString().split('T')[0];
            const executeSupabase = createServerClient();
            
            // 1. Fetch accounts and categories
            const [accRes, catRes] = await Promise.all([
              executeSupabase.from('accounts').select('id, name, type').eq('profile', profile).eq('is_active', true),
              executeSupabase.from('categories').select('id, name, type')
            ]);

            if (accRes.error || !accRes.data || accRes.data.length === 0) {
              return { success: false, error: 'Tidak ditemukan rekening aktif untuk mencatat transaksi.' };
            }
            
            const dbAccounts = accRes.data;
            const dbCategories = catRes.data || [];

            // 2. Match Account ID
            let accountId = '';
            const searchAccount = (accountName || '').toLowerCase();
            const descLower = (description || '').toLowerCase();
            
            let matchedAccount = null;
            if (searchAccount) {
              matchedAccount = dbAccounts.find(acc => 
                acc.name.toLowerCase().includes(searchAccount) || 
                searchAccount.includes(acc.name.toLowerCase())
              );
            }
            
            if (!matchedAccount) {
              // Fallback to description matching
              matchedAccount = dbAccounts.find(acc => 
                descLower.includes(acc.name.toLowerCase()) || 
                acc.name.toLowerCase().includes(descLower)
              );
            }
            
            if (matchedAccount) {
              accountId = matchedAccount.id;
            } else {
              const defaultAcc = dbAccounts.find(acc => acc.type === 'CASH') || 
                                 dbAccounts.find(acc => acc.type === 'BANK') || 
                                 dbAccounts[0];
              accountId = defaultAcc.id;
            }

            // 3. Match Category ID
            let categoryId: string | null = null;
            const aiCategoryLower = (category || '').toLowerCase();
            const typedCategories = dbCategories.filter(cat => cat.type === type);
            
            const matchedCategory = typedCategories.find(cat => 
              cat.name.toLowerCase().includes(aiCategoryLower) || 
              aiCategoryLower.includes(cat.name.toLowerCase())
            );

            if (matchedCategory) {
              categoryId = matchedCategory.id;
            } else {
              const fallbackCategory = typedCategories.find(cat => cat.name.toLowerCase().includes('lain')) ||
                                       typedCategories[0];
              categoryId = fallbackCategory ? fallbackCategory.id : null;
            }

            // 4. Call fn_create_transaction RPC
            const { data: txId, error: rpcError } = await executeSupabase.rpc('fn_create_transaction', {
              p_account_id: accountId,
              p_category_id: categoryId,
              p_amount: amount,
              p_type: type,
              p_description: description || null,
              p_date: targetDate
            });

            if (rpcError) {
              console.error('RPC Error inserting transaction:', rpcError);
              return { success: false, error: rpcError.message };
            }
            
            const finalAccName = dbAccounts.find(a => a.id === accountId)?.name || 'Rekening';
            
            return { 
              success: true, 
              message: `Berhasil mencatat ${type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} "${description}" sejumlah Rp ${amount.toLocaleString('id-ID')} pada rekening "${finalAccName}". Sampaikan konfirmasi ini kepada pengguna dengan ramah.`,
              data: { txId }
            };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        }
      }),

      add_saving_goal: tool({
        description: 'Tambahkan target tabungan baru (saving goal) ke database.',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            name: { 
              type: 'string', 
              description: 'Nama target tabungan (misal: "Beli iPhone 15", "Dana Darurat").' 
            },
            targetAmount: { 
              type: 'number', 
              description: 'Jumlah uang target yang ingin dicapai (harus angka positif).' 
            },
            currentAmount: { 
              type: 'number', 
              description: 'Saldo awal tabungan saat ini jika ada (angka positif, opsional).' 
            },
            deadline: { 
              type: 'string', 
              description: 'Tanggal tenggat waktu target dalam format YYYY-MM-DD (opsional).' 
            }
          },
          required: ['name', 'targetAmount']
        }),
        execute: async ({ name, targetAmount, currentAmount, deadline }: any) => {
          try {
            const executeSupabase = createServerClient();
            const { data: goal, error } = await executeSupabase
              .from('saving_goals')
              .insert([{
                name,
                target_amount: targetAmount,
                current_amount: currentAmount || 0,
                deadline: deadline || null,
                profile
              }])
              .select('id')
              .single();

            if (error) {
              console.error('Error inserting saving goal:', error);
              return { success: false, error: error.message };
            }

            return { 
              success: true, 
              message: `Berhasil membuat target tabungan baru bernama "${name}" dengan target Rp ${targetAmount.toLocaleString('id-ID')}. Sampaikan konfirmasi ini kepada pengguna dengan ramah.`,
              data: { goalId: goal.id }
            };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        }
      }),

      create_transfer: tool({
        description: 'Lakukan transfer saldo antar rekening (memotong dari satu rekening dan menambahkan ke rekening lain).',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            fromAccount: { 
              type: 'string', 
              description: 'Nama rekening sumber pengirim saldo (misalnya "SeaBank", "Cash").' 
            },
            toAccount: { 
              type: 'string', 
              description: 'Nama rekening tujuan penerima saldo (misalnya "Gopay", "BCA").' 
            },
            amount: { 
              type: 'number', 
              description: 'Jumlah saldo yang ditransfer (harus angka positif).' 
            },
            description: { 
              type: 'string', 
              description: 'Catatan singkat transfer (opsional).' 
            },
            date: { 
              type: 'string', 
              description: 'Tanggal transfer YYYY-MM-DD (opsional).' 
            }
          },
          required: ['fromAccount', 'toAccount', 'amount']
        }),
        execute: async ({ fromAccount, toAccount, amount, description, date }: any) => {
          try {
            const targetDate = date || new Date().toISOString().split('T')[0];
            const executeSupabase = createServerClient();
            
            // Fetch accounts
            const { data: dbAccounts, error: accErr } = await executeSupabase
              .from('accounts')
              .select('id, name')
              .eq('profile', profile)
              .eq('is_active', true);

            if (accErr || !dbAccounts || dbAccounts.length < 2) {
              return { success: false, error: 'Rekening tidak cukup aktif untuk melakukan transfer.' };
            }

            // Match source account
            const fromLower = fromAccount.toLowerCase();
            const matchedFrom = dbAccounts.find(acc => 
              acc.name.toLowerCase().includes(fromLower) || 
              fromLower.includes(acc.name.toLowerCase())
            );

            // Match destination account
            const toLower = toAccount.toLowerCase();
            const matchedTo = dbAccounts.find(acc => 
              acc.name.toLowerCase().includes(toLower) || 
              toLower.includes(acc.name.toLowerCase())
            );

            if (!matchedFrom || !matchedTo) {
              return { 
                success: false, 
                error: `Rekening tidak ditemukan. (Pengirim: ${matchedFrom ? 'Ditemukan' : 'Tidak Ditemukan'}, Penerima: ${matchedTo ? 'Ditemukan' : 'Tidak Ditemukan'})` 
              };
            }

            if (matchedFrom.id === matchedTo.id) {
              return { success: false, error: 'Rekening sumber dan rekening tujuan tidak boleh sama.' };
            }

            // Call fn_create_transfer RPC
            const { data: txId, error: rpcError } = await executeSupabase.rpc('fn_create_transfer', {
              p_from_account_id: matchedFrom.id,
              p_to_account_id:   matchedTo.id,
              p_amount:          amount,
              p_description:     description || null,
              p_date:            targetDate
            });

            if (rpcError) {
              console.error('RPC Error creating transfer:', rpcError);
              return { success: false, error: rpcError.message };
            }

            return { 
              success: true, 
              message: `Berhasil melakukan transfer dari rekening "${matchedFrom.name}" ke "${matchedTo.name}" sebesar Rp ${amount.toLocaleString('id-ID')}. Sampaikan konfirmasi ini kepada pengguna dengan ramah.`,
              data: { txId }
            };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        }
      })
    };

    let result;
    try {
      result = await streamText({
        model: githubOpenAI('gpt-4.1-mini'),
        system: systemInstructions,
        messages: recentMessages,
        temperature: 0.2,
        tools: chatTools,
        onFinish: onFinishCallback
      });
    } catch (err: any) {
      console.warn('Failed to call gpt-4.1-mini, falling back to gpt-4o-mini:', err);
      result = await streamText({
        model: githubOpenAI('gpt-4o-mini'),
        system: systemInstructions,
        messages: recentMessages,
        temperature: 0.2,
        tools: chatTools,
        onFinish: onFinishCallback
      });
    }
    console.timeEnd('AI Stream Connect');

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Terjadi kesalahan sistem AI', stack: error.stack }), { status: 500 });
  }
}
