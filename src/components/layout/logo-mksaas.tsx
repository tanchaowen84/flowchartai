import { cn } from '@/lib/utils';
import Image from 'next/image';

export function MkSaaSLogo({ className }: { className?: string }) {
  return (
    <Image
      src="https://cdn.flowchartai.org/static/mksaas.png"
      alt="Logo of MkSaaS"
      title="Logo of MkSaaS"
      width={96}
      height={96}
      className={cn('size-8 rounded-md', className)}
    />
  );
}
