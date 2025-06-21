'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Crown, Sparkles, Zap } from 'lucide-react';

interface AIUsageLimitCardProps {
  usedCount: number;
  totalLimit: number;
  onUpgrade: () => void;
  onLearnMore: () => void;
  className?: string;
}

export function AIUsageLimitCard({
  usedCount,
  totalLimit,
  onUpgrade,
  onLearnMore,
  className,
}: AIUsageLimitCardProps) {
  return (
    <Card
      className={`w-full max-w-md mx-auto border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 ${className}`}
    >
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-3">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-xl font-normal text-gray-900">
          AI Usage Limit Reached
        </CardTitle>
        <CardDescription className="font-normal">
          You've used all{' '}
          <span className="font-medium text-amber-700">
            {usedCount}/{totalLimit}
          </span>{' '}
          AI requests this month
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-white/60 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-gray-900">Upgrade to Pro</span>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>500 AI requests per month</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Priority AI response</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Advanced flowchart features</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={onUpgrade}
            className="w-full font-normal bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            <Crown className="mr-2 h-4 w-4" />
            Upgrade to Pro Now
          </Button>

          <Button
            variant="outline"
            onClick={onLearnMore}
            className="w-full font-normal border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            View All Plans & Pricing
          </Button>
        </div>

        <div className="text-center">
          <Badge variant="secondary" className="font-normal text-xs">
            💡 Start from just $9.9/month
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
