import { useEffect, useState } from 'react';

interface FlowchartData {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface UseFlowchartResult {
  flowchart: FlowchartData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useFlowchart = (flowchartId?: string): UseFlowchartResult => {
  const [flowchart, setFlowchart] = useState<FlowchartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlowchart = async () => {
    if (!flowchartId) {
      setFlowchart(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flowcharts/${flowchartId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Flowchart not found');
        }
        if (response.status === 401) {
          throw new Error('Unauthorized access');
        }
        throw new Error('Failed to load flowchart');
      }

      const data = await response.json();
      setFlowchart(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching flowchart:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowchart();
  }, [flowchartId]);

  return {
    flowchart,
    loading,
    error,
    refetch: fetchFlowchart,
  };
};
