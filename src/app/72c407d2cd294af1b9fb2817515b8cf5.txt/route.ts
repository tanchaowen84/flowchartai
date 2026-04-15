import { INDEXNOW_KEY } from '@/lib/seo/indexnow';

const HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
};

export function GET(): Response {
  return new Response(INDEXNOW_KEY, {
    status: 200,
    headers: HEADERS,
  });
}

export function HEAD(): Response {
  return new Response(null, {
    status: 200,
    headers: HEADERS,
  });
}
