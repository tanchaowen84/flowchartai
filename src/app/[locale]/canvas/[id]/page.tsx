import { EditFlowchartClient } from './edit-flowchart-client';

interface EditFlowchartPageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

export default async function EditFlowchartPage({
  params,
}: EditFlowchartPageProps) {
  const { id } = await params;

  return (
    <div className="h-screen w-screen">
      <EditFlowchartClient flowchartId={id} />
    </div>
  );
}

export async function generateMetadata({ params }: EditFlowchartPageProps) {
  const { id } = await params;

  return {
    title: 'Edit Flowchart - FlowChart AI',
    description: 'Edit your flowchart with AI assistance',
    robots: {
      index: false,
      follow: false,
    },
  };
}
