import type { AiAssistantMode } from '@/lib/ai-modes';

export function getHeroSubmitLabel(
  mode: AiAssistantMode,
  isLoading: boolean
): string {
  if (isLoading) return 'Creating flowchart';

  return mode === 'image_to_flowchart'
    ? 'Create flowchart from image'
    : 'Create flowchart from text';
}
