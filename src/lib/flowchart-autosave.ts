export type FlowchartAutosaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error';

export interface FlowchartAutosaveState {
  status: FlowchartAutosaveStatus;
  error?: Error;
}

interface FlowchartAutosaveCoordinatorOptions {
  delayMs: number;
  save: () => Promise<void>;
  onStateChange: (state: FlowchartAutosaveState) => void;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}

export interface FlowchartAutosaveCoordinator {
  markChanged: () => void;
  saveNow: () => void;
  retry: () => void;
  dispose: () => void;
  getState: () => FlowchartAutosaveState;
}

interface FlowchartSaveContent {
  elements: readonly unknown[];
  files: Record<string, unknown>;
  flowchartAi?: unknown;
}

export function serializeFlowchartSaveContent({
  elements,
  files,
  flowchartAi,
}: FlowchartSaveContent): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements,
    files,
    flowchartAi,
  });
}

export function getFlowchartContentFingerprint(
  elements: readonly { id?: string; version: number }[],
  files: Record<string, unknown>
): string {
  const elementVersions = elements
    .map((element, index) => `${element.id ?? index}:${element.version}`)
    .join('|');
  const fileIds = Object.keys(files).sort().join('|');
  return `${elementVersions}::${fileIds}`;
}

export function createFlowchartAutosaveCoordinator({
  delayMs,
  save,
  onStateChange,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: FlowchartAutosaveCoordinatorOptions): FlowchartAutosaveCoordinator {
  let state: FlowchartAutosaveState = { status: 'idle' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let savingRevision = 0;
  let isSaving = false;
  let disposed = false;

  const updateState = (nextState: FlowchartAutosaveState): void => {
    state = nextState;
    onStateChange(nextState);
  };

  const clearPendingTimer = (): void => {
    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }
  };

  const runSave = async (): Promise<void> => {
    clearPendingTimer();
    if (disposed || isSaving) return;

    isSaving = true;
    savingRevision = revision;
    updateState({ status: 'saving' });

    try {
      await save();
      isSaving = false;

      if (disposed) return;
      if (revision > savingRevision) {
        void runSave();
        return;
      }

      updateState({ status: 'saved' });
    } catch (error) {
      isSaving = false;
      if (disposed) return;
      updateState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Save failed'),
      });
    }
  };

  const schedule = (): void => {
    clearPendingTimer();
    timer = setTimer(() => {
      timer = undefined;
      void runSave();
    }, delayMs);
  };

  return {
    markChanged(): void {
      if (disposed) return;
      revision += 1;

      if (state.status === 'error' || isSaving) return;

      updateState({ status: 'dirty' });
      schedule();
    },
    saveNow(): void {
      if (disposed) return;
      if (isSaving) {
        revision += 1;
        return;
      }
      void runSave();
    },
    retry(): void {
      if (disposed || state.status !== 'error') return;
      void runSave();
    },
    dispose(): void {
      disposed = true;
      clearPendingTimer();
    },
    getState(): FlowchartAutosaveState {
      return state;
    },
  };
}
