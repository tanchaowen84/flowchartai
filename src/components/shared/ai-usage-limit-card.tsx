'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import React from 'react';

interface AIUsageLimitCardProps {
  usedCount: number;
  totalLimit: number;
  currentPlan?: 'free' | 'hobby' | 'professional';
  onUpgrade: () => void;
  onLearnMore: () => void;
  className?: string;
}

export function AIUsageLimitCard({
  usedCount,
  totalLimit,
  currentPlan = 'free',
  onUpgrade,
  onLearnMore,
  className,
}: AIUsageLimitCardProps) {
  const openPlans = currentPlan === 'professional' ? onLearnMore : onUpgrade;
  const usageSummary =
    totalLimit > 0
      ? `You've used ${usedCount} of ${totalLimit} available AI requests.`
      : 'Your current AI request limit has been reached.';

  return (
    <Card className={`mx-auto w-full max-w-sm ${className ?? ''}`}>
      <CardHeader className="pb-3 text-center">
        <CardTitle className="text-xl">AI request limit reached</CardTitle>
        <CardDescription>{usageSummary}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={openPlans} className="w-full">
          View plans
        </Button>
      </CardContent>
    </Card>
  );
}
