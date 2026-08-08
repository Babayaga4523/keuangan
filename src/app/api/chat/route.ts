import { streamText, generateText, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getJakartaDate, getJakartaFullDateString } from '@/utils/date';



export const runtime = 'nodejs';
export const maxDuration = 30;

function formatRp(val: string | number) {
  return `Rp ${parseFloat(val.toString()).toLocaleString('id-ID')}`;
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json();

    // 1. Validasi Berkas & Deteksi Duplikat di Sisi Server (Early Check)
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user' && lastMsg.experimental_attachments && lastMsg.experimental_attachments.length > 0) {
        const imageAttachments = lastMsg.experimental_attachments.filter((att: any) => 
          att.contentType?.startsWith('image/')
        );

        for (const att of imageAttachments) {
          // Validasi Tipe File
          const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
          if (!allowedTypes.includes(att.contentType)) {
            return new Response(JSON.stringify({ error: `Format file ${att.contentType} tidak didukung.` }), { status: 400 });
          }

          // Validasi Ukuran File (Max 5MB)
          const maxSizeBytes = 5 * 1024 * 1024;
          const base64Length = att.url?.length || 0;
          const approximateSize = (base64Length * 3) / 4;
          if (approximateSize > maxSizeBytes) {
            return new Response(JSON.stringify({ error: "Ukuran file terlalu besar (maksimal 5MB)." }), { status: 400 });
          }

          // Hitung Hash SHA-256 dari base64 gambar
          const base64ImageOnly = att.url.split(';base64,').pop() || '';
          const msgBuffer = new TextEncoder().encode(base64ImageOnly);
          const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          // Cek apakah hash sudah ada di database (receipt_logs)
          let duplicate = null;
          try {
            const supabaseTemp = createServerClient();
            const { data } = await supabaseTemp
              .from('receipt_logs')
              .select('id, transaction_id')
              .eq('image_hash', imageHash)
              .maybeSingle();
            duplicate = data;
          } catch (dbErr) {
            console.warn('receipt_logs table check skipped or failed:', dbErr);
          }

          if (duplicate) {
            // Early exit: stream warning message using custom ReadableStream
            const warningText = '⚠️ **Duplikat Terdeteksi**\n\nStruk belanja ini sepertinya sudah pernah dicatat sebelumnya di sistem. Transaksi tidak akan diproses kembali untuk menghindari pencatatan ganda.';
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(warningText)}\n`));
                controller.close();
              }
            });
            return new Response(stream, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
              }
            });
          }
        }
      }
    }

    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    const { startOfMonthString: startOfMonthStr } = getJakartaDate();

    console.time('DB Fetch');
    // Fetch data for context
    const [accountsRes, recurringRes, configRes, transactionsRes, categoriesRes] = await Promise.all([
      supabase.from('accounts').select('id, name, balance, type').eq('profile', profile).eq('is_active', true),
      supabase.from('recurring_transactions').select('description, amount, type').eq('profile', profile).eq('is_active', true),
      supabase.from('simulator_configs').select('state').eq('profile', profile).maybeSingle(),
      supabase.from('transactions').select('id, description, amount, type, transaction_date, category_id').eq('profile', profile).order('transaction_date', { ascending: false }).limit(500),
      supabase.from('categories').select('id, name')
    ]);
    console.timeEnd('DB Fetch');

    const accounts = accountsRes.data || [];
    const recurring = recurringRes.data || [];
    const simulator = configRes.data?.state || null;
    const allTransactions = transactionsRes.data || [];
    const dbCategories = categoriesRes.data || [];

    // Filter transactions to get current month ones for stats in-memory
    const currentMonthTx = allTransactions.filter((t: any) => t.transaction_date >= startOfMonthStr);

    // Calculate current month statistics
    const actualIncomeThisMonth = currentMonthTx
      .filter((t: any) => t.type === 'INCOME')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      
    const actualExpenseThisMonth = currentMonthTx
      .filter((t: any) => t.type === 'EXPENSE')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const categoryTotals: { [name: string]: number } = {};
    currentMonthTx
      .filter((t: any) => t.type === 'EXPENSE')
      .forEach((t: any) => {
        const catName = dbCategories.find((c: any) => c.id === t.category_id)?.name || 'Lainnya';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + parseFloat(t.amount);
      });

    // COMPUTE DERIVED METRICS BEFORE INJECTING TO PROMPT
    const totalBalance = accounts.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance), 0);
    const incomes = recurring.filter((r: any) => r.type === 'INCOME');
    const expenses = recurring.filter((r: any) => r.type === 'EXPENSE');
    const totalIncome = incomes.reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0);
    const totalExpense = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
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

    // Proactive Alerts (Peringatan Otomatis)
    let proactiveAlert = '';
    if (totalExpense > 0) {
      if (actualExpenseThisMonth > totalExpense) {
        proactiveAlert = `🚨 **PERINGATAN PROAKTIF:** Pengeluaran aktual bulan ini (${formatRp(actualExpenseThisMonth)}) telah MELEBIHI total anggaran rutin (${formatRp(totalExpense)}). Berikan peringatan ramah namun tegas di awal responsmu!`;
      } else if (actualExpenseThisMonth > totalExpense * 0.8) {
        proactiveAlert = `⚠️ **INFO PROAKTIF:** Pengeluaran aktual bulan ini (${formatRp(actualExpenseThisMonth)}) sudah mencapai ${(actualExpenseThisMonth / totalExpense * 100).toFixed(0)}% dari anggaran rutin. Berikan notifikasi singkat agar user berhati-hati.`;
      }
    }

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
        ? new Date(Date.now() + targetOffset * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
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

    // Parameter Keuangan Pengguna
    const userParams = simulator?.userParameters || null;
    const opAcc = accounts.find((a: any) => a.id === userParams?.operatingAccountId);
    const savAcc = accounts.find((a: any) => a.id === userParams?.savingsAccountId);

    const userParamsSummary = userParams ? `
## PARAMETER KEUTAMAAN PENGGUNA (${profile.toUpperCase()}):
- Gaji Bulanan Utama: **${formatRp(userParams.monthlySalary || 0)}**
- Target Nabung Sebulan: **${formatRp(userParams.monthlySavingsGoal || 0)}**
- Rekening Kebutuhan Sebulan / Operasional: **${opAcc ? `${opAcc.name} (${formatRp(opAcc.balance)})` : 'Belum ditentukan'}**
- Rekening Utama Khusus Tabungan: **${savAcc ? `${savAcc.name} (${formatRp(savAcc.balance)})` : 'Belum ditentukan'}**
- Rincian Pengeluaran Rutin Pengguna:
  * 👨‍👩‍👦 Jatah Orang Tua: **${formatRp(userParams.expenses?.parentAllowance || 0)}**
  * 🔧 Service Motor: **${formatRp(userParams.expenses?.motorService || 0)}**
  * ⛽ Bensin Motor: **${formatRp(userParams.expenses?.motorFuel || 0)}**
  * 🏥 BPJS / Kesehatan: **${formatRp(userParams.expenses?.bpjsHealth || 0)}**
  * 🌐 Internet & Tagihan: **${formatRp(userParams.expenses?.internetBill || 0)}**
  * ☕ Uang Jajan / Operasional: **${formatRp(userParams.expenses?.pocketMoney || 0)}**
  * 📦 Pengeluaran Lainnya: **${formatRp(userParams.expenses?.otherExpenses || 0)}**
${Array.isArray(userParams.expenses?.customExpenses) && userParams.expenses.customExpenses.length > 0 ? userParams.expenses.customExpenses.map((c: any) => `  * 🏷️ ${c.name}: **${formatRp(c.amount || 0)}**`).join('\n') : ''}
` : '';

    // Memori Personal
    const memories = simulator?.state?.memories || [];
    const activeMemories = memories.filter((m: any) => m.active);
    const memoryPrompt = activeMemories.length > 0 ? `
## MEMORI & PREFERENSI PENGGUNA
Ingat dan patuhi catatan berikut ini mengenai pengguna secara ketat:
${activeMemories.map((m: any) => `- [${m.category} - ID: ${m.id}] ${m.content}`).join('\n')}

**ATURAN PENTING TERKAIT MEMORI:**
Jika pengguna menyuruh Anda mencatat sebuah transaksi NAMUN transaksi tersebut bertentangan atau melanggar preferensi/batasan/target pengeluaran yang tercatat di Memori, Anda **WAJIB menunda** pencatatan! Berikan peringatan terlebih dahulu via teks, ingatkan mereka tentang memori tersebut, dan tanyakan apakah mereka **tetap yakin** ingin mencatatnya. JANGAN panggil tool \`add_transaction\` sampai mereka secara eksplisit menjawab konfirmasi peringatan Anda (misal: "Ya, tetap catat").
` : '';

    // Ringkasan transaksi terbaru
    const recentSummary = allTransactions.length > 0
      ? `\n## TRANSAKSI TERBARU (Maksimal 30):\n` +
        allTransactions.slice(0, 30).map((t: any) => {
          const catName = dbCategories.find((c: any) => c.id === t.category_id)?.name || 'Lainnya';
          return `- ID: ${t.id} | [${t.type}] ${t.description} (${catName}): **${formatRp(t.amount)}** (${t.transaction_date})`;
        }).join('\n')
      : '';

    const now = getJakartaFullDateString();

    // SYSTEM PROMPT
    const systemPrompt = `
# IDENTITAS
Kamu adalah **Opin**, AI Financial Advisor pribadi yang cerdas, suportif, dan jujur.
Profil pengguna aktif: **${profile}**
Waktu & tanggal saat ini: ${now}

---

# SNAPSHOT KEUANGAN PENGGUNA
${userParamsSummary}
${memoryPrompt}

## Rekening
${accounts.length > 0
  ? accounts.map((a: any) => `- ${a.name} (${a.type || 'Bank'}): **${formatRp(a.balance)}**`).join('\n')
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

${proactiveAlert ? `\n${proactiveAlert}\n` : ''}

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

**Kalkulasi & Matematika:**
- DILARANG KERAS menggunakan format matematika LaTeX (misalnya tanda kurung siku dengan garis miring terbalik, atau perintah fraction/times).
- Gunakan teks matematika standar yang rapi dibaca. Contoh benar: '2.450.000 / 30 = 81.667'
- Selalu tampilkan cara hitung jika melibatkan angka penting
- Contoh: "Dengan menabung **${formatRp(netCashFlow)}/bulan**, kamu butuh **X bulan** untuk mencapai target"

**Jika data tidak cukup:**
- Tanya balik dengan pertanyaan spesifik, bukan menolak
- Contoh: "Bisa kasih tahu pengeluaran bulanan kamu berapa? Biar bisa hitung lebih akurat."

**TENTANG BUDGET VS AKTUAL (SANGAT PENTING):**
- **Gunakan "Arus Kas Bulanan Rutin (Anggaran Rutin)"** saat user bertanya tentang proyeksi, simulasi, rencana menabung, atau rencana masa depan. Ini adalah "Blueprint" keuangan mereka.
- **Gunakan "Realisasi Transaksi Bulan Ini (Aktual)"** HANYA ketika user secara spesifik bertanya tentang pengeluaran riil bulan ini, atau bertanya "kenapa saya boros?".
- Jangan campur adukkan keduanya kecuali diminta. Jika pengeluaran aktual jauh melebihi anggaran, gunakan \`proactiveAlert\` untuk mengingatkan mereka, namun tetap gunakan Anggaran Rutin untuk simulasi jangka panjang kecuali user meminta sebaliknya.

**Topik yang dijawab:**
- ✅ Perencanaan anggaran, tabungan, investasi, utang, simulasi finansial, darurat dana, gaya hidup finansial
- ❌ Topik non-keuangan: tolak dengan sopan dan redirect ke topik keuangan

**Jika kondisi keuangan buruk (defisit/runway < 1 bulan):**
- Sampaikan dengan jujur tapi tidak menghakimi
- Langsung ke solusi: apa yang bisa dipangkas, apa yang bisa ditambah
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
    // To prevent AI lag and save tokens on very long chats, we only send the last 5 messages for context.
    // Groq free tier limit: 12,000 TPM. System prompt + tools alone ~9,000 tokens.
    // Keep only last 3 messages to stay safely under the limit.
    const recentMessages = messages.slice(-3).map((msg: any, idx: number, arr: any[]) => {
      const isLastMessage = idx === arr.length - 1;

      // If there are experimental attachments (specifically images), convert the message to a multimodal content array
      if (msg.role === 'user' && msg.experimental_attachments && msg.experimental_attachments.length > 0) {
        const imageAttachments = msg.experimental_attachments.filter((att: any) => 
          att.contentType?.startsWith('image/')
        );

        // ONLY send images for the CURRENT (last) user message to prevent model confusion and save token costs!
        if (imageAttachments.length > 0 && isLastMessage) {
          const contentParts: any[] = [];
          
          if (msg.content) {
            contentParts.push({ type: 'text', text: msg.content });
          }
          
          imageAttachments.forEach((att: any) => {
            contentParts.push({
              type: 'image',
              image: att.url // Base64 Data URL or string URL
            });
          });

          return {
            role: 'user',
            content: contentParts
          };
        } else {
          // For past history messages, strip the heavy images and just keep the text
          return {
            role: 'user',
            content: msg.content || "Tolong periksa dan analisis struk belanja ini."
          };
        }
      }

      // Normalize standard multimodal parts to standard Vercel AI SDK CoreMessage format
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        if (isLastMessage) {
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
        } else {
          // For past history messages, extract only text parts
          const textContent = msg.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('\n');
          return {
            role: 'user',
            content: textContent || "Tolong periksa dan analisis struk belanja ini."
          };
        }
      }
      return msg;
    });

    console.time('AI Stream Connect');

    const groqApiKey = process.env.GROQ_API_KEY;
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const apiKey = groqApiKey || openrouterApiKey;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY atau OPENROUTER_API_KEY belum dikonfigurasi di lingkungan server.' }), { status: 401 });
    }

    const aiProvider = createOpenAI({
      baseURL: groqApiKey ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
    });

    // ========== TWO-PASS VISION: Pre-scan images with a lightweight call ==========
    // GitHub Models has an 8000-token limit. The full system prompt + base64 image
    // easily exceeds that. So we first "look" at the image with a tiny prompt,
    // then feed the text description to the main chat (which has the full system prompt + tools).
    const lastRecentMsg = recentMessages[recentMessages.length - 1];
    let visionDescription = '';
    if (lastRecentMsg?.role === 'user' && Array.isArray(lastRecentMsg.content)) {
      const imageParts = lastRecentMsg.content.filter((p: any) => p.type === 'image');
      if (imageParts.length > 0) {
        try {
          console.time('Vision Pre-scan');
          
          const ocrPrompt = `Kamu adalah mesin OCR struk belanja Indonesia yang sangat teliti dan akurat. Tugas kamu adalah membaca SEMUA teks pada gambar ini secara PERSIS seperti yang tertulis.

INSTRUKSI PENTING:
1. Baca gambar ini karakter demi karakter dengan SANGAT hati-hati
2. Perhatikan perbedaan: angka 0 vs huruf O, angka 1 vs huruf l/I, angka 8 vs huruf B
3. Baca angka harga dari KANAN ke KIRI untuk menghindari kesalahan digit
4. Jika ada teks yang buram, tulis [tidak terbaca] — JANGAN mengarang angka
5. Perhatikan tanda negatif (-) di depan angka yang artinya DISKON/POTONGAN

DETEKSI DISKON & POTONGAN (sangat penting!):
Cari dan baca SEMUA jenis potongan harga yang mungkin muncul di struk:
- "DISC", "DISKON", "DISCOUNT", "DSC" → diskon umum
- "HEMAT", "SAVING", "SAVE" → potongan harga langsung
- "POT.HRG", "POT HARGA", "POTONGAN" → potongan harga
- "MEMBER DISC", "MEMBER PRICE", "HRG MEMBER" → diskon member/kartu anggota
- "PROMO", "SPECIAL PRICE", "HRG PROMO" → harga promo
- "KUPON", "COUPON", "VOUCHER" → diskon kupon/voucher
- "CASHBACK", "CB" → cashback
- "BUNDLE", "BELI 2 GRATIS 1", "BUY 1 GET 1" → promo bundling
- "PEMBULATAN", "ROUNDING" → pembulatan (biasanya potongan kecil)
- Angka NEGATIF atau dalam tanda kurung (xxx) → potongan per-item
- Baris dengan harga dicoret atau 2 harga berbeda → ada diskon

FORMAT OUTPUT (jika ini struk/nota belanja):
TOKO: [nama toko persis seperti tertulis]
ALAMAT: [alamat jika ada]
TANGGAL: [tanggal dan jam persis dari struk]
KASIR: [nama kasir jika ada]
NO. STRUK: [nomor struk/transaksi jika ada]

DAFTAR ITEM:
1. [nama item persis] - Qty: [jumlah] x Rp [harga satuan] = Rp [subtotal]
   DISKON ITEM: -Rp [jumlah diskon] ([keterangan diskon, misal: "Member Price", "Promo"])
2. [item berikutnya...]

SUBTOTAL: Rp [jumlah total harga semua item sebelum diskon total]
DISKON/POTONGAN: -Rp [total semua diskon] ([keterangan/label diskon])
PAJAK/PPN: Rp [jumlah pajak, jika ada]
TOTAL BAYAR: Rp [angka GRAND TOTAL / TOTAL AKHIR yang benar-benar dibayar]
PEMBAYARAN: [tunai/debit/kredit/e-wallet/QRIS + nama bank/provider]
KEMBALIAN: Rp [angka, jika ada]

CATATAN KHUSUS: [tulis jika ada info penting lain: no. member, poin, dll]

Jika gambar ini BUKAN struk/nota belanja, jelaskan apa yang kamu lihat dengan singkat.
JANGAN gunakan format LaTeX. Gunakan Bahasa Indonesia.
DILARANG KERAS menggunakan tag <think> atau menulis proses berpikir! LANGSUNG berikan hasil akhir saja.`;

          const visionPromptParts: any[] = [
            { type: 'text', text: ocrPrompt },
            ...imageParts
          ];

          // Vision uses Groq qwen/qwen3.6-27b (multimodal, 250k TPM) when GROQ_API_KEY is set,
          // falling back to OpenRouter Gemma if Groq vision fails or key is missing.
          let visionProvider;
          let visionModelId;
          if (groqApiKey) {
            visionProvider = createOpenAI({
              baseURL: 'https://api.groq.com/openai/v1',
              apiKey: groqApiKey,
            });
            visionModelId = 'qwen/qwen3.6-27b';
          } else {
            visionProvider = createOpenAI({
              baseURL: 'https://openrouter.ai/api/v1',
              apiKey: openrouterApiKey || apiKey,
            });
            visionModelId = 'meta-llama/llama-3.2-11b-vision-instruct:free';
          }

          let visionResult;
          try {
            visionResult = await generateText({
              model: visionProvider(visionModelId),
              messages: [
                {
                  role: 'user',
                  content: visionPromptParts
                }
              ],
              temperature: 0.05,
              maxTokens: 6000 // Increased to allow Qwen to finish thinking
            });
          } catch (groqVisionErr: any) {
            if (groqApiKey && openrouterApiKey) {
              console.warn('[Vision Pre-scan] Groq vision failed, trying OpenRouter fallback:', groqVisionErr.message);
              const fallbackProvider = createOpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: openrouterApiKey,
              });
              visionResult = await generateText({
                model: fallbackProvider('meta-llama/llama-3.2-11b-vision-instruct:free'),
                messages: [
                  {
                    role: 'user',
                    content: visionPromptParts
                  }
                ],
                temperature: 0.05,
                maxTokens: 2000
              });
            } else {
              throw groqVisionErr;
            }
          }
          let rawVisionDescription = visionResult.text || '';
          
          // Qwen models output a massive <think>...</think> block.
          // We MUST strip it out. Added (?:<\/think>|$) in case maxTokens cut the response before it finished thinking.
          visionDescription = rawVisionDescription.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
          
          // Fallback if everything was inside think or empty
          if (!visionDescription) {
            visionDescription = "Maaf, pembacaan foto struk terputus atau gagal dibaca (hanya berisi proses berpikir yang terpotong). Tolong bantu sebutkan manual isi struk tersebut.";
          }

          console.timeEnd('Vision Pre-scan');
          console.log('[Vision Pre-scan] Result length:', visionDescription.length, 'chars (Raw was:', rawVisionDescription.length, 'chars)');
          console.log('[Vision Pre-scan] Preview:', visionDescription.substring(0, 300));

          // Now replace the last message: strip images, inject vision description as text
          const textParts = lastRecentMsg.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('\n');

          const enhancedUserText = (textParts || 'Tolong periksa dan analisis struk belanja ini.') +
            '\n\n--- HASIL PEMINDAIAN GAMBAR (Vision OCR) ---\n' + visionDescription +
            '\n--- AKHIR HASIL PEMINDAIAN ---';

          recentMessages[recentMessages.length - 1] = {
            role: 'user',
            content: enhancedUserText
          };
        } catch (visionErr: any) {
          console.error('[Vision Pre-scan] Failed:', visionErr.message);
          // Fallback: strip images and continue with text-only
          const textParts = lastRecentMsg.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('\n');
          recentMessages[recentMessages.length - 1] = {
            role: 'user',
            content: textParts || 'Tolong periksa dan analisis struk belanja ini. (Gambar gagal diproses)'
          };
        }
      }
    }
    // ========== END TWO-PASS VISION ==========

    const systemInstructions = systemPrompt + '\n\n' + 
      '## FITUR PEMINDAI STRUK BELANJA (OCR STRUK)\n' +
      '- Jika pengguna mengunggah gambar/struk belanja:\n' +
      '  1. Evaluasi gambar tersebut. Jika gambar tersebut **bukan struk belanja/nota pengeluaran**, atau **sangat buram/tidak terbaca sama sekali**, kamu **DILARANG** memanggil tool apa pun dan wajib merespons langsung via teks dengan sopan, misalnya: "Saya melihat gambar yang Anda unggah, tetapi saya tidak dapat mendeteksi atau membacanya sebagai struk belanja yang valid. Mohon pastikan foto struk terlihat jelas dan beresolusi baik."\n' +
      '  2. Jika gambar merupakan struk belanja yang valid, kamu wajib memanggil tool `extract_receipt_data` secara otomatis untuk mengekstrak data keuangan terstruktur.\n' +
      '  3. **Penting**: Jangan pernah memanggil tool `add_transaction` secara langsung untuk struk belanja. Proses pencatatan struk harus melalui tool `extract_receipt_data` terlebih dahulu agar pengguna dapat memverifikasi datanya lewat kartu konfirmasi di UI.\n' +
      '  4. Gunakan format mata uang Rupiah Indonesia: nominal berupa angka bulat bulat (integer) tanpa titik/koma desimal.\n' +
      '  5. Setelah memanggil `extract_receipt_data` dan menerima hasilnya, sampaikan penjelasan ramah bahwa draf data struk belanja telah berhasil diekstrak dan minta pengguna untuk memeriksa dan menyimpannya melalui kartu konfirmasi yang muncul di bawah obrolan.\n\n' +
      '## FITUR PENCARIAN WEB (WEB SEARCH / ACCESS INTERNET)\n' +
      '- Kamu memiliki akses ke internet secara real-time via tool `web_search`.\n' +
      '- Jika pengguna menanyakan info publik/terkini (misal: harga barang/gadget terbaru, kurs mata uang USD/IDR, harga emas, inflasi, suku bunga BI, berita ekonomi/pasar, promo, promo bank, atau perbandingan harga produk di Indonesia), kamu WAJIB memanggil `web_search` untuk mencari data terkini sebelum menjawab.\n' +
      '- Gunakan hasil dari `web_search` untuk memberikan jawaban yang akurat, mutakhir, dan relevan.\n\n' +
      '## ATURAN PEMICU AKSI (WAJIB DIPATUHI)\n' +
      'Kamu HANYA boleh memanggil function/tool add_transaction, delete_transaction, create_transfer, atau add_saving_goal jika pesan user mengandung KATA KERJA IMPERATIF eksplisit yang secara langsung memerintahkan aksi, contoh: "catat", "tambahkan", "masukkan", "input", "simpan", "hapus", "batalkan", "hilangkan", "transfer", "pindahkan", "buat target". *Khusus untuk pemindaian struk belanja di atas, kamu berhak memanggil tool `extract_receipt_data` secara otomatis tanpa perlu perintah teks tambahan.*\n\n' +
      'Untuk tool `search_transactions`, kamu **DIPERBOLEHKAN** memanggilnya kapan saja pengguna menanyakan tentang riwayat pengeluaran masa lalu, total pembelian barang tertentu (misal: "berapa kali saya beli jago?"), atau mencari transaksi lama, bahkan tanpa kata kerja imperatif.\n\n' +
      'DILARANG memanggil function apapun jika user:\n' +
      '- Hanya bercerita/curhat tentang pengeluaran/pemasukan tanpa perintah ("tadi aku jajan kopi 20rb", "kemarin service motor abis 150rb")\n' +
      '- Menyebut angka sebagai konteks pertanyaan, bukan instruksi ("kalau aku beli motor 20 juta, aman gak?")\n' +
      '- Menyatakan fakta masa lalu tanpa kata kerja perintah eksplisit ("BCA ku baru masuk gaji 6 juta")\n\n' +
      'JIKA AMBIGU (ada angka + transaksi, tapi tidak ada kata kerja perintah yang jelas, atau perintah bercampur dengan curhat panjang):\n' +
      '- JANGAN langsung eksekusi function pencatatan.\n' +
      '- Tanya konfirmasi dulu: "Mau aku catat sebagai transaksi ya?" atau konfirmasi yang setara.\n' +
      '- Baru panggil function SETELAH user menjawab ya/konfirmasi eksplisit di giliran (turn) berikutnya.\n\n' +
      'Prioritaskan respons teks (empati/saran/analisis) as default. Trigger function adalah PENGECUALIAN, bukan default behavior. Pikirkan langkah demi langkah secara logis sebelum memberikan jawaban yang melibatkan angka atau perhitungan.';

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
      web_search: tool({
        description: 'Mencari informasi terkini dari internet (Web Search) seperti harga gadget/barang terbaru, kurs Rupiah/Valas, harga emas, inflasi, suku bunga bank, berita pasar/keuangan, promo, atau informasi publik lainnya.',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Kata kunci pencarian yang spesifik (contoh: "harga iPhone 15 Pro Indonesia", "kurs USD ke IDR hari ini", "suku bunga BI rate terbaru").' 
            }
          },
          required: ['query']
        }),
        execute: async ({ query }: any) => {
          try {
            console.log(`[Web Search Tool] Searching: "${query}"`);
            const results: Array<{ source: string; title: string; snippet: string; url?: string }> = [];

            const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs = 3500) => {
              const controller = new AbortController();
              const id = setTimeout(() => controller.abort(), timeoutMs);
              try {
                const res = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(id);
                return res;
              } catch (err) {
                clearTimeout(id);
                throw err;
              }
            };

            // Engine 1: Google News RSS Search (Super fast, real-time market prices & news)
            try {
              const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
              const res = await fetchWithTimeout(rssUrl, {}, 3000);
              if (res.ok) {
                const xml = await res.text();
                const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
                for (let i = 0; i < Math.min(itemMatches.length, 5); i++) {
                  const item = itemMatches[i];
                  const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
                  const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
                  const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
                  if (titleMatch) {
                    const cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim();
                    results.push({
                      source: 'Berita & Berkas Publik',
                      title: cleanTitle,
                      snippet: pubDateMatch ? `Update: ${pubDateMatch[1]}` : cleanTitle,
                      url: linkMatch ? linkMatch[1] : undefined
                    });
                  }
                }
              }
            } catch (e: any) {
              console.log('[Web Search Engine 1 Error]:', e.message);
            }

            // Engine 2: Yahoo News Search RSS
            try {
              const yahooUrl = `https://news.search.yahoo.com/rss?p=${encodeURIComponent(query)}`;
              const res = await fetchWithTimeout(yahooUrl, {}, 3000);
              if (res.ok) {
                const xml = await res.text();
                const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
                for (let i = 0; i < Math.min(itemMatches.length, 3); i++) {
                  const item = itemMatches[i];
                  const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
                  const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
                  if (titleMatch) {
                    const cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim();
                    const cleanDesc = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim() : '';
                    results.push({
                      source: 'Yahoo Web Search',
                      title: cleanTitle,
                      snippet: cleanDesc || cleanTitle
                    });
                  }
                }
              }
            } catch (e: any) {
              console.log('[Web Search Engine 2 Error]:', e.message);
            }

            // Engine 3: Wikipedia Indonesia Search API
            try {
              const wikiUrl = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
              const res = await fetchWithTimeout(wikiUrl, {}, 2500);
              if (res.ok) {
                const json = await res.json();
                const wikiItems = json?.query?.search || [];
                for (let i = 0; i < Math.min(wikiItems.length, 3); i++) {
                  const item = wikiItems[i];
                  const cleanSnippet = item.snippet.replace(/<[^>]*>/g, '').trim();
                  results.push({
                    source: 'Wikipedia ID',
                    title: item.title,
                    snippet: cleanSnippet,
                    url: `https://id.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
                  });
                }
              }
            } catch (e: any) {
              console.log('[Web Search Engine 3 Error]:', e.message);
            }

            // Engine 4: Deep Page Body Scraper (Membuat AI membaca isi paragraf web lengkap)
            const resultsWithBody = await Promise.all(
              results.slice(0, 4).map(async (item) => {
                if (!item.url) return item;
                try {
                  const pageRes = await fetchWithTimeout(item.url, {
                    headers: { 
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                  }, 2500);
                  if (pageRes.ok) {
                    const html = await pageRes.text();
                    const cleanBody = html
                      .replace(/<script[\s\S]*?<\/script>/gi, '')
                      .replace(/<style[\s\S]*?<\/style>/gi, '')
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .substring(0, 1200);
                    if (cleanBody && cleanBody.length > 100) {
                      return { ...item, article_full_body: cleanBody };
                    }
                  }
                } catch (e) {
                  // Silent fallback to snippet if page scrape times out
                }
                return item;
              })
            );

            if (resultsWithBody.length > 0) {
              return { success: true, query, results: resultsWithBody };
            }

            return { success: false, query, message: 'Pencarian web tidak menemukan hasil spesifik.' };
          } catch (err: any) {
            console.error('[Web Search Tool Error]:', err);
            return { success: false, query, error: err.message };
          }
        }
      }),

      extract_receipt_data: tool({
        description: 'Mengekstrak data terstruktur dari gambar struk belanja yang diunggah oleh pengguna. Tool ini HANYA mengembalikan data draf hasil OCR tanpa menyimpannya ke database langsung. Pastikan amount adalah TOTAL AKHIR yang dibayar (setelah diskon dan termasuk pajak).',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            merchant: { 
              type: 'string', 
              description: 'Nama merchant/toko (misal: Alfamart, Starbucks, SPBU Pertamina). Gunakan huruf kapital standar.' 
            },
            date: { 
              type: 'string', 
              description: 'Tanggal transaksi dalam format YYYY-MM-DD. Gunakan tanggal struk jika ada. Jika tidak tertera, gunakan tanggal hari ini.' 
            },
            subtotal: {
              type: 'integer',
              description: 'Subtotal sebelum diskon dan pajak (jumlah harga semua item). Angka bulat positif dalam Rupiah. Jika tidak tertera, isi 0.'
            },
            discount: {
              type: 'integer',
              description: 'Total diskon/potongan harga dalam Rupiah (angka bulat positif). Termasuk: diskon member, promo, kupon, cashback, potongan harga, hemat, dll. Isi 0 jika tidak ada diskon.'
            },
            discountLabel: {
              type: 'string',
              description: 'Label/keterangan diskon yang tertera di struk (misal: "Member Discount", "Promo Hemat", "Kupon 10%", "Cashback GoPay"). Kosongkan jika tidak ada diskon.'
            },
            tax: {
              type: 'integer',
              description: 'Pajak/PPN dalam Rupiah (angka bulat positif). Isi 0 jika tidak tertera.'
            },
            amount: { 
              type: 'integer', 
              description: 'TOTAL AKHIR yang dibayar (setelah diskon dikurangi dan pajak ditambahkan). Ini adalah angka GRAND TOTAL / TOTAL BAYAR di struk. Angka bulat positif dalam Rupiah.' 
            },
            category: { 
              type: 'string', 
              enum: ['Makanan & Minuman', 'Transportasi', 'Belanja Bulanan', 'Kesehatan', 'Hiburan', 'Tagihan & Utilitas', 'Lainnya'],
              description: 'Kategori pengeluaran yang paling cocok dari daftar kategori database.' 
            },
            accountName: {
              type: 'string',
              description: 'Nama metode pembayaran/rekening yang tertera di struk (misal: BCA, Mandiri, Cash, Gopay, OVO, DANA, ShopeePay, QRIS, Debit, Kredit, dll).'
            },
            paymentMethod: {
              type: 'string',
              enum: ['TUNAI', 'DEBIT', 'KREDIT', 'E-WALLET', 'QRIS', 'TRANSFER', 'LAINNYA'],
              description: 'Jenis metode pembayaran. TUNAI=uang tunai/cash, DEBIT=kartu debit, KREDIT=kartu kredit, E-WALLET=GoPay/OVO/DANA/ShopeePay, QRIS=pembayaran QRIS, TRANSFER=transfer bank.'
            },
            confidence: { 
              type: 'string', 
              enum: ['high', 'low'], 
              description: 'Tingkat kepercayaan pembacaan OCR. Gunakan "low" jika gambar buram, tidak lengkap, terpotong, atau ada keraguan.' 
            },
            items: {
              type: 'array',
              description: 'Daftar rincian barang/item belanja yang tertera pada struk.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Nama item/barang persis seperti di struk' },
                  price: { type: 'number', description: 'Harga per unit item (harga normal/sebelum diskon per-item)' },
                  qty: { type: 'integer', description: 'Jumlah kuantitas item. Default 1.' },
                  discount: { type: 'number', description: 'Diskon per item ini dalam Rupiah (jika ada potongan khusus item). Isi 0 jika tidak ada.' },
                  finalPrice: { type: 'number', description: 'Harga akhir item setelah diskon per-item (price * qty - discount). Jika tidak ada diskon, sama dengan price * qty.' }
                },
                required: ['name', 'price']
              }
            }
          },
          required: ['merchant', 'date', 'amount', 'category', 'confidence']
        }),
        execute: async (args: any) => {
          try {
            // Dapatkan hash gambar secara dinamis dari request payload (untuk keamanan & integrasi database)
            let imageBase64 = '';
            if (messages && messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              if (lastMsg.role === 'user' && lastMsg.experimental_attachments && lastMsg.experimental_attachments.length > 0) {
                const imgAtt = lastMsg.experimental_attachments.find((att: any) => 
                  att.contentType?.startsWith('image/')
                );
                if (imgAtt) {
                  imageBase64 = imgAtt.url.split(';base64,').pop() || '';
                }
              }
            }

            let imageHash = 'unknown';
            if (imageBase64) {
              const msgBuffer = new TextEncoder().encode(imageBase64);
              const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }

            const executeSupabase = createServerClient();
            
            // Cek duplikat di database (sekali lagi demi keamanan berlapis)
            let duplicate = null;
            try {
              const { data } = await executeSupabase
                .from('receipt_logs')
                .select('id, transaction_id')
                .eq('image_hash', imageHash)
                .maybeSingle();
              duplicate = data;
            } catch (dbErr) {
              console.warn('receipt_logs table check skipped or failed in tool:', dbErr);
            }

            if (duplicate) {
              return {
                isDuplicate: true,
                message: 'Struk ini terdeteksi sebagai duplikat di database.'
              };
            }

            return {
              success: true,
              isDuplicate: false,
              draft: {
                merchant: args.merchant,
                date: args.date,
                subtotal: args.subtotal || 0,
                discount: args.discount || 0,
                discountLabel: args.discountLabel || '',
                tax: args.tax || 0,
                amount: args.amount,
                category: args.category,
                accountName: args.accountName || '',
                paymentMethod: args.paymentMethod || 'LAINNYA',
                confidence: args.confidence,
                items: args.items || [],
                imageHash,
                receiptUrl: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : undefined
              }
            };
          } catch (err: any) {
            console.error('Error executing extract_receipt_data:', err);
            return { success: false, error: err.message };
          }
        }
      }),

      add_transaction: tool({
        description: 'Mencatat transaksi keuangan baru ke database. PANGGIL saat pengguna mengonfirmasi untuk mencatat. WAJIB DIPERHATIKAN: Sebelum memanggil tool ini, Anda HARUS memastikan pengguna telah menyebutkan rekening/sumber dana apa yang digunakan (contoh: Cash, BCA, Mandiri, Gopay). Jika pengguna belum menyebutkan rekening, JANGAN panggil tool ini. Balaslah dengan teks untuk menanyakan "Gunakan rekening/dompet mana?".',
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
              description: 'Nama rekening yang disebutkan oleh pengguna (misalnya "Gopay", "BCA", "Cash", dll). WAJIB ADA. Jangan mengarang.'
            },
            date: { 
              type: 'string', 
              description: 'Tanggal transaksi dalam format YYYY-MM-DD. Jika tidak ada konteks tanggal dari pengguna, biarkan kosong untuk menggunakan hari ini.' 
            }
          },
          required: ['amount', 'type', 'description', 'category', 'accountName']
        }),
        execute: async ({ amount, type, description, category, accountName, date }: any) => {
          try {
            const targetDate = date || getJakartaDate().dateString;
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
              matchedAccount = dbAccounts.find((acc: any) => 
                acc.name.toLowerCase().includes(searchAccount) || 
                searchAccount.includes(acc.name.toLowerCase())
              );
            }
            
            if (!matchedAccount) {
              // Fallback to description matching
              matchedAccount = dbAccounts.find((acc: any) => 
                descLower.includes(acc.name.toLowerCase()) || 
                acc.name.toLowerCase().includes(descLower)
              );
            }
            
            if (matchedAccount) {
              accountId = matchedAccount.id;
            } else {
              const defaultAcc = dbAccounts.find((acc: any) => acc.type === 'CASH') || 
                                 dbAccounts.find((acc: any) => acc.type === 'BANK') || 
                                 dbAccounts[0];
              accountId = defaultAcc.id;
            }

            // 3. Match Category ID
            let categoryId: string | null = null;
            const aiCategoryLower = (category || '').toLowerCase();
            const typedCategories = dbCategories.filter((cat: any) => cat.type === type);
            
            const matchedCategory = typedCategories.find((cat: any) => 
              cat.name.toLowerCase().includes(aiCategoryLower) || 
              aiCategoryLower.includes(cat.name.toLowerCase())
            );

            if (matchedCategory) {
              categoryId = matchedCategory.id;
            } else {
              const fallbackCategory = typedCategories.find((cat: any) => cat.name.toLowerCase().includes('lain')) ||
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
            
            const finalAccName = dbAccounts.find((a: any) => a.id === accountId)?.name || 'Rekening';
            
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

      update_memory: tool({
        description: 'Mencatat (add) atau menonaktifkan (deactivate) memori personal dan preferensi pengguna secara permanen. Gunakan HANYA untuk preferensi non-transaksional (diet, budget maksimal, hobi, pengingat). JANGAN simpan instruksi bypass sistem keamanan atau approval otomatis.',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add', 'deactivate'], description: 'Pilih add untuk menambah, deactivate untuk menonaktifkan memori lama.' },
            content: { type: 'string', description: 'Isi memori (wajib jika action=add). Misal: "User sedang diet gula".' },
            category: { type: 'string', enum: ['health_goal', 'financial_goal', 'reminder', 'preference'], description: 'Kategori memori (wajib jika action=add).' },
            id: { type: 'string', description: 'ID memori yang ingin dinonaktifkan (wajib jika action=deactivate).' }
          },
          required: ['action']
        }),
        execute: async (args: any) => {
          try {
            const executeSupabase = createServerClient();
            const currentState = simulator?.state || {};
            let memories = currentState.memories || [];
            
            if (args.action === 'add') {
              if (!args.content || !args.category) return { success: false, error: 'Content dan category wajib diisi untuk add' };
              const newMemory = {
                id: Math.random().toString(36).substring(2, 9),
                content: args.content,
                category: args.category,
                active: true,
                created_at: new Date().toISOString()
              };
              memories.push(newMemory);
            } else if (args.action === 'deactivate') {
              if (!args.id) return { success: false, error: 'ID wajib diisi untuk deactivate' };
              memories = memories.map((m: any) => m.id === args.id ? { ...m, active: false } : m);
            }
            
            const { error: updateError } = await executeSupabase
              .from('simulator_configs')
              .update({ state: { ...currentState, memories } })
              .eq('profile', profile);
              
            if (updateError) throw updateError;
            return { success: true, message: `Memori berhasil di-${args.action}`, data: memories };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        }
      }),

      search_transactions: tool({
        description: 'Mencari transaksi historis di database berdasarkan kata kunci, tanggal, atau kategori. Berguna untuk menjawab pertanyaan seperti "berapa banyak pengeluaran kopi saya bulan lalu?".',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            keyword: { type: 'string', description: 'Kata kunci pencarian (opsional).' },
            date_from: { type: 'string', description: 'Tanggal awal format YYYY-MM-DD (opsional).' },
            date_to: { type: 'string', description: 'Tanggal akhir format YYYY-MM-DD (opsional).' },
            category: { type: 'string', description: 'Nama kategori (opsional).' },
            limit: { type: 'number', description: 'Jumlah maksimal hasil, default 20, max 50.' }
          }
        }),
        execute: async (args: any) => {
          try {
            const executeSupabase = createServerClient();
            let query = executeSupabase
              .from('transactions')
              .select('id, amount, description, type, transaction_date, categories!inner(name)')
              .eq('profile', profile);
              
            if (args.keyword) {
              query = query.ilike('description', `%${args.keyword}%`);
            }
            if (args.date_from) {
              query = query.gte('transaction_date', args.date_from);
            }
            if (args.date_to) {
              query = query.lte('transaction_date', args.date_to);
            }
            if (args.category) {
              query = query.ilike('categories.name', `%${args.category}%`);
            }
            
            const limit = Math.min(args.limit || 20, 50);
            query = query.order('transaction_date', { ascending: false }).limit(limit);
            
            const { data, error } = await query;
            if (error) throw error;
            
            return { 
              success: true, 
              message: `Ditemukan ${data?.length || 0} transaksi.`, 
              data: data?.map((t: any) => ({
                id: t.id,
                date: t.transaction_date,
                amount: t.amount,
                type: t.type,
                description: t.description,
                category: t.categories?.name
              }))
            };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        }
      }),

      prepare_delete_transaction: tool({
        description: 'Mempersiapkan penghapusan transaksi. JANGAN panggil fungsi ini jika belum memiliki ID transaksi. Gunakan search_transactions dulu. PENTING: Setelah memanggil tool ini, beri tahu pengguna untuk mengklik tombol konfirmasi Hapus di layar. JANGAN PERNAH berkata bahwa transaksi telah dihapus, karena tool ini HANYA menampilkan kartu konfirmasi!',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            transactionId: { type: 'string', description: 'ID transaksi yang akan dihapus.' }
          },
          required: ['transactionId']
        }),
        execute: async ({ transactionId }: any) => {
          const executeSupabase = createServerClient();
          const { data, error } = await executeSupabase
            .from('transactions')
            .select('*, categories(name)')
            .eq('id', transactionId)
            .single();
          if (error) return { success: false, error: error.message };
          return { success: true, draft: data };
        }
      }),

      prepare_update_transaction: tool({
        description: 'Mempersiapkan pengeditan transaksi. JANGAN panggil jika belum ada ID transaksi. PENTING: Setelah memanggil tool ini, beri tahu pengguna untuk menyimpan perubahan pada formulir di layar. JANGAN BOHONG bahwa transaksi telah diubah, karena tool ini HANYA memunculkan formulir edit!',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            transactionId: { type: 'string', description: 'ID transaksi yang akan diedit.' },
            amount: { type: 'number', description: 'Jumlah baru (opsional).' },
            description: { type: 'string', description: 'Deskripsi baru (opsional).' },
            category: { type: 'string', description: 'Kategori baru (opsional).' }
          },
          required: ['transactionId']
        }),
        execute: async (args: any) => {
          const executeSupabase = createServerClient();
          const { data, error } = await executeSupabase
            .from('transactions')
            .select('*, categories(name)')
            .eq('id', args.transactionId)
            .single();
          if (error) return { success: false, error: error.message };
          return { success: true, original: data, updates: { amount: args.amount, description: args.description, category: args.category } };
        }
      }),

      add_saving_goal: tool({
        description: 'Tambahkan target tabungan baru (saving goal) ke database. PANGGIL HANYA jika user memberi perintah eksplisit dengan kata kerja imperatif: \'buat target\', \'tambahkan target\', \'buat tabungan\', \'set target\'. JANGAN panggil jika user hanya bertanya, berdiskusi, atau mensimulasikan rencana belanja tanpa menyuruh membuat target resmi.',
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
        description: 'Memindahkan saldo antar rekening. PANGGIL HANYA jika user eksplisit memerintahkan: \'transfer\', \'pindahkan\', \'sesuaikan saldo dari X ke Y\' dengan sumber, tujuan, dan nominal yang jelas. JANGAN panggil jika user hanya menyebutkan riwayat transfer yang sudah terjadi di rekening lain (misal cerita tentang mutasi bank) tanpa minta dicatat di sistem ini.',
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
            const targetDate = date || getJakartaDate().dateString;
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
            const matchedFrom = dbAccounts.find((acc: any) => 
              acc.name.toLowerCase().includes(fromLower) || 
              fromLower.includes(acc.name.toLowerCase())
            );

            // Match destination account
            const toLower = toAccount.toLowerCase();
            const matchedTo = dbAccounts.find((acc: any) => 
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
      }),

      delete_transaction: tool({
        description: 'Menghapus transaksi dari database berdasarkan ID unik. PANGGIL HANYA jika user eksplisit memerintahkan penghapusan: \'hapus\', \'batalkan\', \'hilangkan transaksi\'. JANGAN panggil hanya karena user menyebut sebuah transaksi salah/typo tanpa menyuruh menghapus — konfirmasi dulu transaksi mana & minta persetujuan eksplisit sebelum eksekusi, karena aksi ini bersifat destruktif dan tidak dapat dibatalkan.',
        parameters: jsonSchema({
          type: 'object',
          properties: {
            transactionId: { 
              type: 'string', 
              description: 'ID UUID transaksi yang ingin dihapus.' 
            },
            description: {
              type: 'string',
              description: 'Deskripsi singkat transaksi yang akan dihapus (untuk konfirmasi ramah).'
            }
          },
          required: ['transactionId']
        }),
        execute: async ({ transactionId, description }: any) => {
          try {
            const executeSupabase = createServerClient();
            
            // Call fn_delete_transaction RPC
            const { error: rpcError } = await executeSupabase.rpc('fn_delete_transaction', {
              p_tx_id: transactionId
            });

            if (rpcError) {
              console.error('RPC Error deleting transaction:', rpcError);
              return { success: false, error: rpcError.message };
            }
            
            return { 
              success: true, 
              message: `Berhasil menghapus transaksi ${description ? `"${description}"` : ''} dengan ID ${transactionId}. Sampaikan konfirmasi ini kepada pengguna dengan ramah.`
            };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        }
      }),
    };

    // MULTI-MODEL TASK ROUTER (Menggabungkan logika n8n ke Webchat)
    const lastMsgContent = (typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '').toLowerCase();
    const hasAttachments = lastUserMessage?.experimental_attachments && lastUserMessage.experimental_attachments.length > 0;
    const isMultimodal = Array.isArray(lastUserMessage?.content) && lastUserMessage.content.some((p: any) => p.type === 'image' || p.type === 'image_url');

    const heavyKeywords = ['analisis', 'simulasi', 'proyeksi', 'investasi', 'strategi', 'evaluasi', 'breakdown', 'rekomendasi', 'perbandingan', 'rencana', 'iphone', 'jangka panjang', 'defisit', 'budget'];
    const isHeavyAnalysis = heavyKeywords.some(kw => lastMsgContent.includes(kw));

    let primaryModel = groqApiKey ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-3.3-70b-instruct:free';
    let fallbackModel = groqApiKey ? 'llama-3.1-8b-instant' : 'google/gemini-2.0-pro-exp-02-05:free';
    let selectedMode = 'GENERAL';

    if (hasAttachments || isMultimodal) {
      selectedMode = 'VISION (OCR Struk)';
    } else if (isHeavyAnalysis) {
      selectedMode = 'HEAVY ANALYSIS (Penalaran Mendalam)';
    } else {
      selectedMode = 'GENERAL (Chat & Catat Cepat)';
    }

    console.log(`[AI Router] Mode: ${selectedMode} | Model Target: ${primaryModel} (${groqApiKey ? 'Groq' : 'OpenRouter'})`);

    // Forward to n8n Webhook if configured (with non-blocking 300ms timeout)
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300);
        const imageUrl = hasAttachments ? lastUserMessage?.experimental_attachments[0]?.url : undefined;
        fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            chat_type: (hasAttachments || isMultimodal) ? 'RECEIPT_OCR' : isHeavyAnalysis ? 'HEAVY_ANALYSIS' : 'GENERAL',
            chatInput: lastMsgContent,
            image_url: imageUrl,
            messages: recentMessages,
            profile,
            timestamp: new Date().toISOString()
          })
        }).then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId));
      } catch (e) {
        // Ignore webhook dispatch errors
      }
    }

    let result;
    try {
      result = await streamText({
        model: aiProvider(primaryModel),
        system: systemInstructions,
        messages: recentMessages,
        temperature: 0.2,
        tools: chatTools,
        maxSteps: 5,
        onFinish: onFinishCallback
      });
    } catch (err: any) {
      const isRateLimitOrOverflow = (err as any)?.statusCode === 413 || 
                                    (err as any)?.statusCode === 429 || 
                                    (err as any)?.message?.toLowerCase().includes('too large') ||
                                    (err as any)?.message?.toLowerCase().includes('rate limit');
                                    
      if (isRateLimitOrOverflow && openrouterApiKey) {
        // Groq free tier TPM/TPD exceeded → fallback to OpenRouter
        console.warn(`[AI Fallback] Groq limit exceeded (429/413), falling back to OpenRouter:`, err.message);
        const openrouterProvider = createOpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: openrouterApiKey,
        });
        result = await streamText({
          model: openrouterProvider('meta-llama/llama-3.3-70b-instruct:free'),
          system: systemInstructions,
          messages: recentMessages,
          temperature: 0.2,
          tools: chatTools,
          maxSteps: 5,
          onFinish: onFinishCallback
        });
      } else {
        console.warn(`Failed to call ${primaryModel}, falling back to ${fallbackModel}:`, err);
        result = await streamText({
          model: aiProvider(fallbackModel),
          system: systemInstructions,
          messages: recentMessages,
          temperature: 0.2,
          tools: chatTools,
          maxSteps: 5,
          onFinish: onFinishCallback
        });
      }
    }
    console.timeEnd('AI Stream Connect');

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Terjadi kesalahan sistem AI', stack: error.stack }), { status: 500 });
  }
}
