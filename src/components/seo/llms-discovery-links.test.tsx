import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LlmsDiscoveryLinks } from './llms-discovery-links';

describe('LlmsDiscoveryLinks', () => {
  it('publishes standard alternate links for both llms documents', () => {
    const markup = renderToStaticMarkup(<LlmsDiscoveryLinks />);

    expect(markup).toContain('rel="alternate"');
    expect(markup).toContain('type="text/markdown"');
    expect(markup).toContain('href="/llms.txt"');
    expect(markup).toContain('href="/llms-full.txt"');
  });
});
