export type AiAssistantMode = 'text_to_flowchart' | 'image_to_flowchart';

export const AI_ASSISTANT_MODES: Record<
  AiAssistantMode,
  { label: string; description: string }
> = {
  text_to_flowchart: {
    label: '文本生成',
    description: '根据你的描述生成流程图',
  },
  image_to_flowchart: {
    label: '图片生成',
    description: '从流程图图片提取并生成可编辑流程图',
  },
};

export const DEFAULT_AI_ASSISTANT_MODE: AiAssistantMode = 'text_to_flowchart';
