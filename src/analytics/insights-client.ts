import type { start } from './insights-sdk';
let client: ReturnType<typeof start> | null = null;
export const getInsightsClient = () => client;
export function setInsightsClient(
  value: ReturnType<typeof start> | null
): void {
  client = value;
  dispatchEvent(new Event('insights:ready'));
}
