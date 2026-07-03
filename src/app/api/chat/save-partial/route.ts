import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { content, sessionId } = await req.json();
    if (!content || content.trim() === '') {
      return new Response('No content', { status: 400 });
    }
    
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    const { error } = await supabase.from('chat_messages').insert({
      profile,
      role: 'assistant',
      content: content,
      session_id: sessionId || 'default'
    });

    if (error) {
      console.error('Database error saving partial message:', error);
      return new Response(error.message, { status: 500 });
    }

    return new Response('Saved', { status: 200 });
  } catch (err: any) {
    console.error('Failed to save partial chat:', err);
    return new Response(err.message, { status: 500 });
  }
}
