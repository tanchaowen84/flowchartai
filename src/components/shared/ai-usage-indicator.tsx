'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AIUsageStats {
  today: number;
  thisMonth: number;
  total: number;
}

interface UsageLimit {
  canUse: boolean;
  reason?: string;
  remainingUsage?: number;
  limit?: number;
}

interface AIUsageIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function AIUsageIndicator({
  compact = false,
  className,
}: AIUsageIndicatorProps) {
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [limits, setLimits] = useState<UsageLimit | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsageData = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/ai/usage');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      setStats(data.stats);
      setLimits(data.limits);
    } catch (error) {
      console.error('Failed to fetch AI usage data:', error);

      // 如果获取失败，显示默认的空数据
      setStats({
        today: 0,
        thisMonth: 0,
        total: 0,
      });

      setLimits({
        canUse: false,
        reason: 'Unable to load usage data',
        remainingUsage: 0,
        limit: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, []);

  if (loading) {
    return (
      <Card
        className={`w-full max-w-lg md:max-w-xl overflow-hidden pt-6 pb-0 flex flex-col ${className}`}
      >
        <CardHeader>
          <CardTitle className="text-lg font-semibold">AI Usage</CardTitle>
          <CardDescription>Your AI feature usage statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-200 rounded w-24" />
            <div className="h-2 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || !limits) {
    return null;
  }

  const usagePercentage = limits.limit
    ? Math.round(
        ((limits.limit - (limits.remainingUsage || 0)) / limits.limit) * 100
      )
    : 0;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span className="text-gray-600">
          {limits.remainingUsage || 0}/{limits.limit || 0}
        </span>
        {!limits.canUse && (
          <span className="text-red-500 text-xs">Limit reached</span>
        )}
      </div>
    );
  }

  return (
    <Card
      className={`w-full max-w-lg md:max-w-xl overflow-hidden pt-6 pb-0 flex flex-col ${className}`}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">AI Usage</CardTitle>
        <CardDescription>Your AI feature usage statistics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        {/* Usage display section */}
        <div className="flex items-center justify-between">
          <div className="text-3xl font-medium">
            {limits.limit
              ? limits.limit - (limits.remainingUsage || 0)
              : stats.today}
            <span className="text-lg text-muted-foreground">
              /{limits.limit || 0}
            </span>
          </div>
          {!limits.canUse && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
              Limit Reached
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <Progress value={usagePercentage} className="h-2" />
        </div>

        {/* Usage details */}
        <div className="text-sm text-muted-foreground space-y-2">
          {limits.remainingUsage !== undefined && (
            <div>
              <span className="font-medium text-blue-600">
                {limits.remainingUsage}
              </span>{' '}
              uses remaining this month
            </div>
          )}

          {!limits.canUse && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {limits.reason}
            </div>
          )}

          {stats.total > 0 && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Total AI interactions: {stats.total}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
