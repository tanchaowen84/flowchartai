import { qaCookie } from '@site-insights/sdk/contracts';
import { insightsQaUsers } from './insights-feed';

/** QA may exclude a browser, but never supplies or overrides account identity. */
export function experimentQa(
  cookie: string,
  userId?: string,
  mode?: string | null
) {
  if (userId && insightsQaUsers().has(userId)) return true;
  if (mode === '1') return true;
  if (mode === '0') return false;
  const name = qaCookie(process.env.SITE_INSIGHTS_SITE_ID || 'flowchart');
  return cookie.split(';').some((part) => part.trim() === `${name}=1`);
}
