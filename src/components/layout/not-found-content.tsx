import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

interface NotFoundContentProps {
  title: string;
  message: string;
  homeLink: ReactNode;
}

export function NotFoundContent({
  title,
  message,
  homeLink,
}: NotFoundContentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <Logo className="size-12" />

      <h1 className="text-4xl font-bold">{title}</h1>

      <p className="px-4 text-balance text-center text-xl font-medium">
        {message}
      </p>

      <Button asChild size="lg" variant="default" className="cursor-pointer">
        {homeLink}
      </Button>
    </div>
  );
}
