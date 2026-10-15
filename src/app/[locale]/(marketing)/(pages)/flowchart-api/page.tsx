import { ApiLanding } from '@/components/developer/api-landing';
import { constructMetadata } from '@/lib/metadata';
export const metadata = constructMetadata({
  title: 'Flowchart API: Generate & Edit Native Diagrams | FlowchartAI',
  description:
    'Build editable flowcharts into your app. Generate from text or images, revise saved diagrams, and export draw.io files with scoped API keys and spending limits.',
  canonicalUrl: 'https://flowchartai.org/flowchart-api',
});
export default function Page() {
  return <ApiLanding />;
}
