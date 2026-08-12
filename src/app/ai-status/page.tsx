import AiStatusMonitor from '@/components/client/ai-status-monitor';

export const metadata = {
  title: 'Status & Limit AI - Silva & Yoga Wealth Management',
  description: 'Pantau status API key, latensi, dan rate limit provider AI',
};

export default function AiStatusPage() {
  return (
    <div className="w-full">
      <AiStatusMonitor />
    </div>
  );
}
