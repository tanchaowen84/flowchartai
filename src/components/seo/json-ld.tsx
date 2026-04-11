import type { ReactElement } from 'react';

type JsonLdEntry = Record<string, unknown>;
type JsonLdData = JsonLdEntry | JsonLdEntry[];

interface JsonLdProps {
  data: JsonLdData;
  id: string;
}

function serializeJsonLd(data: JsonLdData): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLd({ data, id }: JsonLdProps): ReactElement {
  return (
    <script id={id} suppressHydrationWarning type="application/ld+json">
      {serializeJsonLd(data)}
    </script>
  );
}
