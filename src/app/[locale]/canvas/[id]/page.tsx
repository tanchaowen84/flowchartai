import EditFlowchartClient from './client-page';

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

  return <EditFlowchartClient flowchartId={id} />;
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
