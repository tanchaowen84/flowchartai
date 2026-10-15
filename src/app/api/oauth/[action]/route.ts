import { oauthEndpoint } from '@/developer/oauth';
export const runtime = 'nodejs';
async function handle(
  request: Request,
  { params }: { params: Promise<{ action: string }> }
): Promise<Response> {
  const action = (await params).action;
  if ((request.method === 'GET') !== (action === 'authorize'))
    return new Response(null, { status: 405 });
  return oauthEndpoint(request, action);
}
export { handle as GET, handle as POST };
