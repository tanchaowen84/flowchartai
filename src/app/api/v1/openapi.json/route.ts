import { openapi } from '@/developer/openapi';
export function GET(): Response {
  return Response.json(openapi(), {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
