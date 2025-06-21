import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useCallback, useRef, useState } from 'react';

interface SaveResult {
  success: boolean;
  error?: string;
  flowchartId?: string;
}

interface UseFlowchartSaveResult {
  saveFlowchart: (title?: string) => Promise<SaveResult>;
  saving: boolean;
  lastSaved: Date | null;
}

export const useFlowchartSave = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  flowchartId?: string
): UseFlowchartSaveResult => {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const saveFlowchart = useCallback(
    async (title?: string): Promise<SaveResult> => {
      if (!excalidrawAPI) {
        return { success: false, error: 'Excalidraw not ready' };
      }

      setSaving(true);

      try {
        // Get current canvas data
        const elements = excalidrawAPI.getSceneElements();
        const rawAppState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();

        // Filter out runtime properties that shouldn't be saved
        const { collaborators, ...appState } = rawAppState;

        // Create the content object
        const content = JSON.stringify({
          type: 'excalidraw',
          version: 2,
          source: 'https://excalidraw.com',
          elements,
          appState,
          files,
        });

        const requestBody: any = { content };
        if (title) {
          requestBody.title = title;
        }

        let response: Response;

        if (flowchartId) {
          // Update existing flowchart
          response = await fetch(`/api/flowcharts/${flowchartId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
        } else {
          // Create new flowchart
          response = await fetch('/api/flowcharts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to save flowchart');
        }

        const result = await response.json();
        setLastSaved(new Date());

        // Return the flowchart ID for potential URL update
        return {
          success: true,
          flowchartId: result.id || flowchartId,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error saving flowchart:', error);
        return { success: false, error: errorMessage };
      } finally {
        setSaving(false);
      }
    },
    [excalidrawAPI, flowchartId]
  );

  // Debounced auto-save function
  const debouncedSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      saveFlowchart();
    }, 3000); // Auto-save after 3 seconds of inactivity
  }, [saveFlowchart]);

  return {
    saveFlowchart,
    saving,
    lastSaved,
  };
};
