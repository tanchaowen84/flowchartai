'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { Lock, LogIn, Sparkles, UserPlus } from 'lucide-react';

interface GuestUsageIndicatorProps {
  className?: string;
}

export function GuestUsageIndicator({ className }: GuestUsageIndicatorProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with lock icon */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">AI Assistant Locked</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Sign in to unlock AI-powered flowchart generation
              </p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Generate flowcharts with AI</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Image to flowchart conversion</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Save and manage your work</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button size="sm" asChild className="w-full gap-2">
              <LocaleLink href="/auth/login">
                <LogIn className="h-3 w-3" />
                Sign In to Use AI
              </LocaleLink>
            </Button>
            <Button size="sm" variant="outline" asChild className="w-full gap-2">
              <LocaleLink href="/auth/register">
                <UserPlus className="h-3 w-3" />
                Create Free Account
              </LocaleLink>
            </Button>
          </div>

          {/* Bottom explanation */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Free tier includes 1 flowchart per day
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
