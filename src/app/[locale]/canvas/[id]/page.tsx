import dynamic from 'next/dynamic';

const FlowVizArchitectWrapper = dynamic(
  () => import('@/components/canvas/flowviz-architect'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen w-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
          <div className="text-lg text-slate-600">Loading InfoGiph...</div>
        </div>
      </div>
    ),
  }
);

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
    <div className="h-screen w-screen overflow-y-auto bg-slate-50">
      <FlowVizArchitectWrapper flowchartId={id} />
    </div>
  );
}

export async function generateMetadata({ params }: EditFlowchartPageProps) {
  return {
    title: 'Edit Flowchart - InfoGiph',
    description: 'Edit your flowchart with AI assistance',
    robots: {
      index: false,
      follow: false,
    },
  };
}

