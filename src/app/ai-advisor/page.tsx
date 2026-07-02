import AiChatInterface from '@/components/client/ai-chat-interface';
import { Bot } from 'lucide-react';

export const metadata = {
  title: 'AI Advisor - Silva & Yoga Wealth Management',
};

export default function AiAdvisorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Bot className="h-6 w-6 text-blue-600" />
          Penasihat AI Pribadi
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Konsultasikan kondisi keuangan Anda, tanyakan apakah anggaran sudah sehat, atau minta rekomendasi pintar.
        </p>
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden h-[calc(100vh-12rem)] min-h-[500px]">
        <AiChatInterface />
      </div>
    </div>
  );
}
