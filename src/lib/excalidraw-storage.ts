/**
 * Generate a unique ID for new flowcharts
 */
export const generateFlowchartId = (): string => {
  return `flowchart_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Validate if the content is valid Excalidraw data
 */
export const validateFlowchartContent = (content: string): boolean => {
  try {
    const data = JSON.parse(content);
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.elements) &&
      data.appState &&
      typeof data.appState === 'object'
    );
  } catch {
    return false;
  }
};

/**
 * Create empty Excalidraw content for new flowcharts
 */
export const createEmptyFlowchartContent = (): string => {
  const emptyData = {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
      currentItemFontFamily: 1,
      zenModeEnabled: false,
    },
    files: {},
  };

  return JSON.stringify(emptyData);
};
