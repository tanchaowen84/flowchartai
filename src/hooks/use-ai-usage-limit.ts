'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from './use-current-user';

interface AIUsageData {
  usedCount: number;
  totalLimit: number;
  isLimitReached: boolean;
  subscriptionStatus: 'free' | 'monthly' | 'yearly' | 'lifetime';
}

export function useAIUsageLimit() {
  const [usageData, setUsageData] = useState<AIUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useCurrentUser();

  const fetchUsageData = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/ai/usage');

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await response.json();
      setUsageData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, [currentUser]);

  const checkUsageLimit = async (): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      const response = await fetch('/api/ai/usage');
      if (!response.ok) return false;

      const data = await response.json();
      return !data.isLimitReached;
    } catch {
      return false;
    }
  };

  const refreshUsageData = () => {
    fetchUsageData();
  };

  return {
    usageData,
    isLoading,
    error,
    checkUsageLimit,
    refreshUsageData,
  };
}
