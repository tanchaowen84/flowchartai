import ExcalidrawWrapper from '@/components/canvas/excalidraw-wrapper';

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
      <ExcalidrawWrapper flowchartId={id} />
    </div>
  );
}

export async function generateMetadata({ params }: EditFlowchartPageProps) {
  const { id } = await params;

  return {
    title: 'Edit Flowchart - FlowChart AI',
    description: 'Edit your flowchart with AI assistance',
  };
}
