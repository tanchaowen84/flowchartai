import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { expect, it } from 'vitest';
import { experimentCapabilities } from '../src/analytics/experiment-capabilities';

it('runs the actual setup command and registers only the shared manifest', async () => {
  const requests: { url?: string; auth?: string; body: unknown }[] = [];
  const key = 'local-test-write-key-only-1234567890';
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    requests.push({
      url: req.url,
      auth: req.headers.authorization,
      body: JSON.parse(raw),
    });
    res.setHeader('content-type', 'application/json');
    res.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('No test port');
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/register-insights-experiments.ts'],
      {
        env: {
          ...process.env,
          SITE_INSIGHTS_ENDPOINT: `http://127.0.0.1:${address.port}/insights`,
          SITE_INSIGHTS_SITE_ID: 'local-site',
          SITE_INSIGHTS_WRITE_KEY: key,
        },
      }
    );
    let output = '';
    child.stdout.on('data', (v) => {
      output += v;
    });
    child.stderr.on('data', (v) => {
      output += v;
    });
    const code = await new Promise((resolve) => child.on('close', resolve));
    expect({ code, output }).toEqual({
      code: 0,
      output:
        'Registered Flowchart experiment capabilities. No experiment was started.\n',
    });
    expect(requests).toEqual([
      {
        url: '/insights/api/v1/experiments/server/capabilities',
        auth: `Bearer ${key}`,
        body: { site_id: 'local-site', targets: experimentCapabilities },
      },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve()))
    );
  }
});
