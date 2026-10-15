import { rest } from '@/developer/rest';
export const runtime = 'nodejs';
export const maxDuration = 300;
async function handle(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  return rest(request, (await params).path);
}
export { handle as GET, handle as POST, handle as PUT };
