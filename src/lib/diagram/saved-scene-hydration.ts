interface SavedSceneHydrationInput<TElements, TAppState> {
  elements: TElements;
  appState: TAppState;
}

type SavedSceneHydrationUpdate<TElements, TAppState> = SavedSceneHydrationInput<
  TElements,
  TAppState
> & {
  captureUpdate: 'NEVER';
};

export function createSavedSceneHydrationUpdate<TElements, TAppState>({
  elements,
  appState,
}: SavedSceneHydrationInput<TElements, TAppState>): SavedSceneHydrationUpdate<
  TElements,
  TAppState
> {
  return {
    elements,
    appState,
    captureUpdate: 'NEVER' as const,
  };
}
