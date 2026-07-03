import AiChatInterface from '@/components/client/ai-chat-interface';
import { Bot } from 'lucide-react';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'AI Advisor - Silva & Yoga Wealth Management',
};

export default async function AiAdvisorPage() {
  const cookieStore = await cookies();
  const profile = cookieStore.get('current_profile')?.value || 'silva';

  return (
    <div className="fixed top-16 md:top-0 left-0 md:left-64 right-0 bottom-0 bg-white flex flex-col overflow-hidden z-10">
      <AiChatInterface key={profile} />
    </div>
  );
}
