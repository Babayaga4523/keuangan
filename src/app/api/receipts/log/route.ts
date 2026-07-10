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

    const { imageHash, transactionId, merchant, amount, category, date, items } = await req.json();
    if (!imageHash || !transactionId || !merchant || amount === undefined) {
      return new Response(
        JSON.stringify({ error: 'imageHash, transactionId, merchant, and amount are required.' }), 
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // 1. Insert into receipt_logs
    const { data: logData, error: logError } = await supabase
      .from('receipt_logs')
      .insert({
        profile,
        unique_image_hash: imageHash,
        merchant,
        amount: Number(amount),
        category,
        transaction_id: transactionId,
        date
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Failed to insert receipt log:', logError);
      return new Response(JSON.stringify({ error: logError.message }), { status: 550 });
    }

    // 2. Insert items if present
    if (items && items.length > 0 && logData) {
      const itemRows = items.map((item: any) => ({
        receipt_log_id: logData.id,
        name: item.name,
        qty: item.qty || 1,
        price: Number(item.price)
      }));

      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(itemRows);

      if (itemsError) {
        console.warn('Failed to insert receipt items:', itemsError);
        // We log the warning but don't fail the whole request since transaction and main log succeeded
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error('Receipt log error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
