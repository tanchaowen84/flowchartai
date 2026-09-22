import { getDb } from '@/db';
import { flowcharts } from '@/db/schema';
import { auth } from '@/lib/auth';
import { decodeImageDataUrl, readAssetDataUrl } from '@/lib/flowchart-assets';
import { createFlowchartAssetStore } from '@/storage/flowchart-asset-store';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return new Response(null, { status: 401 });
    const { id } = await params;
    const db = await getDb();
    const [chart] = await db
      .select({ thumbnail: flowcharts.thumbnail })
      .from(flowcharts)
      .where(
        and(eq(flowcharts.id, id), eq(flowcharts.userId, session.user.id))
      );
    if (!chart?.thumbnail) return new Response(null, { status: 404 });
    const dataUrl = await readAssetDataUrl(
      session.user.id,
      chart.thumbnail,
      createFlowchartAssetStore()
    );
    const image = decodeImageDataUrl(dataUrl);
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error('Error reading flowchart thumbnail:', error);
    return NextResponse.json(
      { error: 'Unable to load thumbnail' },
      { status: 500 }
    );
  }
}
