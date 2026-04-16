const INDEXNOW_KEY = '72c407d2cd294af1b9fb2817515b8cf5';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const BLOCKING_DIRECTIVES = new Set(['noindex', 'none']);

interface CliOptions {
  baseUrl: string;
  dryRun: boolean;
  sitemapUrl: string;
}

interface FetchResult {
  body: string;
  headers: Headers;
  status: number;
  url: string;
}

interface UrlDecision {
  directives: string[];
  reason?: string;
  url: string;
}

function parseArgs(argv: string[]): CliOptions {
  let baseUrl = '';
  let sitemapUrl = '';
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      baseUrl = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--sitemap-url') {
      sitemapUrl = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const normalizedBaseUrl = normalizeUrl(
    baseUrl || process.env.NEXT_PUBLIC_BASE_URL || ''
  );

  if (!normalizedBaseUrl) {
    throw new Error(
      'Missing base URL. Pass --base-url https://flowchartai.org or set NEXT_PUBLIC_BASE_URL.'
    );
  }

  return {
    baseUrl: normalizedBaseUrl,
    dryRun,
    sitemapUrl: sitemapUrl || `${normalizedBaseUrl}/sitemap.xml`,
  };
}

function printHelp(): void {
  console.log(
    [
      'Usage: pnpm exec tsx scripts/submit-indexnow.ts --base-url https://flowchartai.org [--dry-run]',
      '',
      'Options:',
      '  --base-url <url>     Site base URL used for host and keyLocation.',
      '  --sitemap-url <url>  Override sitemap source. Defaults to <base-url>/sitemap.xml.',
      '  --dry-run            Collect and print the payload without sending it.',
    ].join('\n')
  );
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getKeyLocation(baseUrl: string): string {
  return `${normalizeUrl(baseUrl)}/${INDEXNOW_KEY}.txt`;
}

async function fetchText(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'flowchartai-indexnow-submit/1.0',
    },
    redirect: 'follow',
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return {
    body,
    headers: response.headers,
    status: response.status,
    url: response.url,
  };
}

function extractLocValues(xml: string): string[] {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    decodeXmlEntities(match[1]?.trim() ?? '')
  );
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

async function collectSitemapUrls(
  sitemapUrl: string,
  visited = new Set<string>()
): Promise<string[]> {
  const normalizedSitemapUrl = normalizeUrl(sitemapUrl);
  if (visited.has(normalizedSitemapUrl)) {
    return [];
  }
  visited.add(normalizedSitemapUrl);

  const { body } = await fetchText(normalizedSitemapUrl);

  if (body.includes('<sitemapindex')) {
    const nestedSitemaps = extractLocValues(body);
    const nestedResults = await Promise.all(
      nestedSitemaps.map((url) => collectSitemapUrls(url, visited))
    );

    return nestedResults.flat();
  }

  return extractLocValues(body);
}

function parseRobotsContent(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .flatMap((part) => part.split(';'))
    .map((part) => part.trim().toLowerCase())
    .map((part) => {
      const [, directive = part] = part.split(':').map((token) => token.trim());
      return directive;
    })
    .filter(Boolean);
}

function parseMetaRobots(html: string): string[] {
  const directives: string[] = [];
  const metaTags = html.match(/<meta\s+[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([a-zA-Z:-]+)\s*=\s*["']([^"']*)["']/g)].map(
        (match) => [match[1].toLowerCase(), match[2]]
      )
    );

    if ((attributes.name ?? '').toLowerCase() !== 'robots') {
      continue;
    }

    directives.push(...parseRobotsContent(attributes.content ?? ''));
  }

  return directives;
}

function hasBlockingDirective(directives: string[]): boolean {
  return directives.some((directive) => BLOCKING_DIRECTIVES.has(directive));
}

async function evaluateUrl(
  rawUrl: string,
  allowedHost: string
): Promise<UrlDecision> {
  const url = new URL(rawUrl);

  if (url.host !== allowedHost) {
    return {
      url: rawUrl,
      directives: [],
      reason: `skip: host mismatch (${url.host})`,
    };
  }

  const page = await fetchText(rawUrl);
  const headerDirectives = parseRobotsContent(page.headers.get('x-robots-tag'));
  const metaDirectives = parseMetaRobots(page.body);
  const directives = [...new Set([...headerDirectives, ...metaDirectives])];

  if (hasBlockingDirective(directives)) {
    return {
      url: rawUrl,
      directives,
      reason: `skip: blocking robots (${directives.join(', ')})`,
    };
  }

  return {
    url: rawUrl,
    directives,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const base = new URL(options.baseUrl);
  const keyLocation = getKeyLocation(options.baseUrl);
  const sitemapUrls = await collectSitemapUrls(options.sitemapUrl);
  const uniqueUrls = [...new Set(sitemapUrls)];
  const decisions: UrlDecision[] = [];
  const submittedUrls: string[] = [];

  for (const url of uniqueUrls) {
    const decision = await evaluateUrl(url, base.host);
    decisions.push(decision);

    if (!decision.reason) {
      submittedUrls.push(decision.url);
    }
  }

  const skippedUrls = decisions.filter((decision) => decision.reason);

  console.log(
    JSON.stringify(
      {
        baseUrl: options.baseUrl,
        dryRun: options.dryRun,
        keyLocation,
        sitemapUrl: options.sitemapUrl,
        submittedCount: submittedUrls.length,
        skippedCount: skippedUrls.length,
        submittedUrls,
        skippedUrls,
      },
      null,
      2
    )
  );

  if (options.dryRun) {
    return;
  }

  if (submittedUrls.length === 0) {
    throw new Error('No eligible URLs found for IndexNow submission.');
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      host: base.host,
      key: INDEXNOW_KEY,
      keyLocation,
      urlList: submittedUrls,
    }),
  });

  const responseBody = await response.text();

  console.log(
    JSON.stringify(
      {
        responseBody: responseBody || null,
        responseStatus: response.status,
      },
      null,
      2
    )
  );

  if (!response.ok) {
    throw new Error(`IndexNow submission failed with ${response.status}.`);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'IndexNow submission failed.'
  );
  process.exitCode = 1;
});
