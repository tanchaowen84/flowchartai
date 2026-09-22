import { getDb } from '@/db';
import { flowcharts } from '@/db/schema';
import { auth } from '@/lib/auth';
import {
  externalizeFlowchartAssets,
  hydrateFlowchartContent,
  thumbnailUrl,
} from '@/lib/flowchart-assets';
import { createFlowchartAssetStore } from '@/storage/flowchart-asset-store';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for updating flowcharts
const updateFlowchartSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  thumbnail: z.string().optional(),
});

// GET /api/flowcharts/[id] - Get specific flowchart
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const [flowchart] = await db
      .select()
      .from(flowcharts)
      .where(
        and(eq(flowcharts.id, id), eq(flowcharts.userId, session.user.id))
      );

    if (!flowchart) {
      return NextResponse.json(
        { error: 'Flowchart not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: flowchart.id,
      title: flowchart.title,
      content: await hydrateFlowchartContent(
        session.user.id,
        flowchart.content,
        createFlowchartAssetStore()
      ),
      thumbnail: thumbnailUrl(flowchart.id, flowchart.thumbnail),
      createdAt: flowchart.createdAt,
      updatedAt: flowchart.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching flowchart:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/flowcharts/[id] - Update flowchart
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateFlowchartSchema.parse(body);

    const db = await getDb();

    // Check if flowchart exists and belongs to user
    const [existingFlowchart] = await db
      .select({ id: flowcharts.id })
      .from(flowcharts)
      .where(
        and(eq(flowcharts.id, id), eq(flowcharts.userId, session.user.id))
      );

    if (!existingFlowchart) {
      return NextResponse.json(
        { error: 'Flowchart not found' },
        { status: 404 }
      );
    }

    // Update only provided fields
    const storedAssets = await externalizeFlowchartAssets(
      session.user.id,
      validatedData,
      createFlowchartAssetStore()
    );
    const updateData: any = {};
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.content !== undefined) {
      updateData.content = storedAssets.content;
    }
    if (validatedData.thumbnail !== undefined) {
      updateData.thumbnail = storedAssets.thumbnail;
    }
    updateData.updatedAt = new Date();

    await db
      .update(flowcharts)
      .set(updateData)
      .where(
        and(eq(flowcharts.id, id), eq(flowcharts.userId, session.user.id))
      );

    return NextResponse.json({
      success: true,
      message: 'Flowchart updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating flowchart:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/flowcharts/[id] - Delete flowchart
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();

    // Check if flowchart exists and belongs to user
    const [existingFlowchart] = await db
      .select({ id: flowcharts.id })
      .from(flowcharts)
      .where(
        and(eq(flowcharts.id, id), eq(flowcharts.userId, session.user.id))
      );

    if (!existingFlowchart) {
      return NextResponse.json(
        { error: 'Flowchart not found' },
        { status: 404 }
      );
    }

    await db.delete(flowcharts).where(eq(flowcharts.id, id));

    return NextResponse.json({
      success: true,
      message: 'Flowchart deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting flowchart:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
