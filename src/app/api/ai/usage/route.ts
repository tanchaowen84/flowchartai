import {
  canUserUseAI,
  getUserAIUsageStats,
  getUserPlanLevel,
} from '@/lib/ai-usage';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
  try {
    // 身份验证
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({
          error: 'Authentication required',
          message: 'Please log in to view AI usage',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = session.user.id;

    // 获取使用量统计、限制信息和计划类型
    const [stats, limits, planLevel] = await Promise.all([
      getUserAIUsageStats(userId),
      canUserUseAI(userId),
      getUserPlanLevel(userId),
    ]);

    return new Response(
      JSON.stringify({
        stats,
        limits,
        planLevel,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('AI Usage API Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
