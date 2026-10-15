import { McpLanding } from '@/components/developer/mcp-landing';
import { constructMetadata } from '@/lib/metadata';
export const metadata = constructMetadata({
  title: 'Flowchart MCP Server: Create & Edit Diagrams | FlowchartAI',
  description:
    'Connect your AI assistant to FlowchartAI with remote MCP. Create, revise, save and export editable diagrams using OAuth or a scoped API key.',
  canonicalUrl: 'https://flowchartai.org/mcp',
});
export default function Page() {
  return <McpLanding />;
}
