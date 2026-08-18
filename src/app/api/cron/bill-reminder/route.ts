import { createServerClient } from '@/lib/supabase-server';
import { getJakartaMidnightDate } from '@/lib/jakarta-time';
import webpush from 'web-push';

export async function GET(req: Request) {
  try {
    // 1. Verifikasi SUPABASE_SERVICE_ROLE_KEY
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY is required." }), 
        { status: 500 }
      );
    }

    // 2. Autentikasi Cron Endpoint via Bearer Token (Proteksi Ketat)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.trim() === '') {
      return new Response(
        JSON.stringify({ error: "Configuration Error: CRON_SECRET is required on server." }), 
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 3. Konfigurasi VAPID Details
    const subject = (process.env.VAPID_SUBJECT || '').replace(/['"]/g, "").trim();
    const publicKey = (process.env.VAPID_PUBLIC_KEY || '').replace(/['"]/g, "").trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY || '').replace(/['"]/g, "").trim();

    webpush.setVapidDetails(
      subject || 'mailto:admin@amanahfinance.com',
      publicKey,
      privateKey
    );

    const supabase = createServerClient();

    // 4. Ambil seluruh recurring bills yang aktif
    const { data: bills, error: fetchErr } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('is_active', true);

    if (fetchErr || !bills) {
      return new Response(JSON.stringify({ error: fetchErr?.message || 'Gagal memuat tagihan.' }), { status: 500 });
    }

    const todayJakarta = getJakartaMidnightDate();
    const periodMonth = `${todayJakarta.getFullYear()}-${String(todayJakarta.getMonth() + 1).padStart(2, '0')}`;
    let processedCount = 0;

    for (const bill of bills) {
      // 5. Kalkulasi Jarak Hari (Timezone-Aware)
      const nextDueJakarta = new Date(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(bill.next_due)) + 'T00:00:00+07:00'
      );
      
      const diffDays = Math.round((nextDueJakarta.getTime() - todayJakarta.getTime()) / 86400000);
      const offsets = bill.reminder_offsets || [3, 1, 0];

      if (!offsets.includes(diffDays)) continue;

      // 6. Cek Idempotensi (Cegah Duplikasi Notifikasi)
      const { data: logExists } = await supabase
        .from('bill_reminder_logs')
        .select('id')
        .eq('bill_id', bill.id)
        .eq('offset_days', diffDays)
        .eq('period_month', periodMonth)
        .eq('channel', 'webpush')
        .maybeSingle();

      if (logExists) continue;

      // 7. Ambil daftar profil target yang akan dinotifikasi
      const notifyProfiles = bill.notify_profiles && bill.notify_profiles.length > 0
        ? bill.notify_profiles
        : [bill.profile];

      // 8. Ambil token push subscriptions terdaftar
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('profile', notifyProfiles);

      if (!subscriptions || subscriptions.length === 0) continue;

      // 9. Kirim Notifikasi ke semua perangkat profil target
      let sentToAny = false;
      const label = diffDays === 0 ? "hari ini" : `${diffDays} hari lagi`;
      
      const payload = JSON.stringify({
        title: `🔔 Tagihan Jatuh Tempo: ${bill.description || 'Recurring Bill'}`,
        body: `Jatuh tempo ${label} • Rp ${parseFloat(bill.amount).toLocaleString('id-ID')}`,
        url: '/recurring',
        billId: bill.id,
        nextDue: bill.next_due
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            payload
          );
          sentToAny = true;
        } catch (err: any) {
          // Auto-cleanup token subscription yang sudah mati/expired di browser
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }
        }
      }

      // 10. Jika minimal 1 notifikasi berhasil terkirim, catat log pengiriman
      if (sentToAny) {
        await supabase
          .from('bill_reminder_logs')
          .insert({
            bill_id: bill.id,
            offset_days: diffDays,
            period_month: periodMonth,
            channel: 'webpush'
          });
        processedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, processedCount }));
  } catch (err: any) {
    console.error('Cron reminder error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
