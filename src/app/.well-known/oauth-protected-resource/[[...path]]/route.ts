import { protectedResourceMetadata } from '@/developer/oauth';
export function GET(): Response {
  return Response.json(protectedResourceMetadata(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
