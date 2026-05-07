import { getFlowchartModelForMode } from '@/lib/ai-models';
import type { AiAssistantMode } from '@/lib/ai-modes';
import { recordAIUsage } from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for recording AI usage
const recordUsageSchema = z.object({
  type: z
    .enum(['flowchart_generation', 'canvas_analysis'])
    .default('flowchart_generation'),
  success: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

function getUsageMode(metadata: Record<string, any>): AiAssistantMode {
  return metadata.sourceMode === 'image_to_flowchart' ||
    metadata.isImageMode === true
    ? 'image_to_flowchart'
    : 'text_to_flowchart';
}

// POST /api/ai/usage/record - Record successful flowchart generation
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = recordUsageSchema.parse(body);

    // Record successful flowchart generation
    await recordAIUsage(session.user.id, validatedData.type, {
      tokensUsed: 0,
      model: getFlowchartModelForMode(getUsageMode(validatedData.metadata)),
      success: validatedData.success,
      metadata: validatedData.metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording AI usage:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
