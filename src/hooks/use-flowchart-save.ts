import type { FlowchartAiMetadata } from '@/lib/diagram/contracts';
import { generateThumbnail } from '@/lib/excalidraw-thumbnail';
import {
  type FlowchartAutosaveState,
  type FlowchartAutosaveStatus,
  createFlowchartAutosaveCoordinator,
} from '@/lib/flowchart-autosave';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFlowchartSaveResult {
  saveNow: () => void;
  markChanged: () => void;
  retry: () => void;
  status: FlowchartAutosaveStatus;
  saving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export const useFlowchartSave = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  flowchartId?: string,
  defaultTitle?: string,
  flowchartAiMetadata?: FlowchartAiMetadata,
  onFlowchartIdChange?: (newId: string) => void
): UseFlowchartSaveResult => {
  const [saveState, setSaveState] = useState<FlowchartAutosaveState>({
    status: 'idle',
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const apiRef = useRef(excalidrawAPI);
  const activeFlowchartIdRef = useRef(flowchartId);
  const titleRef = useRef(defaultTitle);
  const metadataRef = useRef(flowchartAiMetadata);
  const onFlowchartIdChangeRef = useRef(onFlowchartIdChange);
  const coordinatorRef = useRef<ReturnType<
    typeof createFlowchartAutosaveCoordinator
  > | null>(null);

  apiRef.current = excalidrawAPI;
  if (flowchartId) activeFlowchartIdRef.current = flowchartId;
  titleRef.current = defaultTitle;
  metadataRef.current = flowchartAiMetadata;
  onFlowchartIdChangeRef.current = onFlowchartIdChange;

  const performSave = useCallback(async (): Promise<void> => {
    const api = apiRef.current;
    if (!api) throw new Error('Canvas is not ready');

    const elements = api.getSceneElements();
    const rawAppState = api.getAppState();
    const files = api.getFiles();
    const { collaborators: _collaborators, ...appState } = rawAppState;
    const content = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'https://excalidraw.com',
      elements,
      appState,
      files,
      flowchartAi: metadataRef.current,
    });

    let thumbnail: string | null = null;
    if (elements.length > 0) {
      try {
        thumbnail = await generateThumbnail(
          { elements, appState },
          300,
          200,
          0.9
        );
      } catch (error) {
        console.warn('Failed to generate flowchart thumbnail:', error);
      }
    }

    const requestBody: {
      content: string;
      title: string;
      thumbnail?: string;
    } = {
      content,
      title: titleRef.current || 'Untitled',
    };
    if (thumbnail) requestBody.thumbnail = thumbnail;

    const activeId = activeFlowchartIdRef.current;
    const response = await fetch(
      activeId ? `/api/flowcharts/${activeId}` : '/api/flowcharts',
      {
        method: activeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        typeof errorData.error === 'string'
          ? errorData.error
          : 'Failed to save flowchart'
      );
    }

    const result = (await response.json()) as { id?: string };
    if (!activeId) {
      if (!result.id) throw new Error('Saved flowchart did not return an ID');
      activeFlowchartIdRef.current = result.id;
      window.history.replaceState(null, '', `/canvas/${result.id}`);
      onFlowchartIdChangeRef.current?.(result.id);
    }

    setLastSaved(new Date());
  }, []);

  useEffect(() => {
    const coordinator = createFlowchartAutosaveCoordinator({
      delayMs: 3000,
      save: performSave,
      onStateChange: setSaveState,
    });
    coordinatorRef.current = coordinator;

    return () => {
      coordinator.dispose();
      coordinatorRef.current = null;
    };
  }, [performSave]);

  const saveNow = useCallback((): void => {
    coordinatorRef.current?.saveNow();
  }, []);

  const markChanged = useCallback((): void => {
    coordinatorRef.current?.markChanged();
  }, []);

  const retry = useCallback((): void => {
    coordinatorRef.current?.retry();
  }, []);

  return {
    saveNow,
    markChanged,
    retry,
    status: saveState.status,
    saving: saveState.status === 'saving',
    lastSaved,
    error: saveState.error?.message ?? null,
  };
};
