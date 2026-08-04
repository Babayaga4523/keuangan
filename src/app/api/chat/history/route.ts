import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    const { searchParams } = new URL(req.url);
    const listSessions = searchParams.get('listSessions') === 'true';
    const sessionId = searchParams.get('sessionId') || 'default';

    if (listSessions) {
      // Fetch all messages for the profile, then group by session in memory
      const { data, error } = await supabase
        .from('chat_messages')
        .select('session_id, role, content, created_at')
        .eq('profile', profile)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching sessions:', error);
        return NextResponse.json({ sessions: [] });
      }

      const sessionsMap: Record<string, { id: string; title: string; lastActivity: string }> = {};
      
      // Default session initialization
      sessionsMap['default'] = {
        id: 'default',
        title: 'Obrolan Utama',
        lastActivity: new Date(0).toISOString()
      };

      (data || []).forEach(msg => {
        const sId = msg.session_id || 'default';
        const titleText = msg.role === 'user' 
          ? msg.content.substring(0, 45) + (msg.content.length > 45 ? '...' : '')
          : 'Percakapan Baru';

        if (!sessionsMap[sId]) {
          sessionsMap[sId] = {
            id: sId,
            title: titleText,
            lastActivity: msg.created_at
          };
        } else {
          sessionsMap[sId].lastActivity = msg.created_at;
          if (sessionsMap[sId].title === 'Percakapan Baru' && msg.role === 'user') {
            sessionsMap[sId].title = titleText;
          }
        }
      });

      // Sort sessions by last activity (newest first)
      const sessions = Object.values(sessionsMap).sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      return NextResponse.json({ sessions });
    }

    // Fetch messages for a specific session
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('profile', profile)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching chat history:', error);
      return NextResponse.json({ messages: [] });
    }

    const messages = (data || []).reverse().map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('API Chat History GET Error:', error);
    return NextResponse.json({ messages: [] }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createServerClient();
    const cookieStore = await cookies();
    const profile = cookieStore.get('current_profile')?.value || 'silva';

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    let query = supabase.from('chat_messages').delete().eq('profile', profile);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting chat history:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Chat History DELETE Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
