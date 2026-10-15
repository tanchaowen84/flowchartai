/** Owned native files shared with the website. Content hashes fence concurrent website saves. */
import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { developerVersions } from '@/db/developer-schema';
import { flowcharts } from '@/db/schema';
import type { BillingTx } from '@/lib/billing/wallet';
import {
  type DrawioDocument,
  drawioDocumentSchema,
} from '@/lib/drawio/contracts';
import {
  readNativeCells,
  validateDrawioXml,
} from '@/lib/drawio/native-document';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { activeCredential } from './access';
import {
  DeveloperError,
  type Principal,
  hash,
  origin,
  requireScope,
} from './contract';

export const saveSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    document: drawioDocumentSchema,
    expected_version: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
export function nativeDocument(content: string): DrawioDocument {
  const result = drawioDocumentSchema.safeParse(JSON.parse(content));
  if (!result.success)
    throw new DeveloperError(
      'unsupported_format',
      'Open this legacy diagram in the website editor. Native AI edits require draw.io format.',
      422
    );
  validateDrawioXml(result.data.xml, result.data.pageId);
  return result.data;
}
export function validDocument(document: DrawioDocument): DrawioDocument {
  if (Buffer.byteLength(document.xml) > 2_000_000)
    throw new DeveloperError(
      'diagram_too_large',
      'Diagram XML is too large.',
      413
    );
  validateDrawioXml(document.xml, document.pageId);
  if (readNativeCells(document).length > 2000)
    throw new DeveloperError(
      'diagram_too_large',
      'Use diagrams with at most 2,000 objects.',
      413
    );
  return document;
}
export function diagramVersion(row: {
  title: string;
  content: string;
}): string {
  return hash(
    `${Buffer.byteLength(row.title, 'utf8')}:${row.title}${row.content}`
  );
}
export function publicDiagram(
  row: typeof flowcharts.$inferSelect,
  includeContent = true
): Record<string, unknown> {
  let document: unknown;
  try {
    document = JSON.parse(row.content);
  } catch {
    document = null;
  }
  return {
    id: row.id,
    title: row.title,
    version: diagramVersion(row),
    format:
      (document as { editorKind?: string })?.editorKind === 'drawio'
        ? 'drawio'
        : 'legacy',
    ...(includeContent ? { document } : {}),
    open_url: `${origin()}/canvas/${encodeURIComponent(row.id)}`,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
export async function ownedDiagram(
  userId: string,
  id: string,
  tx?: BillingTx
): Promise<typeof flowcharts.$inferSelect> {
  const db = tx || (await getDb());
  const [row] = await db
    .select()
    .from(flowcharts)
    .where(and(eq(flowcharts.id, id), eq(flowcharts.userId, userId)));
  if (!row) throw new DeveloperError('not_found', 'Diagram not found.', 404);
  return row;
}
export async function listDiagrams(
  principal: Principal,
  cursor?: string
): Promise<Record<string, unknown>> {
  requireScope(principal, 'diagrams:read');
  const rows = await (await getDb())
    .select({
      id: flowcharts.id,
      title: flowcharts.title,
      version: sql<string>`encode(sha256(convert_to(octet_length(${flowcharts.title})::text || ':' || ${flowcharts.title} || ${flowcharts.content},'UTF8')),'hex')`,
      createdAt: flowcharts.createdAt,
      updatedAt: flowcharts.updatedAt,
    })
    .from(flowcharts)
    .where(
      and(
        eq(flowcharts.userId, principal.userId),
        ...(cursor ? [lt(flowcharts.id, cursor)] : [])
      )
    )
    .orderBy(desc(flowcharts.id))
    .limit(21);
  return {
    data: rows.slice(0, 20).map((r) => ({
      id: r.id,
      title: r.title,
      version: r.version,
      open_url: `${origin()}/canvas/${encodeURIComponent(r.id)}`,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    })),
    next_cursor: rows.length > 20 ? rows[19].id : null,
  };
}
export async function readDiagram(
  principal: Principal,
  id: string
): Promise<Record<string, unknown>> {
  requireScope(principal, 'diagrams:read');
  return publicDiagram(await ownedDiagram(principal.userId, id));
}
export async function persistDiagram(
  tx: BillingTx,
  userId: string,
  id: string,
  title: string,
  document: DrawioDocument,
  expectedVersion?: string,
  versionId: string = randomUUID()
): Promise<typeof flowcharts.$inferSelect> {
  validDocument(document);
  const content = JSON.stringify(document);
  const [existing] = await tx
    .select()
    .from(flowcharts)
    .where(eq(flowcharts.id, id))
    .for('update');
  if (existing) {
    if (existing.userId !== userId)
      throw new DeveloperError('not_found', 'Diagram not found.', 404);
    if (!expectedVersion || diagramVersion(existing) !== expectedVersion)
      throw new DeveloperError(
        'version_conflict',
        'Diagram changed. Read it again before editing or saving.',
        409
      );
    await tx
      .insert(developerVersions)
      .values({
        id: `${versionId}:before`,
        userId,
        diagramId: id,
        version: diagramVersion(existing),
        title: existing.title,
        content: existing.content,
      })
      .onConflictDoNothing();
    const [row] = await tx
      .update(flowcharts)
      .set({ title, content, updatedAt: new Date() })
      .where(and(eq(flowcharts.id, id), eq(flowcharts.userId, userId)))
      .returning();
    await tx
      .insert(developerVersions)
      .values({
        id: versionId,
        userId,
        diagramId: id,
        version: diagramVersion({ title, content }),
        title,
        content,
      })
      .onConflictDoNothing();
    return row;
  }
  if (expectedVersion)
    throw new DeveloperError('not_found', 'Diagram no longer exists.', 404);
  const [row] = await tx
    .insert(flowcharts)
    .values({ id, userId, title, content })
    .returning();
  await tx
    .insert(developerVersions)
    .values({
      id: versionId,
      userId,
      diagramId: id,
      version: diagramVersion({ title, content }),
      title,
      content,
    })
    .onConflictDoNothing();
  return row;
}
export async function diagramVersions(
  principal: Principal,
  id: string,
  version?: string
): Promise<Record<string, unknown>> {
  requireScope(principal, 'diagrams:read');
  await ownedDiagram(principal.userId, id);
  const db = await getDb();
  if (version) {
    if (!/^[a-f0-9]{64}$/.test(version))
      throw new DeveloperError('invalid_version', 'Use a saved version hash.');
    const [row] = await db
      .select()
      .from(developerVersions)
      .where(
        and(
          eq(developerVersions.diagramId, id),
          eq(developerVersions.userId, principal.userId),
          eq(developerVersions.version, version)
        )
      )
      .orderBy(desc(developerVersions.createdAt))
      .limit(1);
    if (!row) throw new DeveloperError('not_found', 'Version not found.', 404);
    return {
      version: row.version,
      title: row.title,
      document: JSON.parse(row.content),
      created_at: row.createdAt,
    };
  }
  const rows = await db
    .select({
      version: developerVersions.version,
      title: developerVersions.title,
      created_at: developerVersions.createdAt,
    })
    .from(developerVersions)
    .where(
      and(
        eq(developerVersions.diagramId, id),
        eq(developerVersions.userId, principal.userId)
      )
    )
    .orderBy(desc(developerVersions.createdAt))
    .limit(50);
  return { data: rows };
}
export async function exportDiagram(
  principal: Principal,
  id: string,
  format: string
): Promise<{ body: string; contentType: string; filename: string }> {
  requireScope(principal, 'diagrams:export');
  const row = await ownedDiagram(principal.userId, id);
  if (format === 'json')
    return {
      body: row.content,
      contentType: 'application/json',
      filename: `${id}.json`,
    };
  if (format !== 'drawio')
    throw new DeveloperError(
      'unsupported_format',
      'API exports support drawio and json. Open the diagram to download SVG or PNG.'
    );
  return {
    body: nativeDocument(row.content).xml,
    contentType: 'application/xml',
    filename: `${id}.drawio`,
  };
}
