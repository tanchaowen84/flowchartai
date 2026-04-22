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
      // First, check if we have cached data from the callback page
      const cacheKey = `flowchart_cache_${flowchartId}`;
      const cachedData = sessionStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const parsedData: FlowchartData = JSON.parse(cachedData);
          console.log('✅ Using cached flowchart data for immediate display');
          setFlowchart(parsedData);

          // Clear the cache after using it to prevent stale data
          sessionStorage.removeItem(cacheKey);

          // Still fetch fresh data in the background to ensure consistency
          fetch(`/api/flowcharts/${flowchartId}`)
            .then((response) => {
              if (response.ok) {
                return response.json();
              }
              throw new Error('Failed to fetch fresh data');
            })
            .then((data) => {
              setFlowchart(data);
              console.log('✅ Fresh flowchart data loaded');
            })
            .catch((err) => {
              console.warn(
                '⚠️ Failed to load fresh data, keeping cached data:',
                err
              );
            });

          return;
        } catch (parseError) {
          console.warn(
            '⚠️ Failed to parse cached data, fetching from API:',
            parseError
          );
          sessionStorage.removeItem(cacheKey);
        }
      }

      // No cached data or cache invalid, fetch from API
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
