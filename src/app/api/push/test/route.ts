import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import webpush from 'web-push';

export async function POST() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY is required." }), 
        { status: 500 }
      );
    }

    // Configure VAPID Details
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@amanahfinance.com',
      process.env.VAPID_PUBLIC_KEY || '',
      process.env.VAPID_PRIVATE_KEY || ''
    );

    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // Retrieve active subscriptions for this profile
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('profile', profile);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Belum ada perangkat terdaftar untuk profil ini. Aktifkan pengingat notifikasi terlebih dahulu!" }), 
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title: "🚀 Koneksi Notifikasi Berhasil!",
      body: "Ini adalah notifikasi uji coba instan dari sistem. Jalur koneksi Push Notification Anda berfungsi 100%!",
      url: "/recurring"
    });

    let sentCount = 0;
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
        sentCount++;
      } catch (err: any) {
        // Cleanup expired tokens
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount }), { status: 200 });
  } catch (err: any) {
    console.error('Test push notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
