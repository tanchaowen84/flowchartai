/**
 * [INPUT] Native diagram documents and explicit object-level mutations.
 * [OUTPUT] Shared validated native document, patch and canvas-command types.
 * [POS] Contract boundary between Agent, browser bridge and saved files.
 * [UPDATE] Keep XML engine, prompts, bridge and FOLDER_INDEX in sync.
 */
import { z } from 'zod';

const geometrySchema = z
  .object({
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().finite().nonnegative().optional(),
    height: z.number().finite().nonnegative().optional(),
  })
  .strict();

export const drawioOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('addCell'),
      xml: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('updateCell'),
      id: z.string().min(1),
      changes: z
        .object({
          value: z.string().optional(),
          style: z.record(z.string()).optional(),
          removeStyleKeys: z.array(z.string()).optional(),
          geometry: geometrySchema.optional(),
          parent: z.string().min(1).optional(),
          source: z.string().min(1).optional(),
          target: z.string().min(1).optional(),
          points: z
            .array(
              z
                .object({ x: z.number().finite(), y: z.number().finite() })
                .strict()
            )
            .optional(),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('removeCell'), id: z.string().min(1) }).strict(),
]);

export const drawioDocumentSchema = z
  .object({
    editorKind: z.literal('drawio'),
    formatVersion: z.literal(1),
    documentId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    diagramType: z.string().min(1),
    pageId: z.string().optional(),
    xml: z.string().trim().min(1),
  })
  .strict();

export const drawioPatchSchema = z
  .object({
    baseRevision: z.number().int().nonnegative(),
    operations: z.array(drawioOperationSchema).min(1),
  })
  .strict();

export const drawioCommandSchema = z.object({
  kind: z.literal('drawio-command'),
  commandId: z.string().min(1),
  documentId: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  operation: z.enum(['create', 'patch', 'replace']),
  pageId: z.string().optional(),
  diagramType: z.string().min(1),
  xml: z.string().optional(),
  patch: drawioPatchSchema.optional(),
  description: z.string(),
  title: z.string().optional(),
});

export type DrawioDocument = z.infer<typeof drawioDocumentSchema>;
export type DrawioPatch = z.infer<typeof drawioPatchSchema>;
export type DrawioOperation = z.infer<typeof drawioOperationSchema>;
export type DrawioCommand = z.infer<typeof drawioCommandSchema>;

export const EMPTY_DRAWIO_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

export interface NativeEditorController {
  getDocument: () => DrawioDocument;
  getSelection: () => string[];
  applyCommand: (command: DrawioCommand) => Promise<void>;
}
