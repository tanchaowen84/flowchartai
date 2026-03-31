import { constructMetadata } from '@/lib/metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = constructMetadata({
  noIndex: true,
});

/**
 * Special layout for flowchart callback page to avoid the auth card container
 */
export default function FlowchartCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
