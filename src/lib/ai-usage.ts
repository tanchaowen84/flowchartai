import { getDb } from '@/db';
import { aiUsage, payment, user } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

// AI使用量限制配置
export const AI_USAGE_LIMITS = {
  FREE_USER_MONTHLY: 5, // 免费用户每月5次
  MONTHLY_SUBSCRIBER: 500, // 月费用户每月500次
  // 其他订阅等级的限制可以在这里添加
} as const;

// 获取用户的订阅状态
export async function getUserSubscriptionStatus(userId: string) {
  const db = await getDb();

  // 查询用户的有效订阅
  const activePayments = await db
    .select({
      type: payment.type,
      interval: payment.interval,
      status: payment.status,
      periodEnd: payment.periodEnd,
    })
    .from(payment)
    .where(
      and(
        eq(payment.userId, userId),
        eq(payment.status, 'active'),
        // 检查订阅是否还在有效期内
        gte(payment.periodEnd, new Date())
      )
    );

  if (activePayments.length === 0) {
    return { type: 'free', interval: null };
  }

  // 返回第一个有效订阅（假设用户只有一个有效订阅）
  const subscription = activePayments[0];
  return {
    type: subscription.type,
    interval: subscription.interval,
  };
}

// 检查用户是否可以使用AI功能
export async function canUserUseAI(userId: string): Promise<{
  canUse: boolean;
  reason?: string;
  remainingUsage?: number;
  limit?: number;
}> {
  const db = await getDb();

  // 获取用户订阅状态
  const subscription = await getUserSubscriptionStatus(userId);

  let limit: number;
  let timeFrame: Date;

  if (subscription.type === 'free') {
    // 免费用户：每月5次
    limit = AI_USAGE_LIMITS.FREE_USER_MONTHLY;
    timeFrame = new Date();
    timeFrame.setDate(1); // 本月开始时间
    timeFrame.setHours(0, 0, 0, 0);
  } else if (subscription.interval === 'month') {
    // 月费用户：每月500次
    limit = AI_USAGE_LIMITS.MONTHLY_SUBSCRIBER;
    timeFrame = new Date();
    timeFrame.setDate(1); // 本月开始时间
    timeFrame.setHours(0, 0, 0, 0);
  } else {
    // 其他订阅类型暂时按月费处理
    limit = AI_USAGE_LIMITS.MONTHLY_SUBSCRIBER;
    timeFrame = new Date();
    timeFrame.setDate(1);
    timeFrame.setHours(0, 0, 0, 0);
  }

  // 查询用户在时间范围内的使用次数
  const usageCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.success, true), // 只计算成功的调用
        gte(aiUsage.createdAt, timeFrame)
      )
    );

  const currentUsage = Number(usageCount[0]?.count || 0);
  const remainingUsage = Math.max(0, limit - currentUsage);

  if (currentUsage >= limit) {
    const timeFrameText = 'this month'; // 现在所有用户都是按月计费
    return {
      canUse: false,
      reason: `You have reached your AI usage limit for ${timeFrameText}. Used: ${currentUsage}/${limit}`,
      remainingUsage: 0,
      limit,
    };
  }

  return {
    canUse: true,
    remainingUsage,
    limit,
  };
}

// 记录AI使用
export async function recordAIUsage(
  userId: string,
  type: 'flowchart_generation' | 'canvas_analysis',
  options: {
    tokensUsed?: number;
    model?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  } = {}
) {
  const db = await getDb();

  const usageId = `ai_usage_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  await db.insert(aiUsage).values({
    id: usageId,
    userId,
    type,
    tokensUsed: options.tokensUsed || 0,
    model: options.model,
    success: options.success ?? true,
    errorMessage: options.errorMessage,
    metadata: options.metadata || {},
  });

  return usageId;
}

// 获取用户AI使用统计
export async function getUserAIUsageStats(userId: string) {
  const db = await getDb();

  // 今日使用量
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayUsage = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.success, true),
        gte(aiUsage.createdAt, todayStart)
      )
    );

  // 本月使用量
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthUsage = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.success, true),
        gte(aiUsage.createdAt, monthStart)
      )
    );

  // 总使用量
  const totalUsage = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.success, true)));

  return {
    today: Number(todayUsage[0]?.count || 0),
    thisMonth: Number(monthUsage[0]?.count || 0),
    total: Number(totalUsage[0]?.count || 0),
  };
}
