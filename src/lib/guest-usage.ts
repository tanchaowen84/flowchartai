import { createHash } from 'crypto';
import { getDb } from '@/db';
import { guestUsage } from '@/db/schema';
import { and, eq, gte, lt, sql } from 'drizzle-orm';

// Hash IP address for privacy and storage efficiency
function hashIP(ip: string): string {
  return createHash('sha256')
    .update(ip + process.env.AUTH_SECRET)
    .digest('hex');
}

// Get client IP from request headers
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('x-remote-addr');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (remoteAddr) {
    return remoteAddr;
  }

  return '127.0.0.1'; // fallback
}

// Check if guest can use AI (24-hour cooldown)
export async function canGuestUseAI(request: Request): Promise<{
  canUse: boolean;
  reason?: string;
  lastUsed?: Date;
}> {
  try {
    const db = await getDb();
    const ip = getClientIP(request);
    const ipHash = hashIP(ip);

    // Check for usage in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentUsage = await db
      .select()
      .from(guestUsage)
      .where(
        and(
          eq(guestUsage.ipHash, ipHash),
          gte(guestUsage.createdAt, oneDayAgo),
          eq(guestUsage.success, true)
        )
      )
      .limit(1);

    if (recentUsage.length > 0) {
      return {
        canUse: false,
        reason: 'Already used free AI request in the last 24 hours',
        lastUsed: recentUsage[0].createdAt,
      };
    }

    return { canUse: true };
  } catch (error) {
    console.error('Error checking guest AI usage:', error);
    // Fail open - allow usage if there's a database error
    return { canUse: true };
  }
}

// Record guest AI usage
export async function recordGuestAIUsage(
  request: Request,
  type = 'flowchart_generation',
  success = true
): Promise<void> {
  try {
    const db = await getDb();
    const ip = getClientIP(request);
    const ipHash = hashIP(ip);
    const userAgent = request.headers.get('user-agent') || '';

    // Generate a unique ID for this usage record
    const usageId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.insert(guestUsage).values({
      id: usageId,
      ipHash,
      type,
      userAgent: userAgent.slice(0, 500), // Limit user agent length
      success,
      createdAt: new Date(),
    });

    // Clean up old records (older than 30 days) to keep database size manageable
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(guestUsage).where(lt(guestUsage.createdAt, thirtyDaysAgo));
  } catch (error) {
    console.error('Error recording guest AI usage:', error);
    // Don't throw error - we don't want to block the AI request if logging fails
  }
}

// Get guest usage statistics (for admin purposes)
export async function getGuestUsageStats(): Promise<{
  totalUsage: number;
  dailyUsage: number;
  uniqueIPs: number;
}> {
  try {
    const db = await getDb();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalResult, dailyResult, uniqueIPsResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(guestUsage),
      db
        .select({ count: sql<number>`count(*)` })
        .from(guestUsage)
        .where(gte(guestUsage.createdAt, oneDayAgo)),
      db
        .select({ count: sql<number>`count(distinct ${guestUsage.ipHash})` })
        .from(guestUsage),
    ]);

    return {
      totalUsage: totalResult[0]?.count || 0,
      dailyUsage: dailyResult[0]?.count || 0,
      uniqueIPs: uniqueIPsResult[0]?.count || 0,
    };
  } catch (error) {
    console.error('Error getting guest usage stats:', error);
    return {
      totalUsage: 0,
      dailyUsage: 0,
      uniqueIPs: 0,
    };
  }
}
