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

    const { billId, nextDue } = await req.json();
    if (!billId || !nextDue) {
      return new Response(JSON.stringify({ error: 'billId and nextDue are required' }), { status: 400 });
    }

    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // Fetch recurring transaction details
    const { data: bill, error: fetchErr } = await supabase
      .from('recurring_transactions')
      .select('profile, notify_profiles, next_due')
      .eq('id', billId)
      .maybeSingle();

    if (fetchErr || !bill) {
      return new Response(JSON.stringify({ error: 'Tagihan tidak ditemukan.' }), { status: 404 });
    }

    // Otorisasi Ketat
    const isAuthorized = bill.profile === profile || 
      (Array.isArray(bill.notify_profiles) && bill.notify_profiles.includes(profile));
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Akses ditolak: Anda tidak memiliki wewenang untuk mencatat tagihan ini.' }), { status: 403 });
    }

    // Cek Idempotensi
    if (bill.next_due !== nextDue) {
      // Tagihan sudah terbayar atau next_due sudah maju
      return new Response(JSON.stringify({ success: true, code: 'ALREADY_PAID', message: 'Tagihan periode ini sudah terbayar sebelumnya.' }));
    }

    // Panggil server action actionExecuteRecurring untuk mengeksekusi dan memajukan next_due
    const { actionExecuteRecurring } = await import('@/lib/actions');
    const result = await actionExecuteRecurring(billId);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    console.error('Mark paid error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
