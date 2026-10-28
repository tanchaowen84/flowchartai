/** Explicit setup only. Does not create/start experiments or change provider products. */
import 'dotenv/config';
import { experimentCapabilities } from '../src/analytics/experiment-capabilities';
async function main() {
  const { createExperimentClient } = await import('@site-insights/sdk/server');
  const key = process.env.SITE_INSIGHTS_WRITE_KEY;
  if (!key) throw new Error('SITE_INSIGHTS_WRITE_KEY is required');
  await createExperimentClient({
    endpoint:
      process.env.SITE_INSIGHTS_ENDPOINT || 'https://myplausible.app/insights',
    siteId: process.env.SITE_INSIGHTS_SITE_ID || 'flowchart',
    key,
  }).register(experimentCapabilities);
  console.log(
    'Registered Flowchart experiment capabilities. No experiment was started.'
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Registration failed');
  process.exitCode = 1;
});
