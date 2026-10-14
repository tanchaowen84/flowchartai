/**
 * [INPUT] Confirmed server milestones and actual browser request headers.
 * [OUTPUT] Bounded Plausible receipt with safe properties and canonical URL.
 * [POS] Registration, accepted generation and confirmed payment delivery.
 * [UPDATE] Keep production gates and visitor-context tests in sync.
 */
import { isIP } from 'node:net';
import {
  type EVENTS,
  type EventProperties,
  eventPath,
  isProductionAnalytics,
  sanitizeEventProperties,
} from './core-goals';

type ServerEvent =
  | typeof EVENTS.registrationCompleted
  | typeof EVENTS.processingStarted
  | typeof EVENTS.paymentConfirmed;

export function visitorHeaders(
  headers: Headers
): Record<string, string> | null {
  const agent = headers.get('user-agent');
  const forwarded =
    headers.get('x-vercel-forwarded-for') ?? headers.get('x-forwarded-for');
  const ip = forwarded
    ?.split(',')
    .map((value) => value.trim())
    .find((value) => isIP(value));
  return agent && ip
    ? { 'User-Agent': agent.slice(0, 512), 'X-Forwarded-For': ip }
    : null;
}

export async function sendServerEvent(
  event: ServerEvent,
  properties: EventProperties,
  headers: Headers
): Promise<boolean> {
  if (!isProductionAnalytics()) return false;
  try {
    const visitor = visitorHeaders(headers);
    if (!visitor) return false;
    const response = await fetch(
      new URL('/api/event', process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...visitor },
        body: JSON.stringify({
          name: event,
          domain: 'flowchartai.org',
          url: `https://flowchartai.org${eventPath(event)}`,
          props: sanitizeEventProperties(properties),
        }),
        signal: AbortSignal.timeout(1500),
      }
    );
    return response.ok && !response.headers.has('x-plausible-dropped');
  } catch {
    return false;
  }
}
