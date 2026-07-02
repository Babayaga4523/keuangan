import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    // Fetch the last 50 messages for this profile, oldest to newest
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('profile', profile)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching chat history:', error);
      return NextResponse.json({ messages: [] }); // Fail gracefully
    }

    // Since we ordered descending to get the latest 50, we must reverse it for display
    const messages = (data || []).reverse().map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('API Chat History Error:', error);
    return NextResponse.json({ messages: [] }, { status: 500 });
  }
}
