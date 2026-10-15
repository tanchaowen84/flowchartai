'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from './use-current-user';

interface AIUsageData {
  billingMode?: string;
  firstDiagramEligible?: boolean;
  balance?: number;
  usedCount: number;
  totalLimit: number;
  isLimitReached: boolean;
  subscriptionStatus: 'free' | 'hobby' | 'professional';
  timeFrame?: 'daily' | 'monthly';
  nextResetTime?: Date;
  reason?: string;
}

// 全局缓存对象
interface CacheEntry {
  data: AIUsageData;
  timestamp: number;
  userId: string;
}

// 全局状态管理
let globalCache: CacheEntry | null = null;
let activeRequest: Promise<AIUsageData> | null = null;
const CACHE_DURATION = 30000; // 30秒缓存

// 检查缓存是否有效
function isCacheValid(userId: string): boolean {
  if (!globalCache) return false;
  if (globalCache.userId !== userId) return false;
  return Date.now() - globalCache.timestamp < CACHE_DURATION;
}

// 获取使用量数据的核心函数
async function fetchUsageDataCore(userId: string): Promise<AIUsageData> {
  // 如果有有效缓存，直接返回
  if (isCacheValid(userId)) {
    console.log('🎯 Using cached AI usage data');
    return globalCache!.data;
  }

  // 如果已有正在进行的请求，等待其完成
  if (activeRequest) {
    console.log('⏳ Waiting for existing AI usage request');
    return activeRequest;
  }

  // 发起新请求
  console.log('🚀 Fetching fresh AI usage data');
  activeRequest = (async () => {
    try {
      const response = await fetch('/api/ai/usage');

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const responseData = await response.json();

      // 转换响应数据格式以匹配接口
      const data: AIUsageData = {
        billingMode: responseData.limits?.billingMode,
        firstDiagramEligible: responseData.limits?.firstDiagramEligible,
        balance:
          responseData.limits?.billingMode === 'credits'
            ? responseData.limits.remainingUsage
            : undefined,
        usedCount: responseData.limits?.limit
          ? responseData.limits.limit -
            (responseData.limits.remainingUsage || 0)
          : 0,
        totalLimit: responseData.limits?.limit || 0,
        isLimitReached: !responseData.limits?.canUse,
        subscriptionStatus: responseData.planLevel || 'free',
        timeFrame: responseData.limits?.timeFrame,
        nextResetTime: responseData.limits?.nextResetTime
          ? new Date(responseData.limits.nextResetTime)
          : undefined,
        reason: responseData.limits?.reason,
      };

      // 更新全局缓存
      globalCache = {
        data,
        timestamp: Date.now(),
        userId,
      };

      return data;
    } finally {
      // 清除活动请求标记
      activeRequest = null;
    }
  })();

  return activeRequest;
}

export function useAIUsageLimit() {
  const [usageData, setUsageData] = useState<AIUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useCurrentUser();

  const fetchUsageData = async () => {
    if (!currentUser) {
      setUsageData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await fetchUsageDataCore(currentUser.id);
      setUsageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching AI usage data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, [currentUser?.id]); // 只在用户ID变化时重新获取

  const checkUsageLimit = async (): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      // 尝试使用缓存数据
      if (isCacheValid(currentUser.id)) {
        return !globalCache!.data.isLimitReached;
      }

      // 如果缓存无效，发起新请求
      const data = await fetchUsageDataCore(currentUser.id);
      return !data.isLimitReached;
    } catch {
      return false;
    }
  };

  const refreshUsageData = () => {
    // 清除缓存，强制重新获取
    if (globalCache && currentUser && globalCache.userId === currentUser.id) {
      globalCache = null;
    }
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
