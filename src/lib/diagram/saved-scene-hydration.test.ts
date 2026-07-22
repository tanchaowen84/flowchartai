import { describe, expect, it } from 'vitest';
import { createSavedSceneHydrationUpdate } from './saved-scene-hydration';

describe('createSavedSceneHydrationUpdate', () => {
  it('loads a persisted scene as a non-undoable history baseline', () => {
    const elements = [{ id: 'node-1' }];
    const appState = { viewBackgroundColor: '#ffffff' };

    expect(createSavedSceneHydrationUpdate({ elements, appState })).toEqual({
      elements,
      appState,
      captureUpdate: 'NEVER',
    });
  });
});
