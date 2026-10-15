import { DeveloperDocs } from '@/components/developer/developer-docs';
import { constructMetadata } from '@/lib/metadata';
export const metadata = constructMetadata({
  title: 'Flowchart API & MCP documentation | FlowchartAI',
  description:
    'REST Quickstart, OpenAPI reference, MCP connection setup, API key permissions and task recovery for FlowchartAI developers.',
  canonicalUrl: 'https://flowchartai.org/developers/docs',
});
export default function Page() {
  return <DeveloperDocs />;
}
