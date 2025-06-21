import { getDb } from '@/db';
import { flowcharts } from '@/db/schema';
import { auth } from '@/lib/auth';
import { desc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for creating flowcharts
const createFlowchartSchema = z.object({
  title: z.string().optional().default('Untitled'),
  content: z.string().min(1, 'Content is required'),
});

// GET /api/flowcharts - Get user's flowcharts
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const userFlowcharts = await db
      .select({
        id: flowcharts.id,
        title: flowcharts.title,
        content: flowcharts.content,
        createdAt: flowcharts.createdAt,
        updatedAt: flowcharts.updatedAt,
      })
      .from(flowcharts)
      .where(eq(flowcharts.userId, session.user.id))
      .orderBy(desc(flowcharts.updatedAt));

    return NextResponse.json({
      flowcharts: userFlowcharts,
    });
  } catch (error) {
    console.error('Error fetching flowcharts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/flowcharts - Create new flowchart
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createFlowchartSchema.parse(body);

    // Generate unique ID
    const flowchartId = `flowchart_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const db = await getDb();
    const [newFlowchart] = await db
      .insert(flowcharts)
      .values({
        id: flowchartId,
        title: validatedData.title,
        content: validatedData.content,
        userId: session.user.id,
      })
      .returning({ id: flowcharts.id });

    return NextResponse.json(
      {
        id: newFlowchart.id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating flowchart:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
