'use client';

import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface GuestUsageIndicatorProps {
  className?: string;
  onContinue?: () => void;
}

export function GuestUsageIndicator({
  className,
  onContinue,
}: GuestUsageIndicatorProps) {
  return (
    <section
      className={cn('border-b border-border py-4', className)}
      aria-labelledby="guest-ai-heading"
    >
      <h3 id="guest-ai-heading" className="text-sm font-medium text-foreground">
        Continue with AI
      </h3>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        Sign in or create a free account to keep generating flowcharts.
      </p>
      {onContinue ? (
        <Button size="sm" className="mt-3 w-full" onClick={onContinue}>
          Continue for free
        </Button>
      ) : (
        <Button size="sm" asChild className="mt-3 w-full">
          <LocaleLink href="/auth/login">Continue for free</LocaleLink>
        </Button>
      )}
    </section>
  );
}
