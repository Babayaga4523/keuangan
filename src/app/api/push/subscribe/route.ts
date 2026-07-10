import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY is required." }), 
        { status: 500 }
      );
    }

    const sub = await req.json();
    if (!sub || !sub.endpoint) {
      return new Response(JSON.stringify({ error: 'Subscription data is required' }), { status: 400 });
    }

    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // Validate profile name strictly
    if (profile !== 'yoga' && profile !== 'silva') {
      return new Response(JSON.stringify({ error: 'Invalid active profile.' }), { status: 400 });
    }

    const p256dh = sub.keys?.p256dh || '';
    const auth = sub.keys?.auth || '';

    // Upsert using the composite constraint (endpoint, profile)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        profile,
        endpoint: sub.endpoint,
        p256dh,
        auth
      }, {
        onConflict: 'endpoint,profile'
      });

    if (error) {
      console.error('Failed to upsert push subscription:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    console.error('Push subscribe error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
