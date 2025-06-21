import { useCallback, useEffect, useState } from 'react';

interface Flowchart {
  id: string;
  title: string;
  content: string;
  thumbnail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UseFlowchartsResult {
  flowcharts: Flowchart[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  deleteFlowchart: (id: string) => Promise<boolean>;
  renameFlowchart: (id: string, newTitle: string) => Promise<boolean>;
}

export const useFlowcharts = (): UseFlowchartsResult => {
  const [flowcharts, setFlowcharts] = useState<Flowchart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlowcharts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/flowcharts');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `HTTP ${response.status}: Failed to fetch flowcharts`
        );
      }

      const data = await response.json();

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      // Extract flowcharts array from response
      const flowchartsArray = Array.isArray(data.flowcharts)
        ? data.flowcharts
        : [];

      // Convert date strings to Date objects
      const flowchartsWithDates = flowchartsArray.map((flowchart: any) => ({
        ...flowchart,
        createdAt: new Date(flowchart.createdAt),
        updatedAt: new Date(flowchart.updatedAt),
      }));

      setFlowcharts(flowchartsWithDates);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching flowcharts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFlowchart = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/flowcharts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete flowchart');
      }

      // Remove from local state
      setFlowcharts((prev) => prev.filter((f) => f.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting flowchart:', err);
      return false;
    }
  }, []);

  const renameFlowchart = useCallback(
    async (id: string, newTitle: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/flowcharts/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!response.ok) {
          throw new Error('Failed to rename flowchart');
        }

        // Update local state
        setFlowcharts((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, title: newTitle, updatedAt: new Date() } : f
          )
        );
        return true;
      } catch (err) {
        console.error('Error renaming flowchart:', err);
        return false;
      }
    },
    []
  );

  // Fetch flowcharts on mount
  useEffect(() => {
    fetchFlowcharts();
  }, [fetchFlowcharts]);

  return {
    flowcharts,
    loading,
    error,
    refetch: fetchFlowcharts,
    deleteFlowchart,
    renameFlowchart,
  };
};
