import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { SCOPES } from './scopes';
export { SCOPES } from './scopes';
export type Scope = (typeof SCOPES)[number];
export interface Principal {
  userId: string;
  credentialId: string;
  scopes: string[];
  channel: 'api' | 'mcp';
}
export class DeveloperError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public requiredCredits?: number
  ) {
    super(message);
  }
}
export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function secret(prefix: string): string {
  return prefix + randomBytes(32).toString('base64url');
}
export function origin(): string {
  return new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://flowchartai.org')
    .origin;
}
export function resource(): string {
  return `${origin()}/api/mcp`;
}
export function requireScope(principal: Principal, scope: Scope): void {
  if (!principal.scopes.includes(scope))
    throw new DeveloperError(
      'insufficient_scope',
      `This operation requires ${scope}.`,
      403
    );
}
export const limitsSchema = z.object({
  daily_credits: z.number().int().min(1).max(1_000_000).default(1000),
  daily_requests: z.number().int().min(1).max(10000).default(100),
});
export const keySchema = limitsSchema
  .extend({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(z.enum(SCOPES)).min(1).max(SCOPES.length),
    expires_in_days: z.number().int().min(1).max(365).default(90),
    requests_per_minute: z.number().int().min(1).max(120).default(60),
  })
  .strict();
export const generationSchema = z
  .object({
    prompt: z.string().trim().min(1).max(12000),
    max_credits: z.number().int().min(1).max(2000),
    image: z.string().max(2_800_000).optional(),
    diagram_id: z.string().min(1).max(160).optional(),
    expected_version: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.diagram_id && !input.expected_version)
      ctx.addIssue({
        code: 'custom',
        message: 'Editing requires expected_version.',
      });
  });
export type GenerationInput = z.infer<typeof generationSchema>;
export const idempotencySchema = z.string().regex(/^[A-Za-z0-9_.:-]{8,120}$/);
export function validateImage(image: string): void {
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match)
    throw new DeveloperError(
      'invalid_image',
      'Use one base64 PNG, JPEG or WebP data URI.'
    );
  const bytes = Buffer.from(match[2], 'base64');
  const valid =
    match[1] === 'png'
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === 'jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length > 2_000_000 || bytes.length < 12)
    throw new DeveloperError(
      'invalid_image',
      'Use a valid raster image of at most 2 MB.'
    );
}
