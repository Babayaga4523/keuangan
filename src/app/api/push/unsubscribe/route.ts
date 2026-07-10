import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY is required." }), 
        { status: 500 }
      );
    }

    const { endpoint } = await req.json();
    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Endpoint is required' }), { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Failed to delete push subscription:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    console.error('Push unsubscribe error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
