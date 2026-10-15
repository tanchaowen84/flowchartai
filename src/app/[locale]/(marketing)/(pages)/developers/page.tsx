import { DeveloperDashboard } from '@/components/developer/developer-dashboard';
import { constructMetadata } from '@/lib/metadata';
export const metadata = constructMetadata({
  title: 'Developer dashboard | FlowchartAI',
  description: 'Manage API keys, MCP connections, developer budgets and usage.',
  noIndex: true,
});
export default function Page() {
  return <DeveloperDashboard />;
}
