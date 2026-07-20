import type { AiAssistantMode } from '@/lib/ai-modes';

export const TEXT_TO_FLOWCHART_MODEL = 'deepseek/deepseek-v4-flash';
export const IMAGE_TO_FLOWCHART_MODEL = 'bytedance-seed/seed-2.0-mini';

export function getFlowchartModelForMode(mode: AiAssistantMode): string {
  if (mode === 'image_to_flowchart') {
    return process.env.FLOWCHART_IMAGE_MODEL || IMAGE_TO_FLOWCHART_MODEL;
  }

  return process.env.FLOWCHART_TEXT_MODEL || TEXT_TO_FLOWCHART_MODEL;
}
