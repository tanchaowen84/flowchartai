export type AiAssistantMode = 'text_to_flowchart' | 'image_to_flowchart';

export const AI_ASSISTANT_MODES: Record<
  AiAssistantMode,
  { label: string; description: string }
> = {
  text_to_flowchart: {
    label: 'Text to Flowchart',
    description: '',
  },
  image_to_flowchart: {
    label: 'Image to Flowchart',
    description: '',
  },
};

export const DEFAULT_AI_ASSISTANT_MODE: AiAssistantMode = 'text_to_flowchart';
