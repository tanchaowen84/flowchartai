const BLOCKING_DIRECTIVES = new Set(['noindex', 'nofollow', 'none']);

export const INDEXNOW_KEY = '72c407d2cd294af1b9fb2817515b8cf5';
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function getIndexNowKeyLocation(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}${INDEXNOW_KEY_PATH}`;
}

export function parseSitemapUrls(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map(([, url]) =>
    decodeXmlEntities(url.trim())
  );
}

export function hasBlockingRobotsDirective(directives: string[]): boolean {
  return directives.some((directive) => BLOCKING_DIRECTIVES.has(directive));
}

export function extractRobotsDirectives({
  html,
  xRobotsTag,
}: {
  html?: string;
  xRobotsTag?: string | null;
}): string[] {
  const directives = new Set<string>();

  addDirectiveList(directives, xRobotsTag);

  if (!html) {
    return Array.from(directives);
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = getMetaAttribute(tag, 'name')?.toLowerCase();
    const content = getMetaAttribute(tag, 'content');

    if (!name || !content) {
      continue;
    }

    if (!name.includes('robots') && !name.endsWith('bot')) {
      continue;
    }

    addDirectiveList(directives, content);
  }

  return Array.from(directives);
}

function addDirectiveList(target: Set<string>, rawValue?: string | null): void {
  if (!rawValue) {
    return;
  }

  rawValue
    .split(',')
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean)
    .forEach((directive) => target.add(directive));
}

function getMetaAttribute(tag: string, attribute: string): string | undefined {
  const doubleQuoted = new RegExp(`${attribute}\\s*=\\s*"([^"]*)"`, 'i').exec(
    tag
  );

  if (doubleQuoted) {
    return doubleQuoted[1];
  }

  const singleQuoted = new RegExp(`${attribute}\\s*=\\s*'([^']*)'`, 'i').exec(
    tag
  );

  if (singleQuoted) {
    return singleQuoted[1];
  }

  const unquoted = new RegExp(`${attribute}\\s*=\\s*([^\\s>]+)`, 'i').exec(tag);

  return unquoted?.[1];
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
