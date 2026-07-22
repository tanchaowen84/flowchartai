import React from 'react';

const llmsDocuments = [
  { href: '/llms.txt', title: 'FlowChart AI content for language models' },
  {
    href: '/llms-full.txt',
    title: 'Full FlowChart AI content for language models',
  },
] as const;

export function LlmsDiscoveryLinks() {
  return llmsDocuments.map((document) => (
    <link
      key={document.href}
      rel="alternate"
      type="text/markdown"
      href={document.href}
      title={document.title}
    />
  ));
}
