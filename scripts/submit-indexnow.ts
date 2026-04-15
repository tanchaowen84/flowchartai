import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  extractRobotsDirectives,
  getIndexNowKeyLocation,
  hasBlockingRobotsDirective,
  normalizeBaseUrl,
  parseSitemapUrls,
} from '../src/lib/seo/indexnow';

type CliOptions = {
  baseUrl: string;
  dryRun: boolean;
  endpoint: string;
  sitemapUrl?: string;
};

type InspectionResult = {
  directives: string[];
  reason?: string;
  url: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl:
      process.env.INDEXNOW_BASE_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      'https://flowchartai.org',
    dryRun: false,
    endpoint: INDEXNOW_ENDPOINT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--base-url') {
      options.baseUrl = readArgValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--sitemap-url') {
      options.sitemapUrl = readArgValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--endpoint') {
      options.endpoint = readArgValue(argv, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readArgValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];

  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FlowChartAI-IndexNow/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function inspectUrl(
  url: string,
  expectedHost: string
): Promise<InspectionResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FlowChartAI-IndexNow/1.0',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    return {
      directives: [],
      reason: `status:${response.status}`,
      url,
    };
  }

  const finalUrl = new URL(response.url);

  if (finalUrl.host !== expectedHost) {
    return {
      directives: [],
      reason: `redirect-host:${finalUrl.host}`,
      url,
    };
  }

  const contentType = response.headers.get('content-type') ?? '';
  const html =
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml+xml')
      ? await response.text()
      : undefined;
  const directives = extractRobotsDirectives({
    html,
    xRobotsTag: response.headers.get('x-robots-tag'),
  });

  if (hasBlockingRobotsDirective(directives)) {
    return {
      directives,
      reason: 'robots',
      url,
    };
  }

  return {
    directives,
    url,
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const sitemapUrl = options.sitemapUrl ?? `${baseUrl}/sitemap.xml`;
  const host = new URL(baseUrl).host;
  const rawSitemapUrls = parseSitemapUrls(await fetchText(sitemapUrl));
  const hostUrls = dedupe(
    rawSitemapUrls.filter((item) => new URL(item).host === host)
  );

  const inspections: InspectionResult[] = [];

  for (const url of hostUrls) {
    inspections.push(await inspectUrl(url, host));
  }

  const urlList = inspections
    .filter((item) => !item.reason)
    .map((item) => item.url);
  const skipped = inspections.filter((item) => item.reason);
  const keyLocation = getIndexNowKeyLocation(baseUrl);
  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation,
    urlList,
  };

  console.log(
    JSON.stringify(
      {
        baseUrl,
        dryRun: options.dryRun,
        keyLocation,
        skipped,
        sitemapUrl,
        submittedCount: urlList.length,
        totalSitemapUrls: rawSitemapUrls.length,
      },
      null,
      2
    )
  );

  if (!urlList.length) {
    throw new Error('No indexable URLs remained after filtering');
  }

  if (options.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch(options.endpoint, {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    method: 'POST',
  });
  const body = await response.text();

  console.log(
    JSON.stringify(
      {
        responseBody: body,
        responseStatus: response.status,
        responseStatusText: response.statusText,
      },
      null,
      2
    )
  );

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
