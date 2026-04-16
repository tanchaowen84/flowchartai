import { AppShell } from '@/components/blocks/infogiph-home/app-shell';
import { Faq } from '@/components/blocks/infogiph-home/faq';
import { Features } from '@/components/blocks/infogiph-home/features';
import { Footer } from '@/components/blocks/infogiph-home/footer';
import { Hero } from '@/components/blocks/infogiph-home/hero';
import { Templates } from '@/components/blocks/infogiph-home/templates';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Infogiph — AI infographics and animated diagrams',
  description:
    'Turn a sentence into a polished, animated infographic. Generate architecture diagrams, org charts, data flows, and more in seconds.',
};

export default function HomePage() {
  return (
    <AppShell>
      <Hero />
      <Templates />
      <Features />
      <Faq />
      <Footer />
    </AppShell>
  );
}
