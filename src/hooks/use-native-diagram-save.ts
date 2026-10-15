'use client';

import type { DrawioBridge } from '@/lib/drawio/editor-bridge';
import {
  type FlowchartAutosaveState,
  createFlowchartAutosaveCoordinator,
} from '@/lib/flowchart-autosave';
/**
 * [INPUT] Native document/controller and existing authenticated file identity.
 * [OUTPUT] Existing autosave states through existing flowchart save endpoints.
 * [POS] Native serialization adapter; no new database or save service.
 * [UPDATE] Sync native document format and legacy/native dispatch tests.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useNativeDiagramSave(
  bridge: DrawioBridge | null,
  fileId: string | undefined,
  title: string,
  onFileId: (id: string) => void
) {
  const [state, setState] = useState<FlowchartAutosaveState>({
    status: 'idle',
  });
  const current = useRef({ bridge, fileId, title, onFileId });
  current.current = {
    bridge,
    fileId: current.current.fileId || fileId,
    title,
    onFileId,
  };
  const coordinator = useRef<ReturnType<
    typeof createFlowchartAutosaveCoordinator
  > | null>(null);
  const pendingSave = useRef<Promise<void> | null>(null);
  const saveRequest = useCallback(async (): Promise<void> => {
    const { bridge, title } = current.current;
    if (!bridge) throw new Error('Diagram editor is not ready');
    const id = current.current.fileId;
    const response = await fetch(
      id ? `/api/flowcharts/${id}` : '/api/flowcharts',
      {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: JSON.stringify(bridge.getDocument()),
        }),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Could not save diagram');
    }
    const saved = await response.json();
    if (!id) {
      if (!saved.id) throw new Error('Saved diagram has no ID');
      current.current.fileId = saved.id;
      window.history.replaceState(null, '', `/canvas/${saved.id}`);
      current.current.onFileId(saved.id);
    }
  }, []);
  const save = useCallback((): Promise<void> => {
    if (pendingSave.current) return pendingSave.current;
    pendingSave.current = saveRequest().finally(() => {
      pendingSave.current = null;
    });
    return pendingSave.current;
  }, [saveRequest]);
  useEffect(() => {
    const instance = createFlowchartAutosaveCoordinator({
      delayMs: 3000,
      save,
      onStateChange: setState,
    });
    coordinator.current = instance;
    return () => {
      instance.dispose();
      coordinator.current = null;
    };
  }, [save]);
  return {
    ensureSaved: async (): Promise<string> => {
      await save();
      // A save that started before the AI mutation must not acknowledge the older revision.
      await save();
      if (!current.current.fileId) throw new Error('Diagram was not saved');
      return current.current.fileId;
    },
    status: state.status,
    error: state.error?.message || null,
    saveNow: () => coordinator.current?.saveNow(),
    markChanged: () => coordinator.current?.markChanged(),
    retry: () => coordinator.current?.retry(),
  };
}
