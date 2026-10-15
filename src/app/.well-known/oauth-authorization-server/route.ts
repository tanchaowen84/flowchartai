import { authorizationMetadata } from '@/developer/oauth';
export function GET(): Response {
  return Response.json(authorizationMetadata(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
