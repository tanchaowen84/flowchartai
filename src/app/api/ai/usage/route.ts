import { canUserUseAI, getUserAIUsageStats } from '@/lib/ai-usage';
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

    // 获取使用量统计和限制信息
    const [stats, limits] = await Promise.all([
      getUserAIUsageStats(userId),
      canUserUseAI(userId),
    ]);

    return new Response(
      JSON.stringify({
        stats,
        limits,
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
