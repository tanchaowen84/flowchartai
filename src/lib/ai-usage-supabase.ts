import { supabase } from './supabase';

// AI usage limits
export const AI_USAGE_LIMITS = {
  FREE_USER_DAILY: 5, // Free users get 5 requests per day
  GUEST_USER_MONTHLY: 1, // Guest users get 1 request per month
} as const;

// Record AI usage
export async function recordAIUsage(
  userId: string,
  usageType: string,
  options: {
    tokensUsed?: number;
    model?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: any;
  } = {}
) {
  try {
    const { error } = await supabase.from('ai_usage').insert({
      user_id: userId,
      usage_type: usageType,
      tokens_used: options.tokensUsed || 0,
      model: options.model,
      success: options.success ?? true,
      metadata: {
        ...options.metadata,
        ...(options.errorMessage && { errorMessage: options.errorMessage }),
      },
    });

    if (error) {
      console.error('Error recording AI usage:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording AI usage:', error);
    return false;
  }
}

// Check if user can use AI
export async function canUserUseAI(userId: string) {
  try {
    // Get today's usage count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: usage, error } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    if (error) {
      console.error('Error checking AI usage:', error);
      return {
        canUse: false,
        remainingUsage: 0,
        limit: AI_USAGE_LIMITS.FREE_USER_DAILY,
        reason: 'Error checking usage',
      };
    }

    const usageCount = usage?.length || 0;
    const limit = AI_USAGE_LIMITS.FREE_USER_DAILY;
    const remainingUsage = Math.max(0, limit - usageCount);

    return {
      canUse: usageCount < limit,
      remainingUsage,
      limit,
      usageCount,
    };
  } catch (error) {
    console.error('Error checking AI usage:', error);
    return {
      canUse: false,
      remainingUsage: 0,
      limit: AI_USAGE_LIMITS.FREE_USER_DAILY,
      reason: 'Error checking usage',
    };
  }
}

// Get user's AI usage statistics
export async function getUserAIUsageStats(userId: string) {
  try {
    const { data: usage, error } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting AI usage stats:', error);
      return null;
    }

    const totalUsage = usage?.length || 0;
    const successfulUsage = usage?.filter((u) => u.success).length || 0;
    const totalTokens =
      usage?.reduce((sum, u) => sum + (u.tokens_used || 0), 0) || 0;

    return {
      totalUsage,
      successfulUsage,
      totalTokens,
      recentUsage: usage?.slice(0, 10) || [],
    };
  } catch (error) {
    console.error('Error getting AI usage stats:', error);
    return null;
  }
}
