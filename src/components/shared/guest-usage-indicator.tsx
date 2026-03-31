'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGuestAIUsage } from '@/hooks/use-guest-ai-usage';
import { LocaleLink } from '@/i18n/navigation';
import { Clock, UserPlus } from 'lucide-react';

interface GuestUsageIndicatorProps {
  className?: string;
}

export function GuestUsageIndicator({ className }: GuestUsageIndicatorProps) {
  const { hasUsedFreeRequest, canUseAI, usageTimestamp } = useGuestAIUsage();

  const formatUsageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with usage status */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-medium text-sm">Guest AI Usage</h3>
              <div className="flex items-center gap-2 mt-1">
                {canUseAI ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    1 Free Request Available
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  >
                    Used
                  </Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              {hasUsedFreeRequest && usageTimestamp && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Used: {formatUsageTime(usageTimestamp)}</span>
                </div>
              )}
              <Button size="sm" asChild className="flex items-center gap-1">
                <LocaleLink href="/auth/login">
                  <UserPlus className="h-3 w-3" />
                  Sign In
                </LocaleLink>
              </Button>
            </div>
          </div>

          {/* Warning message for used requests */}
          {!canUseAI && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You've used your free AI request. Sign in to get more requests!
              </p>
            </div>
          )}

          {/* Bottom explanation text */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Sign in for more requests
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
